# Git 操作ライブラリ Design Doc

## 1. 背景
Node.js から Git を扱いたい場面は多々ある一方で、既存の `simple-git` は CLI ツールの概念（カレントディレクトリ前提など）を TypeScript の参照モデルに十分落とし込めておらず、特に `clone` 後に「呼び出し側が `cd` しないと作成したリポジトリを自然に扱えない」などの不整合が起きやすい状況にある。

また Git LFS 連携（pull/push の進捗、skip-smudge、LFS 有効/無効の切替）と、AbortController を含む中断制御を、型安全な API として同時に満たす実装は現状ほぼ見当たらない。`isogit-lfs` は目的意識が近いものの、メンテナンスが活発とは言い難い状況である。

本プロジェクトは、まずサーバ（または Electron の main process）で動作するライブラリとして設計し、将来的に「型互換のブラウザ対応版（実行アダプタ差し替え）」へ展開できることを目標とする。

### 1.1 既存ライブラリの具体的制限

実プロジェクトでの `simple-git` 使用経験から、以下の具体的な課題が浮上している：

| 問題 | 影響 |
|------|------|
| **LFS 統合の欠如** | `git lfs` 系コマンドは全て `raw()` 経由が必要で、型安全性を失う |
| **進捗コールバック非対応** | 長時間操作（clone, fetch, push, LFS 転送等）のユーザー体験が著しく低下 |
| **環境変数制御の制限** | 認証・隔離環境の構築に `.env()` チェーンが必要で煩雑 |
| **Worktree API の不足** | `worktree list --porcelain` の出力を手動パースする必要がある |
| **特殊操作の非対応** | `symbolic-ref`、`rev-list --count` 等の plumbing コマンドが未サポート |

これらの制限により、`simple-git` を使用しても結局 `raw()` メソッドを多用することになり、ライブラリの本来の抽象化メリットを享受できない状況が発生している。

---

## 2. 問題設定
### 2.1 CLI オプションの豊富さと stdout 契約の崩壊
Git CLI はオプションが豊富であり、任意のオプションを許可してしまうと stdout の形状が容易に変わる。これにより、パーサが「おかしな `Commits[]`」等を返しがちで、受け取った値を型安全に扱えなくなる。

### 2.2 カレントディレクトリ依存
`cwd` に依存した設計は、clone 後の扱いが不自然になりやすい。Git 自体は `-C <workdir>` により、プロセスのカレントに悩まされない実行が可能である。

### 2.3 LFS の成立条件（filters/hooks/protocol）
LFS は pointer file・filter（clean/smudge/process）・pre-push hook・転送 API 等が絡むため、単純な Git 操作ラップより設計要件が増える。加えて push/pull の進捗通知や skip-smudge、LFS 有効/無効切替も必要となる。

### 2.4 ファクトリパターンの設計欠陥

`simple-git` では以下のような不整合が発生しやすい設計になっている：

```typescript
// SimpleGit の問題設計
const git = simpleGit()           // リポジトリがまだ存在しない
await git.clone(url, localPath)   // 意味論的に矛盾：どのリポジトリに対する操作？
await git.status()                // どのリポジトリの status？（cwd に依存）
```

**問題点**:
- `clone()` が「リポジトリを作成する」操作であるにも関わらず、既存リポジトリに紐づくインスタンスのメソッドになっている
- `clone()` 後に作成されたリポジトリを操作するには、呼び出し側が `cwd` を変更するか新しいインスタンスを作成する必要がある
- インスタンスの状態が暗黙的に変化し、追跡が困難

**本ライブラリでの解決策**:
- `clone()` / `init()` はファクトリ関数として `WorktreeRepo | BareRepo` を明示的に返す
- リポジトリ前提の操作は `Repo` インスタンスのメソッドとして提供し、型レベルでライフサイクルを強制する

---

## 3. ゴール
- Git CLI を正としてラップする（設計方針 A）。
- libgit2 は補助として利用可能にする（LFS 無効の場合、オプション指定により CLI を避けたい場合など、対象コマンドを限定して採用する）。
- 「repo 前提のコマンド」と「repo 非前提コマンド」を型レベルで分離し、`clone()` が repo 前提 API を返す。
- stdout の「契約（Output Contract）」を型に含め、構造化戻り値を型安全に扱えるようにする。
- raw ハッチは用意するが、Typed API を汚さない（任意オプションを Typed API に混入させない）。
- Git/LFS の進捗を callback で通知できる。
- AbortController（AbortSignal）で中断できる。
- 将来のブラウザ対応に向けて、Core（型・仕様）と Adapter（実行系）を分離する。

---

## 4. 非ゴール
- Git CLI の全オプションを完全に型付けすることは非ゴールである。
- 「どんなオプションでも構造化パースできる」ことは非ゴールである（stdout 契約が変わるため）。
- 初期段階でのブラウザ環境での完全な Git/LFS 実行は非ゴールである（型互換を優先する）。

---

## 5. 設計方針（選択肢と採用）
### 5.1 実行方式
- 採用: **A. Git CLI ラップ（主） + libgit2（補助）**
  - CLI により LFS を含む実運用互換性を確保しやすい。
  - `-C workdir` により cwd 依存を解消しやすい。
- 将来: adapter 差し替えでブラウザ実行基盤へ展開可能な構造を維持する。

### 5.2 porcelain / plumbing
- Git 側: 可能な限り機械可読（porcelain / plumbing 寄り）な出力を選定し、stdout 契約を固定する。
- LFS 側: `git-lfs` にも高レベル（porcelain）/低レベル（plumbing）の区分がある前提で、機械可読な取り出し手段（JSON 出力や進捗ファイル）を優先する。

---

## 6. アーキテクチャ

### 6.1 モジュール分割
- **Core**
  - 公開 API の型（引数/戻り値/エラー）
  - コマンド仕様（CommandSpec / OutputContract）
  - stdout/stderr パーサ（契約に基づく）
- **Adapters**
  - CLI Adapter（必須）: `git` / `git-lfs` の spawn 実行、stderr 進捗処理、LFS 進捗ファイル追跡、Abort 対応を担う。
  - libgit2 Adapter（任意）: 一部機能の代替実装を担う（対象を明確化する）。
  - Browser Adapter（将来）: Core 型互換を維持したまま実行部を差し替える。

### 6.2 実行コンテキスト（cwd 排除）
- repo 前提コマンドは **必ず `git -C <workdir>`** を付与する。
- bare リポジトリ等は内部的に `--git-dir` / `--work-tree` 構成を用いる（workdir を持たない状態を型で表現する）。

### 6.3 宣言的環境隔離（Environment Isolation）

Git 操作のセキュリティと再現性を確保するため、宣言的な環境設定をサポートする：

```typescript
interface GitOpenOptions {
  /** カスタム HOME ディレクトリ（~/.gitconfig の読み込み元） */
  home?: string;
  /** システム設定を無視（--config-env=GIT_CONFIG_GLOBAL=/dev/null 相当） */
  ignoreSystemConfig?: boolean;
  /** カスタム credential helper */
  credentialHelper?: string;
  /** 追加の環境変数 */
  env?: Record<string, string>;
  /** PATH の先頭に追加するディレクトリ */
  pathPrefix?: string[];
}

// 使用例
const git = await Git.open(repoPath, {
  home: '/custom/git/home',
  ignoreSystemConfig: true,
  credentialHelper: 'custom-helper',
  env: { GIT_TERMINAL_PROMPT: '0' },
  pathPrefix: ['/custom/bin'],
});
```

**設計意図**:
- **CI/CD 環境**: システム設定干渉を防止し、再現性を確保
- **並列操作**: 複数リポジトリの同時操作時に環境を分離
- **認証カスタマイズ**: OAuth、AWS CodeCommit 等の credential helper を柔軟に設定
- **ハングアップ防止**: `GIT_TERMINAL_PROMPT=0` により非対話環境での停止を回避

### 6.4 Credential Helper ファーストクラスサポート

Git 認証は実運用で最も問題が発生しやすい領域である。本ライブラリでは、宣言的かつ型安全な認証設定 API を提供する：

```typescript
interface CredentialConfig {
  // 方法1: ビルトイン helper の使用
  helper?: 'store' | 'cache' | 'manager-core' | string;

  // 方法2: カスタム helper バイナリ
  helperPath?: string;

  // 方法3: プログラマティックな認証（推奨）
  provider?: (request: CredentialRequest) => Promise<Credential>;

  // 方法4: 静的な認証情報（開発/テスト用）
  username?: string;
  password?: string;
  token?: string;

  // エラーハンドリング
  fallback?: CredentialConfig;
  onAuthFailure?: (error: Error, request: CredentialRequest) => void;
}

interface CredentialRequest {
  protocol: 'https' | 'ssh';
  host: string;
  path?: string;
}

interface Credential {
  username: string;
  password: string;
}
```

**使用例**:

```typescript
// 方法1: ビルトイン helper
const git = await Git.open(repoPath, {
  credential: { helper: 'store' },
});

// 方法2: カスタム helper バイナリ
const git = await Git.open(repoPath, {
  credential: {
    helper: 'custom',
    helperPath: '/path/to/git-credential-custom',
  },
});

// 方法3: プログラマティックな認証（推奨）
const git = await Git.open(repoPath, {
  credential: {
    provider: async (request) => {
      const token = await getTokenFromSecureStorage(request.host);
      return { username: 'oauth2', password: token };
    },
  },
});

// 方法4: 静的な認証情報（開発/テスト用）
const git = await Git.open(repoPath, {
  credential: { token: 'personal-access-token' },
});

// 認証失敗時のフォールバック
const git = await Git.open(repoPath, {
  credential: {
    provider: primaryProvider,
    fallback: { provider: fallbackProvider },
    onAuthFailure: (error, request) => {
      log.warn('Auth failed', { host: request.host, error });
    },
  },
});
```

**利点**:
- **外部バイナリ不要**: プログラマティック認証により、credential helper バイナリのインストール・配布が不要
- **型安全**: 認証フローが TypeScript で型付けされ、IDE 補完が効く
- **エラーハンドリング**: 認証失敗のキャッチ、フォールバック、ログ記録が容易
- **トークン管理**: リフレッシュ/ローテーション対応が `provider` 関数内で実装可能
- **テスト容易性**: モック provider の注入が容易

**実装方針**:
- プログラマティック認証は `GIT_ASKPASS` 環境変数と一時スクリプトで実現
- 静的認証情報は `git credential fill` へのパイプで注入
- helper バイナリ指定は `credential.helper` config で設定

---

## 7. API 設計

### 7.1 リポジトリ前提の型分離
- `Git`（repo 非前提）
  - `clone`, `init`, `lsRemote`, `version`, `raw`（非repo）
- `Repo`（repo 前提）
  - `status`, `log`, `diff`（契約を固定できる範囲から）, `fetch`, `push`
  - `lfs.*`（`pull/push/status` 等）
  - `raw`（repo 前提）

### 7.2 repo の種類
- `WorktreeRepo`（workdir あり）
- `BareRepo`（workdir なし）
`clone({ bare: true })` は `BareRepo` を返し、worktree 前提 API を型で禁止する。

### 7.3 例（概略）
```ts
type Progress =
  | { kind: "git"; phase: "clone" | "fetch" | "push"; message: string; percent?: number }
  | { kind: "lfs"; direction: "download" | "upload" | "checkout"; current: number; total: number; name?: string };

type ExecOpts = { signal?: AbortSignal; onProgress?: (p: Progress) => void };

interface Git {
  clone(url: string, opts: CloneOpts & ExecOpts): Promise<WorktreeRepo | BareRepo>;
  init(path: string, opts?: InitOpts & ExecOpts): Promise<WorktreeRepo | BareRepo>;
  lsRemote(url: string, opts?: LsRemoteOpts & ExecOpts): Promise<LsRemoteResult>;
  raw(argv: string[], opts?: ExecOpts): Promise<RawResult>;
}

interface RepoBase {
  raw(argv: string[], opts?: ExecOpts): Promise<RawResult>;
}

interface WorktreeRepo extends RepoBase {
  readonly workdir: string;
  status(opts: StatusOpts): Promise<StatusPorcelain>;
  log(opts: LogOpts): Promise<Commit[]>;
  fetch(opts?: FetchOpts & ExecOpts): Promise<void>;
  push(opts?: PushOpts & ExecOpts): Promise<void>;
  lfs: {
    pull(opts?: LfsPullOpts & ExecOpts): Promise<void>;
    push(opts?: LfsPushOpts & ExecOpts): Promise<void>;
    status(opts?: LfsStatusOpts & ExecOpts): Promise<LfsStatus>;
  };
}

interface BareRepo extends RepoBase {
  fetch(opts?: FetchOpts & ExecOpts): Promise<void>;
  push(opts?: PushOpts & ExecOpts): Promise<void>;
}
```

### 7.4 Worktree 完全サポート

Git worktree は複数のチェックアウトを持つワークフローで重要である。本ライブラリでは完全なサポートを提供する：

```typescript
interface Worktree {
  path: string;
  head: string;
  branch?: string;
  locked: boolean;
  prunable: boolean;
}

interface WorktreeOperations {
  /** worktree の一覧取得（--porcelain パース） */
  list(): Promise<Worktree[]>;
  /** 新しい worktree を追加 */
  add(path: string, opts?: { branch?: string; detach?: boolean; track?: boolean }): Promise<void>;
  /** worktree を削除（強制オプションあり） */
  remove(path: string, opts?: { force?: boolean }): Promise<void>;
  /** 不要な worktree 参照を整理 */
  prune(opts?: { dryRun?: boolean; verbose?: boolean }): Promise<string[]>;
  /** worktree をロック */
  lock(path: string, opts?: { reason?: string }): Promise<void>;
  /** worktree のロックを解除 */
  unlock(path: string): Promise<void>;
}

// WorktreeRepo に統合
interface WorktreeRepo extends RepoBase {
  // ... existing properties ...
  worktree: WorktreeOperations;
}
```

**実装**: `git worktree list --porcelain` 出力のパーサを実装し、型安全な `Worktree[]` を返却する。

### 7.5 2-Phase Commit パターンサポート（将来拡張）

**ステータス**: 将来実装（MVP 範囲外）

複雑な Git/LFS 操作の信頼性を確保するため、トランザクション的なパターンをサポートする：

```typescript
interface GitTransaction {
  /** LFS オブジェクトを事前にプッシュ（pre-push 相当） */
  prePushLfsObjects(opts?: ExecOpts): Promise<void>;
  /** コミットを作成 */
  commit(message: string, opts?: CommitOpts & ExecOpts): Promise<string>;
  /** リモートへプッシュ */
  push(opts?: PushOpts & ExecOpts): Promise<void>;
  /** トランザクション完了（クリーンアップ） */
  complete(): Promise<void>;
  /** トランザクションの巻き戻し（best-effort） */
  rollback(): Promise<void>;
}

// 使用例
const transaction = await repo.beginTransaction();
try {
  await transaction.prePushLfsObjects({ onProgress });
  const commitHash = await transaction.commit('feat: add large files');
  await transaction.push({ onProgress });
  await transaction.complete();
} catch (e) {
  await transaction.rollback();
  throw e;
}
```

**用途**:
- LFS push が失敗した場合のコミット巻き戻し
- ネットワーク障害時の一貫性保証
- CI/CD パイプラインでの確実なリリースフロー

**注意**: Git 自体は完全な ACID トランザクションをサポートしないため、これは best-effort のパターンであり、完全なロールバックを保証しない。

---

## 8. stdout 契約（OutputContract）と型安全

### 8.1 原則
- Typed API は **stdout 形状を固定できるモードのみ**提供する。
- stdout 形状を変えうる複雑な指定は「Typed API に混ぜない」。
- 任意の追加オプションは **raw に集約**する（「好きに付けられるようにする」ではなく「それは raw で投げる」）。

### 8.2 実装方針（例）
- `status()` は `--porcelain=v1|v2` を必須とし、戻り値も対応する型に固定する。
- `log()` は内部で `--pretty=<固定フォーマット>` 等を強制し、パーサ前提を崩すフラグ（patch/stat/name-status 等）は受け付けない。
- どうしても自由度が必要な場合は `repo.raw(["log", ...])` を用いる。

### 8.3 output mode を導入する場合（任意）
コマンドごとに `output: "parsed" | "raw"` を持たせ、`parsed` のときは `extraArgs` を禁止（または厳密に限定）する。

---

## 9. Raw ハッチの仕様
- `git.raw()` と `repo.raw()` を分離する（repo 前提/不要の混線を防ぐ）。
- `RawResult` は以下を返す。
  - `stdout: string`
  - `stderr: string`
  - `exitCode: number`
  - `aborted: boolean`
- raw はパースを行わない（呼び出し側責務である）。

---

## 10. LFS 設計

### 10.1 LFS ポリシー（有効/無効）
- リポジトリ単位または操作単位で LFS の扱いを指定可能にする。
  - 例: `lfs: "enabled" | "disabled" | { skipSmudge: true }`
- LFS 無効/skip-smudge の場合、worktree でも pointer を保持することを許容する（仕様として明示する）。

### 10.2 LFS の状態取得と進捗
- 状態取得は `git lfs status --json` 等、機械可読出力を利用する（対応コマンドは範囲を明記する）。
- 進捗は `GIT_LFS_PROGRESS` を第一ソースとして採用し、行を tail して `onProgress` に変換する。
  - 非TTY抑止を避けたい場合は `GIT_LFS_FORCE_PROGRESS` を利用可能にする。
- `git lfs pull` / `git lfs push` は JSON/porcelain が揃っていない可能性があるため、進捗はファイル方式＋補助的な stderr/stdout パースで成立させる。

---

## 11. 進捗通知（Git 側）
- `fetch/push/clone` などは `--progress` を付与し、stderr を行単位で読んで `onProgress` に渡す。
- パース不能でも `message` として中継し、可観測性を確保する。

---

## 12. AbortController 対応
- すべての実行 API が `signal?: AbortSignal` を受け取る。
- CLI Adapter は spawn 実行を中断（kill）し、進捗 tail も同時に停止する。
- `aborted` を結果/エラーに反映し、呼び出し側で判定できる形にする。

---

## 13. エラー設計

### 13.1 基本エラー種別

共通 `GitError` を定義し、最低限を保持する：
- `kind`: `SpawnFailed | NonZeroExit | ParseError | Aborted | CapabilityMissing` 等
- `argv`, `workdir/gitDir`, `exitCode`, `stdout`, `stderr`
- `ParseError` は Typed API のみで発生しうる（stdout 契約違反を表す）

### 13.2 エラーカテゴリ（拡張）

エラーの性質に基づくカテゴリ分類を追加し、エラーハンドリングを容易にする：

```typescript
type GitErrorCategory =
  | 'auth'        // 認証エラー（401, credential 関連）
  | 'network'     // ネットワークエラー（タイムアウト、DNS 解決失敗等）
  | 'conflict'    // マージコンフリクト、リベースコンフリクト
  | 'lfs'         // LFS 固有のエラー（ストレージ容量、転送失敗等）
  | 'permission'  // 権限エラー（ディレクトリアクセス、ファイルロック）
  | 'corruption'  // リポジトリ破損
  | 'unknown';    // 分類不能

class GitError extends Error {
  readonly kind: GitErrorKind;
  readonly category: GitErrorCategory;
  readonly argv: string[];
  readonly workdir?: string;
  readonly exitCode?: number;
  readonly stdout: string;
  readonly stderr: string;

  /** リトライ可能かどうかを判定 */
  isRetryable(): boolean {
    return this.category === 'network' ||
           (this.category === 'lfs' && this.kind === 'NonZeroExit');
  }

  /** 認証が必要かどうかを判定 */
  needsAuthentication(): boolean {
    return this.category === 'auth';
  }
}
```

### 13.3 エラー検出パターン

stderr/stdout から category を推定するパターンマッチング：

| パターン | Category |
|----------|----------|
| `fatal: Authentication failed` | auth |
| `fatal: Could not resolve host` | network |
| `fatal: unable to access .* Connection timed out` | network |
| `CONFLICT (content)` | conflict |
| `LFS: .* 507 Insufficient Storage` | lfs |
| `error: cannot lock ref` | permission |
| `fatal: bad object` | corruption |

---

## 14. Capability（実行環境差）設計
- `git` / `git-lfs` の有無、バージョン差、利用可能な出力モード等を capability として保持する。
- 将来 Browser Adapter では `raw` 不可などの差が出るため、`client.capabilities` により利用可否を判定できる形にする。

---

## 15. テスト方針
- ユニット
  - options → argv の生成
  - stdout/stderr パーサ（porcelain/pretty/refs 等）
  - LFS progress 行のパース
- 結合
  - 実リポジトリで clone/fetch/push の進捗・abort
  - LFS リポジトリで pull/push、skip-smudge、progress、abort

---

## 16. 初期スコープ（MVP）
- CLI Adapter（必須）
- `Git.clone/init/lsRemote/raw`
- `WorktreeRepo.status/log/fetch/push/raw`
- `WorktreeRepo.lfs.pull/push/status`（progress/abort を含む）
- stdout 契約が固定できるものから Typed API を提供し、自由度が必要なものは raw に集約する。

---

## 17. 未決事項（今後詰める項目）
- Typed API で許可するオプション集合（stdout 契約を崩さない範囲の定義）
- `log()` の固定フォーマット（区切り文字・エスケープ規約・パーサ仕様）
- LFS 無効モードの具体（環境変数運用、install 設定の扱い、操作単位/リポジトリ単位の優先順位）
- libgit2 を補助採用する具体コマンド範囲（対象と採用理由の明記）

---

## 18. パフォーマンス要件

### 18.1 設計上の考慮事項

本ライブラリでは、以下のパフォーマンス観点を設計に反映する：

#### キャッシュ戦略
- `status` 等の頻繁に呼ばれる操作に対するキャッシュ機構の検討
- ファイルシステム監視（fswatch）による自動無効化の可能性

#### ストリーミング対応
- `diff` 等の大量出力が予想されるコマンドにはストリーミング API を検討
- メモリ効率を重視した設計（巨大リポジトリ対応）

```typescript
// ストリーミング API の例（将来拡張）
for await (const hunk of repo.diffStream({ cached: true })) {
  console.log(hunk.header);
}
```

#### LFS 並列転送
- 複数 LFS オブジェクトの同時転送をサポート
- `GIT_LFS_CONCURRENT_TRANSFERS` 相当の設定を公開

#### Windows 固有の制約

Windows の CreateProcess API にはコマンドライン長 8191 文字の制限がある。バッチ操作（多数ファイルの add 等）では自動的に分割実行する：

```typescript
// 内部実装で自動分割
await repo.add(['file1.txt', 'file2.txt', /* ... 大量のファイル */]);
// → 内部で `git add file1.txt file2.txt ... && git add ...` に分割
```

### 18.2 ベンチマーク方針

- 主要操作（status, log, fetch, push）のベンチマークを CI に組み込む
- リグレッション検出のための閾値設定を検討

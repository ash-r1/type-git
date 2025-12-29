# プロジェクトタスクリスト（Node / Deno / Bun 対応を最初から見据えた版）

本タスクリストは、Git CLI ラップ主体（設計方針 A）で、LFS 進捗・AbortSignal・stdout 契約の型安全を同時に満たすための実装順序を定義する。最初から Node / Deno / Bun の差分を吸収できる境界（Adapter）を固定し、後からの境界切り替えを不要にする。

---

## 1. リポジトリ準備
1. リポジトリ作成（単体パッケージを前提とする）
2. Node.js / TypeScript バージョン固定（例: `.nvmrc` または Volta）
3. パッケージマネージャ決定（pnpm / npm / yarn のいずれか）
4. `tsconfig` 初期化（declaration 出力、module/target 方針を含める）
5. Lint/format（ESLint/Prettier）導入
6. Unit test 基盤（Vitest 等）導入
7. CI（GitHub Actions）
   - lint / typecheck / unit test
   - ランタイム別スモークの枠だけ先に作る（後述）

---

## 2. ランタイム対応の境界固定（最優先）
### 2.1 Core: Adapter インターフェース確定
8. `ExecAdapter` インターフェース定義
   - spawn（argv/env/cwd 相当）
   - stdout/stderr のストリーミング（行/バイト）
   - exitCode / signal / aborted
   - `AbortSignal` を受け取る（中断時の扱いを契約化）
   - killSignal 相当（任意）
9. `FsAdapter` インターフェース定義
   - temp ファイル作成（LFS progress 用）
   - tail（追記監視）/停止
   - ファイル削除
10. `Capabilities` 型定義
   - `canSpawnProcess`
   - `canReadEnv`
   - `canWriteTemp`
   - `supportsAbortSignal`
   - `supportsKillSignal`
   - `runtime: "node" | "deno" | "bun"` など

### 2.2 Adapters: ランタイム別実装（初期から並走）
11. `NodeExecAdapter` 実装
12. `BunExecAdapter` 実装
13. `DenoExecAdapter` 実装（Node 互換 API または Deno のプロセス API で実装）
14. `NodeFsAdapter` 実装
15. `BunFsAdapter` 実装
16. `DenoFsAdapter` 実装（権限不足時は capability として扱う）

### 2.3 スモークテスト（早期に必須）
17. Node で「spawn + abort + stdout/stderr 取得」スモーク
18. Bun で同等スモーク
19. Deno で同等スモーク（必要権限が前提ならテスト実行オプションに反映）
20. CI に Node/Bun/Deno のジョブ枠を追加（最初はスモークのみ）

---

## 3. 仕様確定（MVP の契約を埋める）
21. Public API の MVP 範囲確定
   - `Git.clone/init/lsRemote/raw`
   - `WorktreeRepo.status/log/fetch/push/raw`
   - `WorktreeRepo.lfs.pull/push/status`
22. Repo 型分離の確定
   - `Git`（repo 非前提）と `Repo`（repo 前提）
   - `WorktreeRepo` と `BareRepo`
23. 実行コンテキスト規約の確定
   - Worktree は `git -C <workdir>`
   - Bare は `--git-dir` / `--work-tree`（必要な場合）を内部で選択
24. OutputContract 方針の確定
   - Typed API は stdout 形状が固定できるモードのみ提供
   - 複雑な任意オプションは raw に退避
25. Progress イベントスキーマ確定（git/lfs を統一）
26. Abort 時の error/結果の扱い確定（`Aborted` と `NonZeroExit` の区別）

---

## 4. Core（型・仕様・パーサ）
27. 型定義
   - `GitError`（kind, argv, workdir/gitDir, exitCode, stdout, stderr）
   - `RawResult`
   - `Progress`（git/lfs）
   - `ExecOpts`（signal, onProgress）
28. CommandSpec / IR の形を作る
   - options → argv の生成規約
   - outputContract メタデータ
   - parse（stdout/stderr → 型）をコマンド単位で定義可能にする
29. stdout 契約に基づくパースユーティリティ
   - line parser / record parser（固定区切り）
   - JSON parser（LFS status 等）

---

## 5. CLI 実行基盤（Adapter を使って実装）
30. `CliRunner` 実装（ExecAdapter の上に構築）
   - argv 組み立て
   - env 合成
   - repo 実行時の `-C` 付与
   - stdout/stderr の収集と streaming
   - AbortSignal 連動
31. Git progress（stderr）収集
   - `--progress` を付与
   - stderr を行単位で読み取り `onProgress` へ
32. 共通エラーマッピング
   - SpawnFailed / NonZeroExit / Aborted / ParseError / CapabilityMissing

---

## 6. Raw API（安全な逃げ道）
33. `Git.raw(argv, opts)` 実装（repo 非前提）
34. `Repo.raw(argv, opts)` 実装（repo 前提、`-C` 自動付与）
35. raw はパースしない契約を固定（stdout/stderr/exitCode/aborted）

---

## 7. Typed API（stdout 契約が固定できるものから）
36. `Git.lsRemote()`（契約固定してパース）
37. `Repo.status()`（`--porcelain=v1|v2` 必須、戻り値型を分離）
38. `Repo.log()`（内部で `--pretty=<固定>` を強制し `Commit[]` を返す）
39. `Repo.fetch()`（progress/abort 対応、戻り値は void）
40. `Repo.push()`（progress/abort 対応、戻り値は void）
41. `Git.clone()` / `Git.init()`（`WorktreeRepo | BareRepo` を返す）

---

## 8. LFS 対応（最初から progress/abort と両立）
### 8.1 LFS ポリシー
42. LFS モード定義（enabled/disabled/skipSmudge 等）と適用順序の確定
43. 実行時 env 注入規約の実装（skip-smudge 等）

### 8.2 LFS 進捗（GIT_LFS_PROGRESS を第一ソース）
44. `LfsProgressTracker` 実装（FsAdapter のみを使用）
   - temp ファイル生成
   - tail 開始/停止
   - 行パースして `Progress{kind:"lfs"}` を発火
   - abort/exit 後の確実な cleanup
45. `Repo.lfs.status()`（JSON を typed でパース）
46. `Repo.lfs.pull()`（progress/abort 対応）
47. `Repo.lfs.push()`（progress/abort 対応）
48. LFS stdout/stderr の補助パース（必要最小限）

---

## 9. libgit2 補助（後段）
49. libgit2 を使う対象コマンド選定（読み取り系等、範囲を明確化）
50. libgit2 Adapter の PoC（最小 1 コマンド）
51. CLI と libgit2 の capability 切替を実装（条件と優先順位を固定）

---

## 10. テスト拡充
52. ユニットテスト
   - argv 生成
   - status/log の stdout パーサ
   - LFS progress 行パーサ
53. 結合テスト（Node）
   - clone/fetch/push の progress/abort
   - LFS リポジトリで pull/push/progress/skip-smudge/abort
54. 結合テスト（Bun/Deno）
   - まずは最小（spawn + raw + abort + progress）
   - LFS 結合は環境依存が強ければ optional 化（nightly 等）
55. CI マトリクス拡張
   - Node/Bun/Deno の単体/最小結合を常時
   - LFS 結合は別ジョブに分離（失敗許容の可否を決める）

---

## 11. ドキュメント・運用
56. README
   - typed と raw の境界
   - `-C workdir` による cwd 非依存
   - progress / abort の使用方法
   - LFS モード（enabled/disabled/skipSmudge）の挙動
   - Node/Bun/Deno の前提（権限や依存）
57. API リファレンス（tsdoc）
58. 互換性方針
   - 対応 Git / git-lfs バージョン範囲
   - ランタイム対応範囲（Node/Bun/Deno）

---

## 12. リリース準備
59. 配布戦略確定（Node/Bun/Deno で解決可能な入口設計）
60. `exports` / サブパス export の整備（`pkg/node`, `pkg/bun`, `pkg/deno` 等）
61. ビルド成果物生成（d.ts 含む）
62. v0.1.0 リリース（MVP）

---

## 13. マイルストーン案
- M0: Adapter 境界（Exec/Fs/Capabilities）確定 + Node/Bun/Deno スモーク
- M1: CLI 実行基盤 + Abort + Git progress + raw API
- M2: Repo 型分離 + `-C workdir` 完全移行 + typed（status/log/lsRemote）
- M3: LFS progress（GIT_LFS_PROGRESS）+ lfs.status/pull/push
- M4: 結合テスト整備 + v0.1.0
- M5: libgit2 補助 PoC（任意）

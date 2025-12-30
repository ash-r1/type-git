# プロジェクトタスクリスト（Node / Deno / Bun 対応を最初から見据えた版）

本タスクリストは、Git CLI ラップ主体（設計方針 A）で、LFS 進捗・AbortSignal・stdout 契約の型安全を同時に満たすための実装順序を定義する。最初から Node / Deno / Bun の差分を吸収できる境界（Adapter）を固定し、後からの境界切り替えを不要にする。

## 進捗サマリー

| Phase | 状態 | 完了タスク |
|-------|------|-----------|
| 1. リポジトリ準備 | ✅ 完了 | 1-7 |
| 2. ランタイム対応の境界固定 | ✅ 完了 | 8-20 (Node/Bun/Deno 全て完了) |
| 3. 仕様確定 | ✅ 完了 | 21-30 |
| 4. Core（型・仕様・パーサ） | ✅ 完了 | 31-33 |
| 5. CLI 実行基盤 | ✅ 完了 | 34-36 |
| 6. Raw API | ⏳ 未着手 | - |
| 7. Typed API | ⏳ 未着手 | - |
| 8. Credential Helper | ⏳ 未着手 | - |
| 9. LFS 対応 | ⏳ 未着手 | - |
| 10. libgit2 補助 | ⏳ 未着手 | - |
| 11. テスト拡充 | ⏳ 未着手 | - |
| 12. パフォーマンス最適化 | ⏳ 未着手 | - |
| 13. ドキュメント・運用 | ⏳ 未着手 | - |
| 14. リリース準備 | ⏳ 未着手 | - |

**現在のマイルストーン: M0 完了 → M1/M2 に向けて作業中**

---

## 1. リポジトリ準備 ✅
1. [x] リポジトリ作成（単体パッケージを前提とする）
2. [x] Node.js / TypeScript バージョン固定（例: `.nvmrc` または Volta）
3. [x] パッケージマネージャ決定（pnpm / npm / yarn のいずれか）
4. [x] `tsconfig` 初期化（declaration 出力、module/target 方針を含める）
5. [x] Lint/format（ESLint/Prettier）導入
6. [x] Unit test 基盤（Vitest 等）導入
7. [x] CI（GitHub Actions）
   - lint / typecheck / unit test
   - ランタイム別スモークの枠だけ先に作る（後述）

---

## 2. ランタイム対応の境界固定（最優先） ✅
### 2.1 Core: Adapter インターフェース確定 ✅
8. [x] `ExecAdapter` インターフェース定義
   - spawn（argv/env/cwd 相当）
   - stdout/stderr のストリーミング（行/バイト）
   - exitCode / signal / aborted
   - `AbortSignal` を受け取る（中断時の扱いを契約化）
   - killSignal 相当（任意）
9. [x] `FsAdapter` インターフェース定義
   - temp ファイル作成（LFS progress 用）
   - tail（追記監視）/停止
   - ファイル削除
10. [x] `Capabilities` 型定義
   - `canSpawnProcess`
   - `canReadEnv`
   - `canWriteTemp`
   - `supportsAbortSignal`
   - `supportsKillSignal`
   - `runtime: "node" | "deno" | "bun"` など

### 2.2 Adapters: ランタイム別実装（初期から並走） ✅
11. [x] `NodeExecAdapter` 実装
12. [x] `BunExecAdapter` 実装
13. [x] `DenoExecAdapter` 実装（Deno.Command API で実装）
14. [x] `NodeFsAdapter` 実装
15. [x] `BunFsAdapter` 実装
16. [x] `DenoFsAdapter` 実装（権限不足時は capability として扱う）

### 2.3 スモークテスト（早期に必須） ✅
17. [x] Node で「spawn + abort + stdout/stderr 取得」スモーク
18. [x] Bun で同等スモーク
19. [x] Deno で同等スモーク（--allow-run, --allow-read, --allow-write, --allow-env が必要）
20. [x] CI に Node/Bun/Deno のジョブ枠を追加（最初はスモークのみ）

---

## 3. 仕様確定（MVP の契約を埋める） ✅
21. [x] Public API の MVP 範囲確定
   - `Git.clone/init/lsRemote/raw`
   - `WorktreeRepo.status/log/fetch/push/raw`
   - `WorktreeRepo.lfs.pull/push/status`
22. [x] Repo 型分離の確定
   - `Git`（repo 非前提）と `Repo`（repo 前提）
   - `WorktreeRepo` と `BareRepo`
23. [x] 実行コンテキスト規約の確定
   - Worktree は `git -C <workdir>`
   - Bare は `--git-dir` / `--work-tree`（必要な場合）を内部で選択
24. [x] OutputContract 方針の確定
   - Typed API は stdout 形状が固定できるモードのみ提供
   - 複雑な任意オプションは raw に退避
25. [x] Progress イベントスキーマ確定（git/lfs を統一）
26. [x] Abort 時の error/結果の扱い確定（`Aborted` と `NonZeroExit` の区別）
27. [x] 環境隔離オプションの確定
   - `GitOpenOptions` インターフェース定義
   - `home`, `ignoreSystemConfig`, `credentialHelper`, `env`, `pathPrefix`
28. [x] エラーカテゴリ分類の確定
   - `GitErrorCategory` 型定義（auth/network/conflict/lfs/permission/corruption/unknown）
   - stderr パターンマッチング規約
29. [x] パフォーマンス観点の確定
   - キャッシュ戦略の方針
   - Windows コマンドライン長制限への対応方針
30. [ ] Credential Helper 設計の確定
   - `CredentialConfig` インターフェース定義
   - プログラマティック認証（`GIT_ASKPASS`）の実装方針
   - フォールバック・エラーハンドリング規約

---

## 4. Core（型・仕様・パーサ） ✅
31. [x] 型定義
   - `GitError`（kind, category, argv, workdir/gitDir, exitCode, stdout, stderr）
   - `RawResult`
   - `Progress`（git/lfs）
   - `ExecOpts`（signal, onProgress）
32. [x] CommandSpec / IR の形を作る
   - options → argv の生成規約
   - outputContract メタデータ
   - parse（stdout/stderr → 型）をコマンド単位で定義可能にする
33. [x] stdout 契約に基づくパースユーティリティ
   - line parser / record parser（固定区切り）
   - JSON parser（LFS status 等）

---

## 5. CLI 実行基盤（Adapter を使って実装） ✅
34. [x] `CliRunner` 実装（ExecAdapter の上に構築）
   - argv 組み立て
   - env 合成（環境隔離オプション反映）
   - repo 実行時の `-C` 付与
   - stdout/stderr の収集と streaming
   - AbortSignal 連動
35. [x] Git progress（stderr）収集
   - `--progress` を付与
   - stderr を行単位で読み取り `onProgress` へ
36. [x] 共通エラーマッピング
   - SpawnFailed / NonZeroExit / Aborted / ParseError / CapabilityMissing
   - エラーカテゴリ推定（stderr パターンマッチング）

---

## 6. Raw API（安全な逃げ道）
37. [ ] `Git.raw(argv, opts)` 実装（repo 非前提）
38. [ ] `Repo.raw(argv, opts)` 実装（repo 前提、`-C` 自動付与）
39. [ ] raw はパースしない契約を固定（stdout/stderr/exitCode/aborted）

---

## 7. Typed API（stdout 契約が固定できるものから）
40. [ ] `Git.lsRemote()`（契約固定してパース）
41. [ ] `Repo.status()`（`--porcelain=v1|v2` 必須、戻り値型を分離）
42. [ ] `Repo.log()`（内部で `--pretty=<固定>` を強制し `Commit[]` を返す）
43. [ ] `Repo.fetch()`（progress/abort 対応、戻り値は void）
44. [ ] `Repo.push()`（progress/abort 対応、戻り値は void）
45. [ ] `Git.clone()` / `Git.init()`（`WorktreeRepo | BareRepo` を返す）
46. [ ] `Repo.worktree.list()`（`--porcelain` パース）
47. [ ] `Repo.worktree.add()` / `remove()` / `prune()` / `lock()` / `unlock()` 実装

---

## 8. Credential Helper 実装
48. [ ] `CredentialConfig` 型定義
49. [ ] ビルトイン helper 設定（store/cache/manager-core）
50. [ ] プログラマティック認証（`GIT_ASKPASS` + 一時スクリプト）
51. [ ] 静的認証情報の注入（`git credential fill` パイプ）
52. [ ] フォールバック・`onAuthFailure` ハンドリング

---

## 9. LFS 対応（最初から progress/abort と両立）
### 9.1 LFS ポリシー
53. [ ] LFS モード定義（enabled/disabled/skipSmudge 等）と適用順序の確定
54. [ ] 実行時 env 注入規約の実装（skip-smudge 等）

### 9.2 LFS 進捗（GIT_LFS_PROGRESS を第一ソース）
55. [ ] `LfsProgressTracker` 実装（FsAdapter のみを使用）
   - temp ファイル生成
   - tail 開始/停止
   - 行パースして `Progress{kind:"lfs"}` を発火
   - abort/exit 後の確実な cleanup
56. [ ] `Repo.lfs.status()`（JSON を typed でパース）
57. [ ] `Repo.lfs.pull()`（progress/abort 対応）
58. [ ] `Repo.lfs.push()`（progress/abort 対応）
59. [ ] LFS stdout/stderr の補助パース（必要最小限）

---

## 10. libgit2 補助（後段）
60. [ ] libgit2 を使う対象コマンド選定（読み取り系等、範囲を明確化）
61. [ ] libgit2 Adapter の PoC（最小 1 コマンド）
62. [ ] CLI と libgit2 の capability 切替を実装（条件と優先順位を固定）

---

## 11. テスト拡充
63. [ ] ユニットテスト
   - argv 生成
   - status/log の stdout パーサ
   - LFS progress 行パーサ
   - エラーカテゴリ推定パターン
   - Credential provider モック
64. [ ] 結合テスト（Node）
   - clone/fetch/push の progress/abort
   - LFS リポジトリで pull/push/progress/skip-smudge/abort
65. [ ] 結合テスト（Bun/Deno）
   - まずは最小（spawn + raw + abort + progress）
   - LFS 結合は環境依存が強ければ optional 化（nightly 等）
66. [ ] CI マトリクス拡張
   - Node/Bun/Deno の単体/最小結合を常時
   - LFS 結合は別ジョブに分離（失敗許容の可否を決める）

---

## 12. パフォーマンス最適化
67. [ ] Windows コマンドライン長自動分割実装
   - バッチ操作時の 8KB 制限対応
68. [ ] diff ストリーミング API 実装（将来拡張）
   - 大量出力のメモリ効率化

---

## 13. ドキュメント・運用
69. [ ] README
   - typed と raw の境界
   - `-C workdir` による cwd 非依存
   - progress / abort の使用方法
   - LFS モード（enabled/disabled/skipSmudge）の挙動
   - Node/Bun/Deno の前提（権限や依存）
   - 環境隔離オプションの使用方法
   - Credential Helper の使用方法
70. [ ] API リファレンス（tsdoc）
71. [ ] 互換性方針
   - 対応 Git / git-lfs バージョン範囲
   - ランタイム対応範囲（Node/Bun/Deno）

---

## 14. リリース準備
72. [ ] 配布戦略確定（Node/Bun/Deno で解決可能な入口設計）
73. [ ] `exports` / サブパス export の整備（`pkg/node`, `pkg/bun`, `pkg/deno` 等）
74. [ ] ビルド成果物生成（d.ts 含む）
75. [ ] v0.1.0 リリース（MVP）

---

## 15. マイルストーン案
- M0: Adapter 境界（Exec/Fs/Capabilities）確定 + Node/Bun/Deno スモーク
- M1: CLI 実行基盤 + Abort + Git progress + raw API
- M2: Repo 型分離 + `-C workdir` 完全移行 + typed（status/log/lsRemote）
- M3: LFS progress（GIT_LFS_PROGRESS）+ lfs.status/pull/push
- M4: 環境隔離 + エラーカテゴリ + Worktree API + Credential Helper
- M5: 結合テスト整備 + v0.1.0
- M6: libgit2 補助 PoC（任意）

### 将来拡張（v0.1.0 以降）
- トランザクションサポート（2-Phase Commit パターン）
- パフォーマンス最適化（キャッシュ、LFS 並列転送）
- diff ストリーミング API

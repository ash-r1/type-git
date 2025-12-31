# Git API オプション実装計画 - 概要

## 目的

`docs/design/git-api-reference.md` に記載されたすべての Git/Git LFS オプションを type-git ライブラリに実装する。

## 現状分析

| カテゴリ | 実装済みオプション | リファレンス記載数 | 差分 |
|----------|-------------------|-------------------|------|
| MVP コマンド | ~30 | ~120 | ~90 |
| 高優先度コマンド | ~80 | ~250 | ~170 |
| 中優先度コマンド | ~40 | ~100 | ~60 |
| Config/Remote | ~15 | ~40 | ~25 |
| LFS コマンド | ~15 | ~50 | ~35 |
| **合計** | **~180** | **~560** | **~380** |

## ファイル変更概要

| ファイル | 変更内容 | 推定行数 |
|----------|----------|----------|
| `src/core/git.ts` | CloneOpts, InitOpts, LsRemoteOpts にオプション追加 | +60 |
| `src/core/repo.ts` | 全 Opts 型にオプション追加 | +350 |
| `src/impl/git-impl.ts` | clone, init, lsRemote の実装 | +80 |
| `src/impl/worktree-repo-impl.ts` | 全オプションの実装 | +600 |
| `src/impl/bare-repo-impl.ts` | fetch/push オプション | +50 |
| テストファイル | 新規オプションのテスト | +800 |

## 実装順序

1. **Phase 1**: MVP コマンド（01-mvp-commands.md）
2. **Phase 2**: 高優先度コマンド（02-high-priority-commands.md）
3. **Phase 3**: 中優先度コマンド（03-medium-priority-commands.md）
4. **Phase 4**: Config/Remote（04-config-remote.md）
5. **Phase 5**: LFS コマンド（05-lfs-commands.md）

## 除外するオプション

以下のオプションは Typed API から除外し、`raw()` API での利用に限定：

### インタラクティブオプション（stdin 必須）
- `-i, --interactive`
- `-p, --patch`
- `-e, --edit`（一部コマンド）

### GUI/表示オプション
- `--column`
- `--color`
- `--graph`

### 低レベル/サーバーオプション
- `--upload-pack`
- `--receive-pack`
- `--daemon`

## 実装パターン

```typescript
// 1. core/repo.ts で型定義
export type FetchOpts = {
  remote?: string;
  prune?: boolean;
  verbose?: boolean;  // 追加
  quiet?: boolean;    // 追加
};

// 2. impl/worktree-repo-impl.ts で実装
public async fetch(opts?: FetchOpts & ExecOpts): Promise<void> {
  const args = ['fetch'];
  if (opts?.verbose) args.push('--verbose');
  if (opts?.quiet) args.push('--quiet');
  if (opts?.prune) args.push('--prune');
  // ...
}
```

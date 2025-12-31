# Phase 3: 中優先度コマンド

## 対象ファイル
- `src/core/repo.ts` - 各種 Opts 型
- `src/impl/worktree-repo-impl.ts` - 実装

---

## 3.1 cherry-pick (WorktreeRepo.cherryPick)

### 現在の実装
```typescript
export type CherryPickOpts = {
  edit?: boolean;
  noCommit?: boolean;
  signoff?: boolean;
  mainline?: number;
  strategy?: string;
  abort?: boolean;
  continue?: boolean;
  skip?: boolean;
  noVerify?: boolean;
};
```

### 追加するオプション (+9)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `cleanup` | `'strip' \| 'whitespace' \| 'verbatim' \| 'scissors' \| 'default'` | `--cleanup=<mode>` |
| `rerereAutoupdate` | `boolean` | `--rerere-autoupdate` |
| `strategyOption` | `string \| string[]` | `-X <option>` |
| `gpgSign` | `boolean \| string` | `-S[<keyid>]` |
| `appendCommitName` | `boolean` | `-x` |
| `ff` | `boolean` | `--ff` |
| `allowEmpty` | `boolean` | `--allow-empty` |
| `allowEmptyMessage` | `boolean` | `--allow-empty-message` |
| `empty` | `'drop' \| 'keep' \| 'stop'` | `--empty=<mode>` |

---

## 3.2 clean (WorktreeRepo.clean)

### 現在の実装
```typescript
export type CleanOpts = {
  force?: boolean;
  directories?: boolean;
  ignored?: boolean;
  onlyIgnored?: boolean;
  dryRun?: boolean;
  paths?: Array<string>;
};
```

### 追加するオプション (+2)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `quiet` | `boolean` | `--quiet` |
| `exclude` | `string \| string[]` | `--exclude=<pattern>` |

---

## 3.3 mv (WorktreeRepo.mv)

### 現在の実装
```typescript
export type MvOpts = {
  force?: boolean;
  dryRun?: boolean;
};
```

### 追加するオプション (+3)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `verbose` | `boolean` | `--verbose` |
| `skipErrors` | `boolean` | `-k` |
| `sparse` | `boolean` | `--sparse` |

---

## 3.4 rebase (WorktreeRepo.rebase)

### 現在の実装
```typescript
export type RebaseOpts = {
  upstream?: string;
  onto?: string;
  interactive?: never;
  rebaseMerges?: boolean;
  abort?: boolean;
  continue?: boolean;
  skip?: boolean;
  noVerify?: boolean;
};
```

### 追加するオプション (+24)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `keepBase` | `boolean` | `--keep-base` |
| `quiet` | `boolean` | `--quiet` |
| `verbose` | `boolean` | `--verbose` |
| `signoff` | `boolean` | `--signoff` |
| `committerDateIsAuthorDate` | `boolean` | `--committer-date-is-author-date` |
| `resetAuthorDate` | `boolean` | `--reset-author-date` |
| `ignoreWhitespace` | `boolean` | `--ignore-whitespace` |
| `whitespace` | `string` | `--whitespace=<option>` |
| `forceRebase` | `boolean` | `--force-rebase` |
| `noFf` | `boolean` | `--no-ff` |
| `apply` | `boolean` | `--apply` |
| `rerereAutoupdate` | `boolean` | `--rerere-autoupdate` |
| `empty` | `'drop' \| 'keep' \| 'ask'` | `--empty=<mode>` |
| `autosquash` | `boolean` | `--autosquash` / `--no-autosquash` |
| `updateRefs` | `boolean` | `--update-refs` |
| `gpgSign` | `boolean \| string` | `-S[<keyid>]` |
| `autostash` | `boolean` | `--autostash` |
| `exec` | `string` | `--exec=<cmd>` |
| `forkPoint` | `boolean` | `--fork-point` / `--no-fork-point` |
| `strategy` | `string` | `--strategy=<strategy>` |
| `strategyOption` | `string \| string[]` | `-X <option>` |
| `root` | `boolean` | `--root` |
| `rescheduleFailedExec` | `boolean` | `--reschedule-failed-exec` |
| `reapplyCherryPicks` | `boolean` | `--reapply-cherry-picks` |

---

## 3.5 restore (WorktreeRepo.restore)

### 現在の実装
```typescript
export type RestoreOpts = {
  staged?: boolean;
  worktree?: boolean;
  source?: string;
  ours?: boolean;
  theirs?: boolean;
};
```

### 追加するオプション (+9)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `ignoreUnmerged` | `boolean` | `--ignore-unmerged` |
| `overlay` | `boolean` | `--overlay` / `--no-overlay` |
| `quiet` | `boolean` | `--quiet` |
| `recurseSubmodules` | `boolean` | `--recurse-submodules` |
| `progress` | `boolean` | `--progress` |
| `merge` | `boolean` | `--merge` |
| `conflict` | `'merge' \| 'diff3' \| 'zdiff3'` | `--conflict=<style>` |
| `ignoreSkipWorktreeBits` | `boolean` | `--ignore-skip-worktree-bits` |
| `pathspecFromFile` | `string` | `--pathspec-from-file=<file>` |

---

## 3.6 revert (WorktreeRepo.revert)

### 現在の実装
```typescript
export type RevertOpts = {
  edit?: boolean;
  noCommit?: boolean;
  mainline?: number;
  abort?: boolean;
  continue?: boolean;
  skip?: boolean;
  noVerify?: boolean;
};
```

### 追加するオプション (+7)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `cleanup` | `'strip' \| 'whitespace' \| 'verbatim' \| 'scissors' \| 'default'` | `--cleanup=<mode>` |
| `signoff` | `boolean` | `--signoff` |
| `rerereAutoupdate` | `boolean` | `--rerere-autoupdate` |
| `strategy` | `string` | `--strategy=<strategy>` |
| `strategyOption` | `string \| string[]` | `-X <option>` |
| `gpgSign` | `boolean \| string` | `-S[<keyid>]` |
| `reference` | `boolean` | `--reference` |

---

## 3.7 show (WorktreeRepo.show)

### 現在の実装
```typescript
export type ShowOpts = {
  stat?: boolean;
  nameOnly?: boolean;
  nameStatus?: boolean;
  format?: string;
};
```

### 追加するオプション (+6)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `quiet` | `boolean` | `--quiet` |
| `source` | `boolean` | `--source` |
| `useMailmap` | `boolean` | `--use-mailmap` |
| `decorateRefs` | `string` | `--decorate-refs=<pattern>` |
| `decorateRefsExclude` | `string` | `--decorate-refs-exclude=<pattern>` |
| `decorate` | `'short' \| 'full' \| 'auto' \| 'no'` | `--decorate=<style>` |

---

## 実装チェックリスト

- [ ] CherryPickOpts 追加オプション定義・実装
- [ ] CleanOpts 追加オプション定義・実装
- [ ] MvOpts 追加オプション定義・実装
- [ ] RebaseOpts 追加オプション定義・実装
- [ ] RestoreOpts 追加オプション定義・実装
- [ ] RevertOpts 追加オプション定義・実装
- [ ] ShowOpts 追加オプション定義・実装

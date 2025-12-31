# Phase 2: 高優先度コマンド

## 対象ファイル
- `src/core/repo.ts` - 各種 Opts 型
- `src/impl/worktree-repo-impl.ts` - 実装

---

## 2.1 add (WorktreeRepo.add)

### 現在の実装
```typescript
export type AddOpts = {
  all?: boolean;
  dryRun?: boolean;
  update?: boolean;
  force?: boolean;
  interactive?: never;
  patch?: never;
};
```

### 追加するオプション (+10)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `verbose` | `boolean` | `--verbose` |
| `intentToAdd` | `boolean` | `--intent-to-add` |
| `renormalize` | `boolean` | `--renormalize` |
| `ignoreRemoval` | `boolean` | `--ignore-removal` |
| `refresh` | `boolean` | `--refresh` |
| `ignoreErrors` | `boolean` | `--ignore-errors` |
| `ignoreMissing` | `boolean` | `--ignore-missing` |
| `sparse` | `boolean` | `--sparse` |
| `chmod` | `'+x' \| '-x'` | `--chmod=<mode>` |
| `pathspecFromFile` | `string` | `--pathspec-from-file=<file>` |

---

## 2.2 branch (WorktreeRepo.branch)

### 現在の実装
```typescript
export type BranchOpts = {
  all?: boolean;
  remotes?: boolean;
  verbose?: boolean;
};

export type BranchCreateOpts = {
  startPoint?: string;
  force?: boolean;
  track?: boolean;
};

export type BranchDeleteOpts = {
  force?: boolean;
  remote?: boolean;
};
```

### 追加するオプション (+15)

#### BranchOpts (list)
| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `quiet` | `boolean` | `--quiet` |
| `contains` | `string` | `--contains=<commit>` |
| `noContains` | `string` | `--no-contains=<commit>` |
| `abbrev` | `number` | `--abbrev=<n>` |
| `merged` | `string` | `--merged=<commit>` |
| `noMerged` | `string` | `--no-merged=<commit>` |
| `sort` | `string` | `--sort=<key>` |
| `pointsAt` | `string` | `--points-at=<object>` |
| `ignoreCase` | `boolean` | `--ignore-case` |

#### BranchCreateOpts
| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `setUpstreamTo` | `string` | `--set-upstream-to=<upstream>` |
| `createReflog` | `boolean` | `--create-reflog` |
| `recurseSubmodules` | `boolean` | `--recurse-submodules` |

### 新規メソッド
| メソッド | 説明 |
|----------|------|
| `branch.copy(src, dst, opts)` | ブランチをコピー |
| `branch.unsetUpstream(name)` | upstream 設定を解除 |

---

## 2.3 checkout (WorktreeRepo.checkout)

### 現在の実装
```typescript
export type CheckoutOpts = {
  force?: boolean;
  createBranch?: boolean;
  startPoint?: string;
  track?: boolean;
};
```

### 追加するオプション (+15)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `forceCreateBranch` | `boolean` | `-B` |
| `createReflog` | `boolean` | `-l` |
| `guess` | `boolean` | `--guess` / `--no-guess` |
| `overlay` | `boolean` | `--overlay` / `--no-overlay` |
| `quiet` | `boolean` | `--quiet` |
| `recurseSubmodules` | `boolean` | `--recurse-submodules` |
| `merge` | `boolean` | `--merge` |
| `conflict` | `'merge' \| 'diff3' \| 'zdiff3'` | `--conflict=<style>` |
| `detach` | `boolean` | `--detach` |
| `orphan` | `boolean` | `--orphan` |
| `overwriteIgnore` | `boolean` | `--overwrite-ignore` |
| `ignoreOtherWorktrees` | `boolean` | `--ignore-other-worktrees` |
| `ours` | `boolean` | `--ours` |
| `theirs` | `boolean` | `--theirs` |
| `pathspecFromFile` | `string` | `--pathspec-from-file=<file>` |

---

## 2.4 commit (WorktreeRepo.commit)

### 現在の実装
```typescript
export type CommitOpts = {
  message?: string;
  allowEmpty?: boolean;
  amend?: boolean;
  all?: boolean;
  author?: string;
  date?: string | Date;
  dryRun?: boolean;
  noVerify?: boolean;
  gpgSign?: boolean;
  noGpgSign?: boolean;
};
```

### 追加するオプション (+16)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `quiet` | `boolean` | `--quiet` |
| `verbose` | `boolean` | `--verbose` |
| `file` | `string` | `--file=<file>` |
| `reeditMessage` | `string` | `--reedit-message=<commit>` |
| `reuseMessage` | `string` | `--reuse-message=<commit>` |
| `fixup` | `string` | `--fixup=<commit>` |
| `squash` | `string` | `--squash=<commit>` |
| `resetAuthor` | `boolean` | `--reset-author` |
| `trailer` | `string \| string[]` | `--trailer=<token>=<value>` |
| `signoff` | `boolean` | `--signoff` |
| `cleanup` | `'strip' \| 'whitespace' \| 'verbatim' \| 'scissors' \| 'default'` | `--cleanup=<mode>` |
| `include` | `boolean` | `--include` |
| `only` | `boolean` | `--only` |
| `noPostRewrite` | `boolean` | `--no-post-rewrite` |
| `untrackedFiles` | `'no' \| 'normal' \| 'all'` | `--untracked-files=<mode>` |
| `pathspecFromFile` | `string` | `--pathspec-from-file=<file>` |
| `allowEmptyMessage` | `boolean` | `--allow-empty-message` |

---

## 2.5 diff (WorktreeRepo.diff)

### 現在の実装
```typescript
export type DiffOpts = {
  staged?: boolean;
  stat?: boolean;
  nameOnly?: boolean;
  nameStatus?: boolean;
  context?: number;
  ignoreWhitespace?: boolean;
  paths?: Array<string>;
};
```

### 追加するオプション (+19)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `nullTerminated` | `boolean` | `-z` |
| `patch` | `boolean` | `-p` |
| `patchWithRaw` | `boolean` | `--patch-with-raw` |
| `numstat` | `boolean` | `--numstat` |
| `patchWithStat` | `boolean` | `--patch-with-stat` |
| `fullIndex` | `boolean` | `--full-index` |
| `abbrev` | `number` | `--abbrev=<n>` |
| `reverse` | `boolean` | `-R` |
| `detectRewrites` | `boolean \| string` | `-B[<n>][/<m>]` |
| `detectRenames` | `boolean \| string` | `-M[<n>]` |
| `detectCopies` | `boolean \| string` | `-C[<n>]` |
| `findCopiesHarder` | `boolean` | `--find-copies-harder` |
| `renameLimit` | `number` | `-l<n>` |
| `pickaxe` | `string` | `-S<string>` |
| `pickaxeAll` | `boolean` | `--pickaxe-all` |
| `text` | `boolean` | `--text` |
| `mergeBase` | `string` | `--merge-base=<commit>` |
| `noIndex` | `boolean` | `--no-index` |
| `wordDiff` | `'color' \| 'plain' \| 'porcelain' \| 'none'` | `--word-diff=<mode>` |

---

## 2.6 merge (WorktreeRepo.merge)

### 現在の実装
```typescript
export type MergeOpts = {
  message?: string;
  ff?: 'only' | 'no' | boolean;
  squash?: boolean;
  noCommit?: boolean;
  strategy?: string;
  strategyOption?: string | Array<string>;
  abort?: boolean;
  continue?: boolean;
  noVerify?: boolean;
};
```

### 追加するオプション (+15)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `noDiffstat` | `boolean` | `-n` |
| `stat` | `boolean` | `--stat` |
| `compactSummary` | `boolean` | `--compact-summary` |
| `log` | `boolean \| number` | `--log=<n>` |
| `cleanup` | `'strip' \| 'whitespace' \| 'verbatim' \| 'scissors' \| 'default'` | `--cleanup=<mode>` |
| `rerereAutoupdate` | `boolean` | `--rerere-autoupdate` / `--no-rerere-autoupdate` |
| `verifySignatures` | `boolean` | `--verify-signatures` |
| `verbose` | `boolean` | `--verbose` |
| `quiet` | `boolean` | `--quiet` |
| `quit` | `boolean` | `--quit` |
| `allowUnrelatedHistories` | `boolean` | `--allow-unrelated-histories` |
| `gpgSign` | `boolean \| string` | `-S[<keyid>]` |
| `autostash` | `boolean` | `--autostash` |
| `overwriteIgnore` | `boolean` | `--overwrite-ignore` |
| `signoff` | `boolean` | `--signoff` |
| `intoName` | `string` | `--into-name=<branch>` |

---

## 2.7 pull (WorktreeRepo.pull)

### 現在の実装
```typescript
export type PullOpts = {
  remote?: string;
  branch?: string;
  rebase?: boolean | 'merges' | 'interactive';
  ff?: 'only' | 'no' | boolean;
  tags?: boolean;
  prune?: boolean;
  onProgress?: (progress: GitProgress) => void;
};
```

### 追加するオプション (+30)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `verbose` | `boolean` | `--verbose` |
| `quiet` | `boolean` | `--quiet` |
| `recurseSubmodules` | `boolean \| 'yes' \| 'on-demand' \| 'no'` | `--recurse-submodules=<mode>` |
| `noStat` | `boolean` | `-n` |
| `stat` | `boolean` | `--stat` |
| `compactSummary` | `boolean` | `--compact-summary` |
| `log` | `boolean \| number` | `--log=<n>` |
| `signoff` | `boolean` | `--signoff` |
| `squash` | `boolean` | `--squash` |
| `commit` | `boolean` | `--commit` / `--no-commit` |
| `cleanup` | `string` | `--cleanup=<mode>` |
| `verify` | `boolean` | `--verify` / `--no-verify` |
| `verifySignatures` | `boolean` | `--verify-signatures` |
| `autostash` | `boolean` | `--autostash` |
| `strategy` | `string` | `--strategy=<strategy>` |
| `strategyOption` | `string \| string[]` | `-X <option>` |
| `gpgSign` | `boolean \| string` | `-S[<keyid>]` |
| `allowUnrelatedHistories` | `boolean` | `--allow-unrelated-histories` |
| `all` | `boolean` | `--all` |
| `append` | `boolean` | `--append` |
| `force` | `boolean` | `--force` |
| `jobs` | `number` | `--jobs=<n>` |
| `dryRun` | `boolean` | `--dry-run` |
| `keep` | `boolean` | `--keep` |
| `depth` | `number` | `--depth=<n>` |
| `shallowSince` | `string \| Date` | `--shallow-since=<date>` |
| `shallowExclude` | `string \| string[]` | `--shallow-exclude=<rev>` |
| `deepen` | `number` | `--deepen=<n>` |
| `unshallow` | `boolean` | `--unshallow` |
| `updateShallow` | `boolean` | `--update-shallow` |
| `ipv4` | `boolean` | `--ipv4` |
| `ipv6` | `boolean` | `--ipv6` |
| `setUpstream` | `boolean` | `--set-upstream` |

---

## 2.8 reset (WorktreeRepo.reset)

### 現在の実装
```typescript
export type ResetOpts = {
  mode?: 'soft' | 'mixed' | 'hard' | 'merge' | 'keep';
};
```

### 追加するオプション (+5)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `quiet` | `boolean` | `--quiet` |
| `noRefresh` | `boolean` | `--no-refresh` |
| `recurseSubmodules` | `boolean` | `--recurse-submodules` |
| `intentToAdd` | `boolean` | `--intent-to-add` |
| `pathspecFromFile` | `string` | `--pathspec-from-file=<file>` |

---

## 2.9 rm (WorktreeRepo.rm)

### 現在の実装
```typescript
export type RmOpts = {
  force?: boolean;
  cached?: boolean;
  recursive?: boolean;
  dryRun?: boolean;
};
```

### 追加するオプション (+4)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `quiet` | `boolean` | `--quiet` |
| `ignoreUnmatch` | `boolean` | `--ignore-unmatch` |
| `sparse` | `boolean` | `--sparse` |
| `pathspecFromFile` | `string` | `--pathspec-from-file=<file>` |

---

## 2.10 stash (WorktreeRepo.stash)

### 現在の実装
```typescript
export type StashPushOpts = {
  message?: string;
  includeUntracked?: boolean;
  keepIndex?: boolean;
  paths?: Array<string>;
};

export type StashApplyOpts = {
  index?: number;
  reinstateIndex?: boolean;
};
```

### 追加するオプション (+5)

#### StashPushOpts
| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `staged` | `boolean` | `--staged` |
| `quiet` | `boolean` | `--quiet` |
| `all` | `boolean` | `--all` |
| `pathspecFromFile` | `string` | `--pathspec-from-file=<file>` |

### 新規メソッド
| メソッド | 説明 |
|----------|------|
| `stash.show(index, opts)` | stash の差分を表示 |
| `stash.branch(name, index)` | stash からブランチを作成 |

---

## 2.11 switch (WorktreeRepo.switch)

### 現在の実装
```typescript
export type SwitchOpts = {
  create?: boolean;
  forceCreate?: boolean;
  discard?: boolean;
  startPoint?: string;
  track?: boolean;
  detach?: boolean;
};
```

### 追加するオプション (+9)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `guess` | `boolean` | `--guess` / `--no-guess` |
| `quiet` | `boolean` | `--quiet` |
| `recurseSubmodules` | `boolean` | `--recurse-submodules` |
| `merge` | `boolean` | `--merge` |
| `conflict` | `'merge' \| 'diff3' \| 'zdiff3'` | `--conflict=<style>` |
| `force` | `boolean` | `--force` |
| `orphan` | `boolean` | `--orphan` |
| `overwriteIgnore` | `boolean` | `--overwrite-ignore` |
| `ignoreOtherWorktrees` | `boolean` | `--ignore-other-worktrees` |

---

## 2.12 tag (WorktreeRepo.tag)

### 現在の実装
```typescript
export type TagListOpts = {
  pattern?: string;
  sort?: string;
};

export type TagCreateOpts = {
  message?: string;
  force?: boolean;
  commit?: string;
  sign?: boolean;
};
```

### 追加するオプション (+12)

#### TagListOpts
| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `lines` | `number` | `-n<n>` |
| `contains` | `string` | `--contains=<commit>` |
| `noContains` | `string` | `--no-contains=<commit>` |
| `merged` | `string` | `--merged=<commit>` |
| `noMerged` | `string` | `--no-merged=<commit>` |
| `pointsAt` | `string` | `--points-at=<object>` |
| `ignoreCase` | `boolean` | `--ignore-case` |

#### TagCreateOpts
| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `file` | `string` | `--file=<file>` |
| `trailer` | `string \| string[]` | `--trailer=<token>=<value>` |
| `cleanup` | `string` | `--cleanup=<mode>` |
| `localUser` | `string` | `--local-user=<keyid>` |
| `createReflog` | `boolean` | `--create-reflog` |

### 新規メソッド
| メソッド | 説明 |
|----------|------|
| `tag.verify(name)` | タグの GPG 署名を検証 |

---

## 実装チェックリスト

- [ ] AddOpts 追加オプション定義・実装
- [ ] BranchOpts 追加オプション定義・実装
- [ ] BranchCreateOpts 追加オプション定義・実装
- [ ] branch.copy() メソッド追加
- [ ] branch.unsetUpstream() メソッド追加
- [ ] CheckoutOpts 追加オプション定義・実装
- [ ] CommitOpts 追加オプション定義・実装
- [ ] DiffOpts 追加オプション定義・実装
- [ ] MergeOpts 追加オプション定義・実装
- [ ] PullOpts 追加オプション定義・実装
- [ ] ResetOpts 追加オプション定義・実装
- [ ] RmOpts 追加オプション定義・実装
- [ ] StashPushOpts 追加オプション定義・実装
- [ ] stash.show() メソッド追加
- [ ] stash.branch() メソッド追加
- [ ] SwitchOpts 追加オプション定義・実装
- [ ] TagListOpts 追加オプション定義・実装
- [ ] TagCreateOpts 追加オプション定義・実装
- [ ] tag.verify() メソッド追加

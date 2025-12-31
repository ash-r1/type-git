# Phase 1: MVP コマンド

## 対象ファイル
- `src/core/git.ts` - CloneOpts, InitOpts, LsRemoteOpts
- `src/core/repo.ts` - StatusOpts, LogOpts, FetchOpts, PushOpts
- `src/impl/git-impl.ts` - clone, init, lsRemote 実装
- `src/impl/worktree-repo-impl.ts` - status, log, fetch, push 実装

---

## 1.1 clone (Git.clone)

### 現在の実装
```typescript
export type CloneOpts = {
  bare?: boolean;
  depth?: number;
  branch?: string;
  singleBranch?: boolean;
  mirror?: boolean;
  noCheckout?: boolean;
  recurseSubmodules?: boolean;
  separateGitDir?: string;
  cleanupOnAbort?: boolean;
};
```

### 追加するオプション (+22)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `verbose` | `boolean` | `--verbose` |
| `quiet` | `boolean` | `--quiet` |
| `rejectShallow` | `boolean` | `--reject-shallow` |
| `local` | `boolean` | `--local` |
| `noHardlinks` | `boolean` | `--no-hardlinks` |
| `shared` | `boolean` | `--shared` |
| `jobs` | `number` | `--jobs=<n>` |
| `template` | `string` | `--template=<dir>` |
| `reference` | `string` | `--reference=<repo>` |
| `referenceIfAble` | `string` | `--reference-if-able=<repo>` |
| `dissociate` | `boolean` | `--dissociate` |
| `origin` | `string` | `--origin=<name>` |
| `shallowSince` | `string \| Date` | `--shallow-since=<date>` |
| `shallowExclude` | `string \| string[]` | `--shallow-exclude=<rev>` |
| `tags` | `boolean` | `--tags` / `--no-tags` |
| `shallowSubmodules` | `boolean` | `--shallow-submodules` |
| `config` | `Record<string, string>` | `-c <key>=<value>` |
| `ipv4` | `boolean` | `--ipv4` |
| `ipv6` | `boolean` | `--ipv6` |
| `filter` | `string` | `--filter=<spec>` |
| `alsoFilterSubmodules` | `boolean` | `--also-filter-submodules` |
| `remoteSubmodules` | `boolean` | `--remote-submodules` |
| `sparse` | `boolean` | `--sparse` |

---

## 1.2 init (Git.init)

### 現在の実装
```typescript
export type InitOpts = {
  bare?: boolean;
  initialBranch?: string;
  separateGitDir?: string;
  cleanupOnAbort?: boolean;
};
```

### 追加するオプション (+4)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `template` | `string` | `--template=<dir>` |
| `shared` | `boolean \| 'group' \| 'all' \| 'world' \| 'everybody' \| number` | `--shared` |
| `quiet` | `boolean` | `--quiet` |
| `objectFormat` | `'sha1' \| 'sha256'` | `--object-format=<format>` |

---

## 1.3 ls-remote (Git.lsRemote)

### 現在の実装
```typescript
export type LsRemoteOpts = {
  heads?: boolean;
  tags?: boolean;
  refs?: boolean;
};
```

### 追加するオプション (+3)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `getUrl` | `boolean` | `--get-url` |
| `sort` | `string` | `--sort=<key>` |
| `symref` | `boolean` | `--symref` |

---

## 1.4 status (WorktreeRepo.status)

### 現在の実装
```typescript
export type StatusOpts = {
  porcelain?: 1 | 2;
  untracked?: 'no' | 'normal' | 'all';
};
```

### 追加するオプション (+8)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `verbose` | `boolean` | `--verbose` |
| `showStash` | `boolean` | `--show-stash` |
| `aheadBehind` | `boolean` | `--ahead-behind` / `--no-ahead-behind` |
| `nullTerminated` | `boolean` | `-z` |
| `ignored` | `'traditional' \| 'no' \| 'matching'` | `--ignored=<mode>` |
| `ignoreSubmodules` | `'none' \| 'untracked' \| 'dirty' \| 'all'` | `--ignore-submodules=<when>` |
| `noRenames` | `boolean` | `--no-renames` |
| `findRenames` | `boolean \| number` | `-M<n>` |

---

## 1.5 log (WorktreeRepo.log)

### 現在の実装
```typescript
export type LogOpts = {
  maxCount?: number;
  skip?: number;
  since?: string | Date;
  until?: string | Date;
  author?: string;
  grep?: string;
  all?: boolean;
  firstParent?: boolean;
};
```

### 追加するオプション (+14)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `source` | `boolean` | `--source` |
| `useMailmap` | `boolean` | `--use-mailmap` |
| `decorateRefs` | `string` | `--decorate-refs=<pattern>` |
| `decorateRefsExclude` | `string` | `--decorate-refs-exclude=<pattern>` |
| `decorate` | `'short' \| 'full' \| 'auto' \| 'no'` | `--decorate=<style>` |
| `stat` | `boolean` | `--stat` |
| `shortstat` | `boolean` | `--shortstat` |
| `nameOnly` | `boolean` | `--name-only` |
| `nameStatus` | `boolean` | `--name-status` |
| `merges` | `boolean` | `--merges` |
| `noMerges` | `boolean` | `--no-merges` |
| `ancestryPath` | `boolean` | `--ancestry-path` |
| `reverse` | `boolean` | `--reverse` |
| `after` | `string \| Date` | `--after=<date>` |
| `before` | `string \| Date` | `--before=<date>` |

---

## 1.6 fetch (WorktreeRepo.fetch)

### 現在の実装
```typescript
export type FetchOpts = {
  remote?: string;
  refspec?: string | Array<string>;
  prune?: boolean;
  tags?: boolean;
  depth?: number;
};
```

### 追加するオプション (+28)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `verbose` | `boolean` | `--verbose` |
| `quiet` | `boolean` | `--quiet` |
| `all` | `boolean` | `--all` |
| `setUpstream` | `boolean` | `--set-upstream` |
| `append` | `boolean` | `--append` |
| `atomic` | `boolean` | `--atomic` |
| `force` | `boolean` | `--force` |
| `multiple` | `boolean` | `--multiple` |
| `noTags` | `boolean` | `--no-tags` |
| `jobs` | `number` | `--jobs=<n>` |
| `prefetch` | `boolean` | `--prefetch` |
| `pruneTags` | `boolean` | `--prune-tags` |
| `recurseSubmodules` | `boolean \| 'yes' \| 'on-demand' \| 'no'` | `--recurse-submodules=<mode>` |
| `dryRun` | `boolean` | `--dry-run` |
| `writeFetchHead` | `boolean` | `--write-fetch-head` / `--no-write-fetch-head` |
| `keep` | `boolean` | `--keep` |
| `updateHeadOk` | `boolean` | `--update-head-ok` |
| `shallowSince` | `string \| Date` | `--shallow-since=<date>` |
| `shallowExclude` | `string \| string[]` | `--shallow-exclude=<rev>` |
| `deepen` | `number` | `--deepen=<depth>` |
| `unshallow` | `boolean` | `--unshallow` |
| `refetch` | `boolean` | `--refetch` |
| `updateShallow` | `boolean` | `--update-shallow` |
| `refmap` | `string` | `--refmap=<refspec>` |
| `ipv4` | `boolean` | `--ipv4` |
| `ipv6` | `boolean` | `--ipv6` |
| `filter` | `string` | `--filter=<spec>` |
| `showForcedUpdates` | `boolean` | `--show-forced-updates` / `--no-show-forced-updates` |
| `writeCommitGraph` | `boolean` | `--write-commit-graph` |

---

## 1.7 push (WorktreeRepo.push)

### 現在の実装
```typescript
export type PushOpts = {
  remote?: string;
  refspec?: string | Array<string>;
  force?: boolean;
  forceWithLease?: boolean | ForceWithLeaseOpts;
  tags?: boolean;
  setUpstream?: boolean;
  noVerify?: boolean;
  signed?: boolean | 'if-asked';
};
```

### 追加するオプション (+17)

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `verbose` | `boolean` | `--verbose` |
| `quiet` | `boolean` | `--quiet` |
| `repo` | `string` | `--repo=<repo>` |
| `all` | `boolean` | `--all` |
| `branches` | `boolean` | `--branches` |
| `mirror` | `boolean` | `--mirror` |
| `deleteRefs` | `boolean` | `--delete` |
| `dryRun` | `boolean` | `--dry-run` |
| `forceIfIncludes` | `boolean` | `--force-if-includes` |
| `recurseSubmodules` | `'check' \| 'on-demand' \| 'only' \| 'no'` | `--recurse-submodules=<mode>` |
| `thin` | `boolean` | `--thin` / `--no-thin` |
| `prune` | `boolean` | `--prune` |
| `followTags` | `boolean` | `--follow-tags` |
| `atomic` | `boolean` | `--atomic` |
| `pushOption` | `string \| string[]` | `-o <option>` |
| `ipv4` | `boolean` | `--ipv4` |
| `ipv6` | `boolean` | `--ipv6` |

---

## 実装チェックリスト

- [ ] `src/core/git.ts` に CloneOpts 追加オプションを定義
- [ ] `src/core/git.ts` に InitOpts 追加オプションを定義
- [ ] `src/core/git.ts` に LsRemoteOpts 追加オプションを定義
- [ ] `src/core/repo.ts` に StatusOpts 追加オプションを定義
- [ ] `src/core/repo.ts` に LogOpts 追加オプションを定義
- [ ] `src/core/repo.ts` に FetchOpts 追加オプションを定義
- [ ] `src/core/repo.ts` に PushOpts 追加オプションを定義
- [ ] `src/impl/git-impl.ts` に clone オプション実装
- [ ] `src/impl/git-impl.ts` に init オプション実装
- [ ] `src/impl/git-impl.ts` に lsRemote オプション実装
- [ ] `src/impl/worktree-repo-impl.ts` に status オプション実装
- [ ] `src/impl/worktree-repo-impl.ts` に log オプション実装
- [ ] `src/impl/worktree-repo-impl.ts` に fetch オプション実装
- [ ] `src/impl/worktree-repo-impl.ts` に push オプション実装
- [ ] `docs/design/git-api-reference.md` のステータス更新

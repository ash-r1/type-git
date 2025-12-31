# Phase 5: LFS コマンド

## 対象ファイル
- `src/core/repo.ts` - LfsOperations, LfsExtraOperations, 新規 Opts 型
- `src/impl/worktree-repo-impl.ts` - 実装

---

## 5.1 lfs fetch

### 現在の実装
内部的に使用されているが、直接公開されていない。

### 追加する公開メソッド

```typescript
/**
 * Options for LFS fetch
 */
export type LfsFetchOpts = {
  /** Fetch all LFS objects for all refs */
  all?: boolean;
  /** Include patterns */
  include?: string[];
  /** Exclude patterns */
  exclude?: string[];
  /** Only fetch recent objects */
  recent?: boolean;
  /** Prune old objects after fetch */
  prune?: boolean;
  /** Refetch objects even if already local */
  refetch?: boolean;
  /** Dry run - show what would be fetched */
  dryRun?: boolean;
  /** Output in JSON format */
  json?: boolean;
};
```

### LfsOperations に追加
| メソッド | 説明 |
|----------|------|
| `fetch(opts?: LfsFetchOpts)` | LFS オブジェクトをフェッチ |

---

## 5.2 lfs install

### 新規メソッド

```typescript
/**
 * Options for LFS install
 */
export type LfsInstallOpts = {
  /** Overwrite existing hooks */
  force?: boolean;
  /** Install for local repository only */
  local?: boolean;
  /** Install for worktree only */
  worktree?: boolean;
  /** Print commands instead of executing */
  manual?: boolean;
  /** Install for all users */
  system?: boolean;
  /** Skip smudge filter (don't download during checkout) */
  skipSmudge?: boolean;
  /** Skip repository setup */
  skipRepo?: boolean;
};
```

### LfsOperations に追加
| メソッド | 説明 |
|----------|------|
| `install(opts?: LfsInstallOpts)` | Git LFS を設定 |

---

## 5.3 lfs uninstall

### 新規メソッド

```typescript
/**
 * Options for LFS uninstall
 */
export type LfsUninstallOpts = {
  /** Uninstall for local repository only */
  local?: boolean;
  /** Uninstall for worktree only */
  worktree?: boolean;
  /** Uninstall for all users */
  system?: boolean;
  /** Skip repository cleanup */
  skipRepo?: boolean;
};
```

### LfsOperations に追加
| メソッド | 説明 |
|----------|------|
| `uninstall(opts?: LfsUninstallOpts)` | Git LFS を削除 |

---

## 5.4 lfs ls-files

### 新規メソッド

```typescript
/**
 * LFS file entry
 */
export type LfsFileEntry = {
  /** File path */
  path: string;
  /** Object ID (SHA-256) */
  oid: string;
  /** File size in bytes */
  size?: number;
  /** Whether file is downloaded locally */
  downloaded: boolean;
};

/**
 * Options for LFS ls-files
 */
export type LfsLsFilesOpts = {
  /** Show full OID (not abbreviated) */
  long?: boolean;
  /** Show file sizes */
  size?: boolean;
  /** Show debug information */
  debug?: boolean;
  /** Show all LFS files (not just current ref) */
  all?: boolean;
  /** Show deleted files */
  deleted?: boolean;
  /** Include patterns */
  include?: string[];
  /** Exclude patterns */
  exclude?: string[];
  /** Show filenames only */
  nameOnly?: boolean;
  /** Output in JSON format */
  json?: boolean;
};
```

### LfsOperations に追加
| メソッド | 説明 |
|----------|------|
| `lsFiles(ref?: string, opts?: LfsLsFilesOpts)` | LFS 追跡ファイルを一覧表示 |

---

## 5.5 lfs track

### 新規メソッド

```typescript
/**
 * Options for LFS track
 */
export type LfsTrackOpts = {
  /** Show verbose output */
  verbose?: boolean;
  /** Dry run - show what would be tracked */
  dryRun?: boolean;
  /** Treat pattern as filename, not glob */
  filename?: boolean;
  /** Make files lockable */
  lockable?: boolean;
  /** Make files not lockable */
  notLockable?: boolean;
  /** Don't exclude from export */
  noExcluded?: boolean;
  /** Don't modify .gitattributes */
  noModifyAttrs?: boolean;
};

/**
 * LFS track entry
 */
export type LfsTrackEntry = {
  /** Pattern being tracked */
  pattern: string;
  /** Whether files matching pattern are lockable */
  lockable: boolean;
};
```

### LfsOperations に追加
| メソッド | 説明 |
|----------|------|
| `track(patterns: string[], opts?: LfsTrackOpts)` | パターンを LFS 追跡に追加 |
| `trackList(opts?: ExecOpts)` | 追跡パターンを一覧表示 |

---

## 5.6 lfs untrack

### 新規メソッド

### LfsOperations に追加
| メソッド | 説明 |
|----------|------|
| `untrack(patterns: string[])` | パターンを LFS 追跡から削除 |

---

## 5.7 lfs lock/unlock/locks

### 新規メソッド

```typescript
/**
 * LFS lock entry
 */
export type LfsLockEntry = {
  /** Lock ID */
  id: string;
  /** Locked file path */
  path: string;
  /** Lock owner */
  owner: {
    name: string;
  };
  /** Lock timestamp */
  lockedAt: Date;
};

/**
 * Options for LFS lock
 */
export type LfsLockOpts = {
  /** Remote name */
  remote?: string;
  /** Output in JSON format */
  json?: boolean;
};

/**
 * Options for LFS unlock
 */
export type LfsUnlockOpts = {
  /** Remote name */
  remote?: string;
  /** Force unlock (even if owned by another user) */
  force?: boolean;
  /** Unlock by ID instead of path */
  id?: string;
  /** Output in JSON format */
  json?: boolean;
};

/**
 * Options for LFS locks
 */
export type LfsLocksOpts = {
  /** Remote name */
  remote?: string;
  /** Filter by lock ID */
  id?: string;
  /** Filter by path */
  path?: string;
  /** Show local cache only */
  local?: boolean;
  /** Show cached locks */
  cached?: boolean;
  /** Verify locks with server */
  verify?: boolean;
  /** Limit number of results */
  limit?: number;
  /** Output in JSON format */
  json?: boolean;
};
```

### LfsOperations に追加
| メソッド | 説明 |
|----------|------|
| `lock(path: string, opts?: LfsLockOpts)` | ファイルをロック |
| `unlock(path: string, opts?: LfsUnlockOpts)` | ファイルのロックを解除 |
| `locks(opts?: LfsLocksOpts)` | ロック一覧を表示 |

---

## 5.8 lfs checkout

### 現在の実装
なし

### 新規メソッド

```typescript
/**
 * Options for LFS checkout
 */
export type LfsCheckoutOpts = {
  /** Use base version for conflicts */
  base?: boolean;
  /** Use ours version for conflicts */
  ours?: boolean;
  /** Use theirs version for conflicts */
  theirs?: boolean;
  /** Write to file instead of working tree */
  to?: string;
};
```

### LfsOperations に追加
| メソッド | 説明 |
|----------|------|
| `checkout(paths?: string[], opts?: LfsCheckoutOpts)` | LFS ファイルをチェックアウト |

---

## 5.9 lfs migrate

### 新規メソッド

```typescript
/**
 * Options for LFS migrate info
 */
export type LfsMigrateInfoOpts = {
  /** Only show files above this size */
  above?: string;
  /** Show top N files */
  top?: number;
  /** Size unit (b, kb, mb, gb) */
  unit?: 'b' | 'kb' | 'mb' | 'gb';
  /** Show pointer files */
  pointers?: 'follow' | 'no-follow' | 'ignore';
  /** Fix up tracking patterns */
  fixup?: boolean;
  /** Include patterns */
  include?: string[];
  /** Exclude patterns */
  exclude?: string[];
  /** Include refs */
  includeRef?: string[];
  /** Exclude refs */
  excludeRef?: string[];
  /** Skip fetching from remote */
  skipFetch?: boolean;
  /** Operate on all refs */
  everything?: boolean;
};

/**
 * Options for LFS migrate import
 */
export type LfsMigrateImportOpts = LfsMigrateInfoOpts & {
  /** Show verbose output */
  verbose?: boolean;
  /** Write object map file */
  objectMap?: string;
  /** Don't rewrite history */
  noRewrite?: boolean;
  /** Commit message for fixup */
  message?: string;
};

/**
 * Options for LFS migrate export
 */
export type LfsMigrateExportOpts = LfsMigrateInfoOpts & {
  /** Show verbose output */
  verbose?: boolean;
  /** Write object map file */
  objectMap?: string;
  /** Remote name */
  remote?: string;
};
```

### LfsOperations に追加
| メソッド | 説明 |
|----------|------|
| `migrateInfo(opts?: LfsMigrateInfoOpts)` | 移行情報を表示 |
| `migrateImport(opts?: LfsMigrateImportOpts)` | LFS に移行 |
| `migrateExport(opts?: LfsMigrateExportOpts)` | LFS から移行 |

---

## 5.10 既存 LFS コマンドの強化

### lfs pull 追加オプション
現在: `remote`, `ref`, `include`, `exclude`

追加なし（現在の実装で十分）

### lfs push 追加オプション
現在: `remote`, `ref`

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `dryRun` | `boolean` | `--dry-run` |
| `objectId` | `boolean` | `--object-id` |
| `stdin` | `boolean` | `--stdin` |

### lfs status 追加オプション
現在: `json`

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `porcelain` | `boolean` | `--porcelain` |

### lfs prune 追加オプション
現在: `force`, `dryRun`, `verifyRemote`, `verifyUnreferenced`

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `recent` | `boolean` | `--recent` |
| `verbose` | `boolean` | `--verbose` |
| `whenUnverified` | `'panic' \| 'ignore'` | `--when-unverified=<mode>` |

---

## 5.11 lfs env

### 新規メソッド

```typescript
/**
 * LFS environment info
 */
export type LfsEnvInfo = {
  /** LFS version */
  version: string;
  /** Git version */
  gitVersion: string;
  /** Endpoint URL */
  endpoint: string;
  /** SSH endpoint */
  sshEndpoint?: string;
  /** Local media directory */
  localMediaDir: string;
  /** Local reference directory */
  localReferenceDir?: string;
  /** Temp directory */
  tempDir: string;
  /** Concurrent transfers */
  concurrentTransfers: number;
  /** TLS verify */
  tlsVerify: boolean;
  /** Batch enabled */
  batchEnabled: boolean;
};
```

### LfsOperations に追加
| メソッド | 説明 |
|----------|------|
| `env(opts?: ExecOpts)` | LFS 環境情報を取得 |

---

## 5.12 lfs version

### LfsOperations に追加
| メソッド | 説明 |
|----------|------|
| `version(opts?: ExecOpts)` | LFS バージョンを取得 |

---

## 更新後の LfsOperations インターフェース

```typescript
export interface LfsOperations {
  // 既存
  pull(opts?: LfsPullOpts & ExecOpts): Promise<void>;
  push(opts?: LfsPushOpts & ExecOpts): Promise<void>;
  status(opts?: LfsStatusOpts & ExecOpts): Promise<LfsStatus>;
  prune(opts?: LfsPruneOpts & ExecOpts): Promise<void>;

  // 新規
  fetch(opts?: LfsFetchOpts & ExecOpts): Promise<void>;
  install(opts?: LfsInstallOpts & ExecOpts): Promise<void>;
  uninstall(opts?: LfsUninstallOpts & ExecOpts): Promise<void>;
  lsFiles(ref?: string, opts?: LfsLsFilesOpts & ExecOpts): Promise<LfsFileEntry[]>;
  track(patterns: string[], opts?: LfsTrackOpts & ExecOpts): Promise<void>;
  trackList(opts?: ExecOpts): Promise<LfsTrackEntry[]>;
  untrack(patterns: string[], opts?: ExecOpts): Promise<void>;
  lock(path: string, opts?: LfsLockOpts & ExecOpts): Promise<LfsLockEntry>;
  unlock(path: string, opts?: LfsUnlockOpts & ExecOpts): Promise<void>;
  locks(opts?: LfsLocksOpts & ExecOpts): Promise<LfsLockEntry[]>;
  checkout(paths?: string[], opts?: LfsCheckoutOpts & ExecOpts): Promise<void>;
  migrateInfo(opts?: LfsMigrateInfoOpts & ExecOpts): Promise<string>;
  migrateImport(opts?: LfsMigrateImportOpts & ExecOpts): Promise<void>;
  migrateExport(opts?: LfsMigrateExportOpts & ExecOpts): Promise<void>;
  env(opts?: ExecOpts): Promise<LfsEnvInfo>;
  version(opts?: ExecOpts): Promise<string>;
}
```

---

## 実装チェックリスト

### 新規メソッド
- [ ] lfs.fetch() メソッド追加
- [ ] lfs.install() メソッド追加
- [ ] lfs.uninstall() メソッド追加
- [ ] lfs.lsFiles() メソッド追加
- [ ] lfs.track() メソッド追加
- [ ] lfs.trackList() メソッド追加
- [ ] lfs.untrack() メソッド追加
- [ ] lfs.lock() メソッド追加
- [ ] lfs.unlock() メソッド追加
- [ ] lfs.locks() メソッド追加
- [ ] lfs.checkout() メソッド追加
- [ ] lfs.migrateInfo() メソッド追加
- [ ] lfs.migrateImport() メソッド追加
- [ ] lfs.migrateExport() メソッド追加
- [ ] lfs.env() メソッド追加
- [ ] lfs.version() メソッド追加

### 既存メソッドの強化
- [ ] LfsPushOpts に dryRun, objectId 追加
- [ ] LfsStatusOpts に porcelain 追加
- [ ] LfsPruneOpts に recent, verbose, whenUnverified 追加

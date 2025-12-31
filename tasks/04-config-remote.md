# Phase 4: Config/Remote コマンド

## 対象ファイル
- `src/core/repo.ts` - ConfigOperations, RemoteOperations
- `src/impl/worktree-repo-impl.ts` - 実装

---

## 4.1 config (WorktreeRepo.config)

### 現在の実装

```typescript
export interface ConfigOperations {
  get<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<ConfigSchema[K] | undefined>;
  getAll<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<Array<ConfigSchema[K]>>;
  set<K extends ConfigKey>(key: K, value: ConfigSchema[K], opts?: ExecOpts): Promise<void>;
  add<K extends ConfigKey>(key: K, value: ConfigSchema[K], opts?: ExecOpts): Promise<void>;
  unset<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<void>;
  getRaw(key: string, opts?: ConfigGetOpts & ExecOpts): Promise<string | Array<string> | undefined>;
  setRaw(key: string, value: string, opts?: ConfigSetOpts & ExecOpts): Promise<void>;
  unsetRaw(key: string, opts?: ExecOpts): Promise<void>;
  list(opts?: ConfigListOpts & ExecOpts): Promise<Array<ConfigEntry>>;
}
```

### 追加するメソッド/オプション (+6)

#### 新規メソッド
| メソッド | 説明 | Git コマンド |
|----------|------|-------------|
| `renameSection(oldName, newName)` | セクション名を変更 | `git config --rename-section` |
| `removeSection(name)` | セクションを削除 | `git config --remove-section` |

#### ConfigGetOpts 追加オプション
| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `type` | `'bool' \| 'int' \| 'bool-or-int' \| 'path' \| 'expiry-date' \| 'color'` | `--type=<type>` |
| `default` | `string` | `--default=<value>` |

#### ConfigListOpts 追加オプション
| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `includes` | `boolean` | `--includes` |
| `nameOnly` | `boolean` | `--name-only` |

---

## 4.2 remote (WorktreeRepo.remote)

### 現在の実装

```typescript
export interface RemoteOperations {
  list(opts?: ExecOpts): Promise<Array<RemoteInfo>>;
  add(name: string, url: string, opts?: RemoteAddOpts & ExecOpts): Promise<void>;
  remove(name: string, opts?: ExecOpts): Promise<void>;
  rename(oldName: string, newName: string, opts?: ExecOpts): Promise<void>;
  getUrl(name: string, opts?: RemoteUrlOpts & ExecOpts): Promise<string>;
  setUrl(name: string, url: string, opts?: RemoteUrlOpts & ExecOpts): Promise<void>;
}
```

### 追加するメソッド (+5)

| メソッド | 説明 | Git コマンド |
|----------|------|-------------|
| `setHead(remote, opts)` | リモートの HEAD を設定 | `git remote set-head` |
| `show(remote, opts)` | リモートの詳細情報を表示 | `git remote show` |
| `prune(remote, opts)` | 削除されたリモートブランチの参照を削除 | `git remote prune` |
| `update(remotes, opts)` | リモートを更新 | `git remote update` |
| `setBranches(remote, branches, opts)` | 追跡するブランチを設定 | `git remote set-branches` |

### 新規 Opts 型

```typescript
/**
 * Options for remote set-head
 */
export type RemoteSetHeadOpts = {
  /** Automatically determine remote HEAD */
  auto?: boolean;
  /** Delete the symbolic-ref for remote HEAD */
  delete?: boolean;
};

/**
 * Options for remote show
 */
export type RemoteShowOpts = {
  /** Do not query remote heads */
  noQuery?: boolean;
};

/**
 * Options for remote prune
 */
export type RemotePruneOpts = {
  /** Dry run - show what would be pruned */
  dryRun?: boolean;
};

/**
 * Options for remote update
 */
export type RemoteUpdateOpts = {
  /** Prune remote-tracking branches */
  prune?: boolean;
};

/**
 * Options for remote set-branches
 */
export type RemoteSetBranchesOpts = {
  /** Add branches instead of replacing */
  add?: boolean;
};
```

### RemoteAddOpts 追加オプション

| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `tags` | `boolean` | `--tags` / `--no-tags` |

---

## 4.3 worktree (WorktreeRepo.worktree)

### 現在の実装

```typescript
export interface WorktreeOperations {
  list(opts?: ExecOpts): Promise<Array<Worktree>>;
  add(path: string, opts?: WorktreeAddOpts & ExecOpts): Promise<void>;
  remove(path: string, opts?: WorktreeRemoveOpts & ExecOpts): Promise<void>;
  prune(opts?: WorktreePruneOpts & ExecOpts): Promise<Array<string>>;
  lock(path: string, opts?: WorktreeLockOpts & ExecOpts): Promise<void>;
  unlock(path: string, opts?: ExecOpts): Promise<void>;
}
```

### 追加するメソッド/オプション

#### WorktreeAddOpts 追加オプション (+4)
| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `force` | `boolean` | `--force` |
| `checkout` | `boolean` | `--checkout` / `--no-checkout` |
| `lock` | `boolean` | `--lock` |
| `orphan` | `boolean` | `--orphan` |

#### WorktreePruneOpts 追加オプション (+1)
| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `expire` | `string` | `--expire=<time>` |

#### 新規メソッド
| メソッド | 説明 | Git コマンド |
|----------|------|-------------|
| `move(src, dst)` | worktree を移動 | `git worktree move` |
| `repair(paths)` | worktree の参照を修復 | `git worktree repair` |

---

## 4.4 submodule (WorktreeRepo.submodule)

### 現在の実装

```typescript
export interface SubmoduleOperations {
  list(opts?: ExecOpts): Promise<Array<SubmoduleInfo>>;
  init(paths?: Array<string>, opts?: ExecOpts): Promise<void>;
  update(opts?: SubmoduleOpts & ExecOpts): Promise<void>;
  add(url: string, path: string, opts?: ExecOpts): Promise<void>;
  deinit(path: string, opts?: ExecOpts): Promise<void>;
}
```

### 追加するメソッド/オプション

#### SubmoduleOpts (update) 追加オプション (+8)
| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `noFetch` | `boolean` | `--no-fetch` |
| `checkout` | `boolean` | `--checkout` |
| `merge` | `boolean` | `--merge` |
| `rebase` | `boolean` | `--rebase` |
| `recommendShallow` | `boolean` | `--recommend-shallow` |
| `reference` | `string` | `--reference=<repo>` |
| `singleBranch` | `boolean` | `--single-branch` |
| `filter` | `string` | `--filter=<spec>` |

#### SubmoduleAddOpts 新規型
```typescript
export type SubmoduleAddOpts = {
  /** Branch to track */
  branch?: string;
  /** Force addition */
  force?: boolean;
  /** Submodule name (if different from path) */
  name?: string;
  /** Reference repository */
  reference?: string;
  /** Depth for shallow clone */
  depth?: number;
};
```

#### SubmoduleDeinitOpts 追加オプション
| オプション | 型 | Git フラグ |
|------------|-----|-----------|
| `force` | `boolean` | `--force` |
| `all` | `boolean` | `--all` |

#### 新規メソッド
| メソッド | 説明 | Git コマンド |
|----------|------|-------------|
| `status(paths, opts)` | サブモジュールの状態を表示 | `git submodule status` |
| `summary(opts)` | サブモジュールの変更サマリを表示 | `git submodule summary` |
| `foreach(command, opts)` | 各サブモジュールでコマンドを実行 | `git submodule foreach` |
| `sync(paths, opts)` | URL 設定を同期 | `git submodule sync` |
| `absorbGitDirs()` | .git ディレクトリを親に吸収 | `git submodule absorbgitdirs` |
| `setBranch(path, branch, opts)` | ブランチを設定 | `git submodule set-branch` |
| `setUrl(path, url)` | URL を設定 | `git submodule set-url` |

---

## 実装チェックリスト

### Config
- [ ] config.renameSection() メソッド追加
- [ ] config.removeSection() メソッド追加
- [ ] ConfigGetOpts に type, default 追加
- [ ] ConfigListOpts に includes, nameOnly 追加

### Remote
- [ ] remote.setHead() メソッド追加
- [ ] remote.show() メソッド追加
- [ ] remote.prune() メソッド追加
- [ ] remote.update() メソッド追加
- [ ] remote.setBranches() メソッド追加
- [ ] RemoteAddOpts に tags 追加

### Worktree
- [ ] WorktreeAddOpts に force, checkout, lock, orphan 追加
- [ ] WorktreePruneOpts に expire 追加
- [ ] worktree.move() メソッド追加
- [ ] worktree.repair() メソッド追加

### Submodule
- [ ] SubmoduleOpts 追加オプション実装
- [ ] SubmoduleAddOpts 型作成・実装
- [ ] SubmoduleDeinitOpts に force, all 追加
- [ ] submodule.status() メソッド追加
- [ ] submodule.summary() メソッド追加
- [ ] submodule.foreach() メソッド追加
- [ ] submodule.sync() メソッド追加
- [ ] submodule.absorbGitDirs() メソッド追加
- [ ] submodule.setBranch() メソッド追加
- [ ] submodule.setUrl() メソッド追加

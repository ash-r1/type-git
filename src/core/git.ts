/**
 * Core Git interface - repository-agnostic operations
 */

import type {
  BareRepo,
  ConfigEntry,
  ConfigGetOpts,
  ConfigKey,
  ConfigSchema,
  ConfigSetOpts,
  RepoBase,
  WorktreeRepo,
} from './repo.js';
import type { ExecOpts, GitOpenOptions, RawResult } from './types.js';

/**
 * Options for git clone
 */
export type CloneOpts = {
  // Existing options
  bare?: boolean;
  depth?: number;
  branch?: string;
  singleBranch?: boolean;
  mirror?: boolean;
  noCheckout?: boolean;
  recurseSubmodules?: boolean;
  /** Store .git directory at specified path instead of inside the repository */
  separateGitDir?: string;
  /**
   * Whether to clean up the target directory if the operation is aborted.
   * @default true
   */
  cleanupOnAbort?: boolean;

  // New options
  /** Be more verbose */
  verbose?: boolean;
  /** Operate quietly (suppress progress reporting) */
  quiet?: boolean;
  /** Reject cloning a shallow repository */
  rejectShallow?: boolean;
  /** Clone from a local repository (use hard links) */
  local?: boolean;
  /** Don't use hard links for local clone */
  noHardlinks?: boolean;
  /** Share objects with a reference repository */
  shared?: boolean;
  /** Number of submodules to clone in parallel */
  jobs?: number;
  /** Directory with templates for the new repository */
  template?: string;
  /** Reference repository for object sharing */
  reference?: string;
  /** Reference repository if available (no error if not) */
  referenceIfAble?: string;
  /** Disconnect from reference repository after clone */
  dissociate?: boolean;
  /** Name of the remote (default: origin) */
  origin?: string;
  /** Create a shallow clone with commits since the specified date */
  shallowSince?: string | Date;
  /** Create a shallow clone excluding commits reachable from specified revision */
  shallowExclude?: string | Array<string>;
  /** Don't clone any tags, and make later fetches not follow them */
  noTags?: boolean;
  /** Also clone submodules shallowly */
  shallowSubmodules?: boolean;
  /** Set config options for the new repository */
  config?: Record<string, string>;
  /** Use IPv4 addresses only */
  ipv4?: boolean;
  /** Use IPv6 addresses only */
  ipv6?: boolean;
  /** A partial clone filter specification (e.g., 'blob:none') */
  filter?: string;
  /** Also apply the partial clone filter to submodules */
  alsoFilterSubmodules?: boolean;
  /** Clone submodules from their remote tracking branch */
  remoteSubmodules?: boolean;
  /** Initialize sparse-checkout (clone only root files initially) */
  sparse?: boolean;
};

/**
 * Options for git init
 */
export type InitOpts = {
  // Existing options
  bare?: boolean;
  initialBranch?: string;
  /** Store .git directory at specified path instead of inside the repository */
  separateGitDir?: string;
  /**
   * Whether to clean up the target directory if the operation is aborted.
   * @default true
   */
  cleanupOnAbort?: boolean;

  // New options
  /** Directory with templates for the new repository */
  template?: string;
  /**
   * Set repository sharing level
   * - 'group': Group writable
   * - 'all'/'world'/'everybody': World readable
   * - number: Octal permissions
   */
  shared?: boolean | 'group' | 'all' | 'world' | 'everybody' | number;
  /** Operate quietly (suppress output) */
  quiet?: boolean;
  /** Specify the hash algorithm to use (sha1 or sha256) */
  objectFormat?: 'sha1' | 'sha256';
};

/**
 * Options for git ls-remote
 */
export type LsRemoteOpts = {
  // Existing options
  /** Limit to refs/heads (branches) */
  heads?: boolean;
  /** Limit to refs/tags */
  tags?: boolean;
  /** Show only actual refs (not peeled tags) */
  refs?: boolean;

  // New options
  /** Show remote URL instead of listing refs */
  getUrl?: boolean;
  /** Sort refs by the given key (e.g., 'version:refname') */
  sort?: string;
  /** Show symbolic refs in addition to object refs */
  symref?: boolean;
};

/**
 * Result from git ls-remote
 */
export type LsRemoteResult = {
  refs: Array<{
    hash: string;
    name: string;
  }>;
};

// =============================================================================
// Global Config Operations
// =============================================================================

/**
 * Options for global config list
 */
export type GlobalConfigListOpts = {
  /** Show origin of each value */
  showOrigin?: boolean;
  /** Show scope of each value */
  showScope?: boolean;
};

/**
 * Global config operations
 *
 * Wraps: `git config --global` subcommands
 *
 * Operates on ~/.gitconfig (user-level configuration).
 * Uses the same typed ConfigSchema as repository-level config.
 */
export interface GlobalConfigOperations {
  /**
   * Get a typed global config value
   *
   * Wraps: `git config --global --get <key>`
   *
   * @returns Config value or undefined if not set
   */
  get<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<ConfigSchema[K] | undefined>;

  /**
   * Get all values for a typed multi-valued global config key
   *
   * Wraps: `git config --global --get-all <key>`
   */
  getAll<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<Array<ConfigSchema[K]>>;

  /**
   * Set a typed global config value
   *
   * Wraps: `git config --global <key> <value>`
   */
  set<K extends ConfigKey>(key: K, value: ConfigSchema[K], opts?: ExecOpts): Promise<void>;

  /**
   * Add a value to a typed multi-valued global config key
   *
   * Wraps: `git config --global --add <key> <value>`
   */
  add<K extends ConfigKey>(key: K, value: ConfigSchema[K], opts?: ExecOpts): Promise<void>;

  /**
   * Unset a typed global config value
   *
   * Wraps: `git config --global --unset <key>`
   */
  unset<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<void>;

  /**
   * Get a raw global config value (for arbitrary keys)
   *
   * Wraps: `git config --global --get <key>`
   *
   * @returns Config value or undefined if not set
   */
  getRaw(key: string, opts?: ConfigGetOpts & ExecOpts): Promise<string | Array<string> | undefined>;

  /**
   * Set a raw global config value (for arbitrary keys)
   *
   * Wraps: `git config --global <key> <value>`
   */
  setRaw(key: string, value: string, opts?: ConfigSetOpts & ExecOpts): Promise<void>;

  /**
   * Unset a raw global config value (for arbitrary keys)
   *
   * Wraps: `git config --global --unset <key>`
   */
  unsetRaw(key: string, opts?: ExecOpts): Promise<void>;

  /**
   * List all global config values
   *
   * Wraps: `git config --global --list`
   */
  list(opts?: GlobalConfigListOpts & ExecOpts): Promise<Array<ConfigEntry>>;
}

/**
 * Main Git interface for repository-agnostic operations
 *
 * Provides type-safe wrappers for Git commands that don't require a repository context.
 * Each method corresponds to a specific Git CLI command.
 */
export interface Git {
  /**
   * Open an existing worktree repository
   *
   * This is the most common use case. Throws GitError if the repository is bare.
   *
   * @param path - Path to the repository working directory
   * @param opts - Environment isolation and credential options
   * @returns WorktreeRepo
   * @throws GitError with kind 'NotWorktreeRepo' if the repository is bare
   */
  open(path: string, opts?: GitOpenOptions): Promise<WorktreeRepo>;

  /**
   * Open an existing bare repository
   *
   * Throws GitError if the repository is not bare.
   *
   * @param path - Path to the bare repository (git-dir)
   * @param opts - Environment isolation and credential options
   * @returns BareRepo
   * @throws GitError with kind 'NotBareRepo' if the repository is not bare
   */
  openBare(path: string, opts?: GitOpenOptions): Promise<BareRepo>;

  /**
   * Open an existing repository without type guarantee
   *
   * Returns either WorktreeRepo or BareRepo depending on the repository type.
   * Use this when you don't know the repository type at compile time.
   *
   * @param path - Path to the repository (workdir or git-dir)
   * @param opts - Environment isolation and credential options
   * @returns WorktreeRepo or BareRepo depending on repository type
   */
  openRaw(path: string, opts?: GitOpenOptions): Promise<WorktreeRepo | BareRepo>;

  /**
   * Open an existing repository without type detection
   *
   * Returns a `RepoBase` that provides runtime type checking via `isWorktree()`
   * and `isBare()` methods. Use type assertions after checking to access
   * type-specific methods.
   *
   * This is useful when you need to defer type detection or want to perform
   * the detection yourself.
   *
   * @param path - Path to the repository (workdir or git-dir)
   * @param opts - Environment isolation and credential options
   * @returns RepoBase with runtime type checking methods
   *
   * @example
   * ```typescript
   * const repo = await git.openRaw('/path/to/repo');
   * if (await repo.isWorktree()) {
   *   // Use type assertion after runtime check
   *   const status = await (repo as WorktreeRepo).status();
   * } else if (await repo.isBare()) {
   *   // Use type assertion after runtime check
   *   await (repo as BareRepo).fetch({ remote: 'origin' });
   * }
   * ```
   */
  openRaw(path: string, opts?: GitOpenOptions): Promise<RepoBase>;

  /**
   * Clone a repository
   *
   * Wraps: `git clone <url> <path>`
   *
   * The return type depends on the `bare` or `mirror` option:
   * - `{ bare: true }` or `{ mirror: true }` → `BareRepo`
   * - Otherwise → `WorktreeRepo`
   */
  clone(url: string, path: string, opts: CloneOpts & { bare: true } & ExecOpts): Promise<BareRepo>;
  clone(
    url: string,
    path: string,
    opts: CloneOpts & { mirror: true } & ExecOpts,
  ): Promise<BareRepo>;
  clone(url: string, path: string, opts?: CloneOpts & ExecOpts): Promise<WorktreeRepo>;

  /**
   * Initialize a new repository
   *
   * Wraps: `git init <path>`
   *
   * The return type depends on the `bare` option:
   * - `{ bare: true }` → `BareRepo`
   * - Otherwise → `WorktreeRepo`
   */
  init(path: string, opts: InitOpts & { bare: true } & ExecOpts): Promise<BareRepo>;
  init(path: string, opts?: InitOpts & ExecOpts): Promise<WorktreeRepo>;

  /**
   * List references in a remote repository
   *
   * Wraps: `git ls-remote <url>`
   */
  lsRemote(url: string, opts?: LsRemoteOpts & ExecOpts): Promise<LsRemoteResult>;

  /**
   * Get git version
   *
   * Wraps: `git --version`
   */
  version(opts?: ExecOpts): Promise<string>;

  /**
   * Execute a raw git command (repository-agnostic)
   *
   * Wraps: `git <argv...>`
   */
  raw(argv: Array<string>, opts?: ExecOpts): Promise<RawResult>;

  /**
   * Global config operations
   *
   * Wraps: `git config --global` subcommands
   *
   * Operates on ~/.gitconfig (user-level configuration).
   * For repository-level config, use repo.config instead.
   */
  config: GlobalConfigOperations;
}

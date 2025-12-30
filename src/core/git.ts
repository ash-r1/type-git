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
  WorktreeRepo,
} from './repo.js';
import type { ExecOpts, GitOpenOptions, RawResult } from './types.js';

/**
 * Options for git clone
 */
export type CloneOpts = {
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
};

/**
 * Options for git init
 */
export type InitOpts = {
  bare?: boolean;
  initialBranch?: string;
  /** Store .git directory at specified path instead of inside the repository */
  separateGitDir?: string;
  /**
   * Whether to clean up the target directory if the operation is aborted.
   * @default true
   */
  cleanupOnAbort?: boolean;
};

/**
 * Options for git ls-remote
 */
export type LsRemoteOpts = {
  heads?: boolean;
  tags?: boolean;
  refs?: boolean;
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
 * Global config operations interface
 *
 * Operates on ~/.gitconfig (user-level configuration).
 * Uses the same typed ConfigSchema as repository-level config.
 */
export interface GlobalConfigOperations {
  /**
   * Get a typed global config value
   * Returns undefined if not set
   */
  get<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<ConfigSchema[K] | undefined>;

  /**
   * Get all values for a typed multi-valued global config key
   */
  getAll<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<Array<ConfigSchema[K]>>;

  /**
   * Set a typed global config value
   */
  set<K extends ConfigKey>(key: K, value: ConfigSchema[K], opts?: ExecOpts): Promise<void>;

  /**
   * Add a value to a typed multi-valued global config key
   */
  add<K extends ConfigKey>(key: K, value: ConfigSchema[K], opts?: ExecOpts): Promise<void>;

  /**
   * Unset a typed global config value
   */
  unset<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<void>;

  /**
   * Get a raw global config value (for arbitrary keys)
   * Returns undefined if not set
   */
  getRaw(key: string, opts?: ConfigGetOpts & ExecOpts): Promise<string | Array<string> | undefined>;

  /**
   * Set a raw global config value (for arbitrary keys)
   */
  setRaw(key: string, value: string, opts?: ConfigSetOpts & ExecOpts): Promise<void>;

  /**
   * Unset a raw global config value (for arbitrary keys)
   */
  unsetRaw(key: string, opts?: ExecOpts): Promise<void>;

  /**
   * List all global config values
   */
  list(opts?: GlobalConfigListOpts & ExecOpts): Promise<Array<ConfigEntry>>;
}

/**
 * Main Git interface for repository-agnostic operations
 *
 * Design doc references:
 * - §7.1: Repository-agnostic operations (clone, init, lsRemote, raw, version)
 * - §6.3: open() with environment isolation options
 */
export interface Git {
  /**
   * Open an existing repository with optional environment isolation (§6.3)
   *
   * @param path - Path to the repository (workdir or git-dir)
   * @param opts - Environment isolation and credential options
   * @returns WorktreeRepo or BareRepo depending on repository type
   */
  open(path: string, opts?: GitOpenOptions): Promise<WorktreeRepo | BareRepo>;

  /**
   * Clone a repository
   *
   * Returns the newly created repository, addressing the factory pattern
   * design flaw in simple-git (§2.4).
   */
  clone(url: string, path: string, opts?: CloneOpts & ExecOpts): Promise<WorktreeRepo | BareRepo>;

  /**
   * Initialize a new repository
   *
   * Returns the newly created repository.
   */
  init(path: string, opts?: InitOpts & ExecOpts): Promise<WorktreeRepo | BareRepo>;

  /**
   * List references in a remote repository
   */
  lsRemote(url: string, opts?: LsRemoteOpts & ExecOpts): Promise<LsRemoteResult>;

  /**
   * Get git version
   */
  version(opts?: ExecOpts): Promise<string>;

  /**
   * Execute a raw git command (repository-agnostic)
   */
  raw(argv: Array<string>, opts?: ExecOpts): Promise<RawResult>;

  /**
   * Global config operations (--global flag)
   *
   * Operates on ~/.gitconfig (user-level configuration).
   * For repository-level config, use repo.config instead.
   */
  config: GlobalConfigOperations;
}

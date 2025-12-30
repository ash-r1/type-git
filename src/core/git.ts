/**
 * Core Git interface - repository-agnostic operations
 */

import type { BareRepo, ConfigEntry, WorktreeRepo } from './repo.js';
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
};

/**
 * Options for git init
 */
export type InitOpts = {
  bare?: boolean;
  initialBranch?: string;
  /** Store .git directory at specified path instead of inside the repository */
  separateGitDir?: string;
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
 * Options for global config get
 */
export type GlobalConfigGetOpts = {
  /** Get all values for multi-valued key */
  all?: boolean;
};

/**
 * Options for global config set
 */
export type GlobalConfigSetOpts = {
  /** Add value to multi-valued key instead of replacing */
  add?: boolean;
};

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
 * Operates on ~/.gitconfig (user-level configuration)
 */
export interface GlobalConfigOperations {
  /**
   * Get a global config value
   * Returns undefined if not set
   */
  get(
    key: string,
    opts?: GlobalConfigGetOpts & ExecOpts,
  ): Promise<string | Array<string> | undefined>;

  /**
   * Set a global config value
   */
  set(key: string, value: string, opts?: GlobalConfigSetOpts & ExecOpts): Promise<void>;

  /**
   * Unset a global config value
   */
  unset(key: string, opts?: ExecOpts): Promise<void>;

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

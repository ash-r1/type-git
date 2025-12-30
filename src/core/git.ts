/**
 * Core Git interface - repository-agnostic operations
 */

import type { ExecOpts, RawResult, GitOpenOptions } from './types.js';
import type { WorktreeRepo, BareRepo } from './repo.js';

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
};

/**
 * Options for git init
 */
export type InitOpts = {
  bare?: boolean;
  initialBranch?: string;
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
  raw(argv: string[], opts?: ExecOpts): Promise<RawResult>;
}

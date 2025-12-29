/**
 * Core Git interface - repository-agnostic operations
 */

import type { ExecOpts, RawResult } from './types.js';
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
 */
export interface Git {
  /**
   * Clone a repository
   */
  clone(
    url: string,
    path: string,
    opts?: CloneOpts & ExecOpts,
  ): Promise<WorktreeRepo | BareRepo>;

  /**
   * Initialize a new repository
   */
  init(path: string, opts?: InitOpts & ExecOpts): Promise<WorktreeRepo | BareRepo>;

  /**
   * List references in a remote repository
   */
  lsRemote(url: string, opts?: LsRemoteOpts & ExecOpts): Promise<LsRemoteResult>;

  /**
   * Execute a raw git command (repository-agnostic)
   */
  raw(argv: string[], opts?: ExecOpts): Promise<RawResult>;
}

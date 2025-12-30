/**
 * Repository interfaces - operations that require a repository context
 */

import type { ExecOpts, RawResult, LfsMode } from './types.js';

/**
 * Base repository interface
 */
export interface RepoBase {
  /**
   * Execute a raw git command in this repository context
   */
  raw(argv: string[], opts?: ExecOpts): Promise<RawResult>;
}

/**
 * Status file entry
 */
export type StatusEntry = {
  path: string;
  index: string;
  workdir: string;
  originalPath?: string;
};

/**
 * Result from git status --porcelain
 */
export type StatusPorcelain = {
  entries: StatusEntry[];
  branch?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
};

/**
 * Options for git status
 */
export type StatusOpts = {
  porcelain?: 1 | 2;
  untracked?: 'no' | 'normal' | 'all';
};

/**
 * Commit information
 */
export type Commit = {
  hash: string;
  abbrevHash: string;
  parents: string[];
  author: {
    name: string;
    email: string;
    timestamp: number;
  };
  committer: {
    name: string;
    email: string;
    timestamp: number;
  };
  subject: string;
  body: string;
};

/**
 * Options for git log
 */
export type LogOpts = {
  maxCount?: number;
  skip?: number;
  since?: string | Date;
  until?: string | Date;
  author?: string;
  grep?: string;
  all?: boolean;
};

/**
 * Options for git fetch
 */
export type FetchOpts = {
  remote?: string;
  refspec?: string | string[];
  prune?: boolean;
  tags?: boolean;
  depth?: number;
};

/**
 * Options for git push
 */
export type PushOpts = {
  remote?: string;
  refspec?: string | string[];
  force?: boolean;
  tags?: boolean;
  setUpstream?: boolean;
};

/**
 * LFS status information
 */
export type LfsStatus = {
  files: Array<{
    name: string;
    size: number;
    status: 'checkout' | 'download' | 'upload' | 'unknown';
  }>;
};

/**
 * Options for LFS pull
 */
export type LfsPullOpts = {
  remote?: string;
  ref?: string;
  include?: string[];
  exclude?: string[];
};

/**
 * Options for LFS push
 */
export type LfsPushOpts = {
  remote?: string;
  ref?: string;
};

/**
 * Options for LFS status
 */
export type LfsStatusOpts = {
  json?: boolean;
};

// =============================================================================
// Worktree Support (§7.4)
// =============================================================================

/**
 * Worktree information (§7.4)
 *
 * Parsed from `git worktree list --porcelain` output.
 */
export type Worktree = {
  /** Worktree path */
  path: string;
  /** HEAD commit hash */
  head: string;
  /** Branch name (if checked out) */
  branch?: string;
  /** Whether the worktree is locked */
  locked: boolean;
  /** Whether the worktree is prunable */
  prunable: boolean;
};

/**
 * Options for adding a worktree
 */
export type WorktreeAddOpts = {
  /** Branch name to create or checkout */
  branch?: string;
  /** Create detached HEAD */
  detach?: boolean;
  /** Track remote branch */
  track?: boolean;
};

/**
 * Options for removing a worktree
 */
export type WorktreeRemoveOpts = {
  /** Force removal even if dirty */
  force?: boolean;
};

/**
 * Options for pruning worktrees
 */
export type WorktreePruneOpts = {
  /** Show what would be pruned without actually pruning */
  dryRun?: boolean;
  /** Show more details */
  verbose?: boolean;
};

/**
 * Options for locking a worktree
 */
export type WorktreeLockOpts = {
  /** Reason for locking */
  reason?: string;
};

/**
 * Worktree operations interface (§7.4)
 */
export interface WorktreeOperations {
  /**
   * List all worktrees (parses --porcelain output)
   */
  list(opts?: ExecOpts): Promise<Worktree[]>;

  /**
   * Add a new worktree
   */
  add(path: string, opts?: WorktreeAddOpts & ExecOpts): Promise<void>;

  /**
   * Remove a worktree
   */
  remove(path: string, opts?: WorktreeRemoveOpts & ExecOpts): Promise<void>;

  /**
   * Prune stale worktree references
   */
  prune(opts?: WorktreePruneOpts & ExecOpts): Promise<string[]>;

  /**
   * Lock a worktree
   */
  lock(path: string, opts?: WorktreeLockOpts & ExecOpts): Promise<void>;

  /**
   * Unlock a worktree
   */
  unlock(path: string, opts?: ExecOpts): Promise<void>;
}

/**
 * LFS operations interface
 */
export interface LfsOperations {
  /**
   * Pull LFS objects
   */
  pull(opts?: LfsPullOpts & ExecOpts): Promise<void>;

  /**
   * Push LFS objects
   */
  push(opts?: LfsPushOpts & ExecOpts): Promise<void>;

  /**
   * Get LFS status
   */
  status(opts?: LfsStatusOpts & ExecOpts): Promise<LfsStatus>;
}

/**
 * Worktree repository with full working directory support
 */
export interface WorktreeRepo extends RepoBase {
  readonly workdir: string;

  /**
   * Get repository status
   */
  status(opts?: StatusOpts & ExecOpts): Promise<StatusPorcelain>;

  /**
   * Get commit log
   */
  log(opts?: LogOpts & ExecOpts): Promise<Commit[]>;

  /**
   * Fetch from remote
   */
  fetch(opts?: FetchOpts & ExecOpts): Promise<void>;

  /**
   * Push to remote
   */
  push(opts?: PushOpts & ExecOpts): Promise<void>;

  /**
   * LFS operations
   */
  lfs: LfsOperations;

  /**
   * Worktree operations (§7.4)
   */
  worktree: WorktreeOperations;

  /**
   * Configure LFS mode for this repository
   */
  setLfsMode(mode: LfsMode): void;
}

/**
 * Bare repository (no working directory)
 */
export interface BareRepo extends RepoBase {
  readonly gitDir: string;

  /**
   * Fetch from remote
   */
  fetch(opts?: FetchOpts & ExecOpts): Promise<void>;

  /**
   * Push to remote
   */
  push(opts?: PushOpts & ExecOpts): Promise<void>;
}

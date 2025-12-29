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

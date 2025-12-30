/**
 * Repository interfaces - operations that require a repository context
 */

import type { ExecOpts, LfsMode, Progress, RawResult } from './types.js';

/**
 * Base repository interface
 */
export interface RepoBase {
  /**
   * Execute a raw git command in this repository context
   */
  raw(argv: Array<string>, opts?: ExecOpts): Promise<RawResult>;
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
  entries: Array<StatusEntry>;
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
  parents: Array<string>;
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
  refspec?: string | Array<string>;
  prune?: boolean;
  tags?: boolean;
  depth?: number;
};

/**
 * Options for git push
 */
export type PushOpts = {
  remote?: string;
  refspec?: string | Array<string>;
  force?: boolean;
  tags?: boolean;
  setUpstream?: boolean;
};

// =============================================================================
// High-level API Types
// =============================================================================

/**
 * Options for git add
 */
export type AddOpts = {
  /** Add all files (including untracked) */
  all?: boolean;
  /** Dry run - show what would be added */
  dryRun?: boolean;
  /** Add modified and deleted files, but not untracked */
  update?: boolean;
  /** Force add of ignored files */
  force?: boolean;
  /** Add changes interactively (not supported - use raw) */
  interactive?: never;
  /** Add changes in patch mode (not supported - use raw) */
  patch?: never;
};

/**
 * Branch information
 */
export type BranchInfo = {
  name: string;
  current: boolean;
  commit: string;
  upstream?: string;
  gone?: boolean;
};

/**
 * Options for git branch
 */
export type BranchOpts = {
  /** List all branches (including remote) */
  all?: boolean;
  /** List remote branches only */
  remotes?: boolean;
  /** Show verbose info */
  verbose?: boolean;
};

/**
 * Options for creating a branch
 */
export type BranchCreateOpts = {
  /** Start point (commit, branch, or tag) */
  startPoint?: string;
  /** Force creation (overwrite existing) */
  force?: boolean;
  /** Set up tracking */
  track?: boolean;
};

/**
 * Options for deleting a branch
 */
export type BranchDeleteOpts = {
  /** Force delete (even if not merged) */
  force?: boolean;
  /** Delete remote-tracking branch */
  remote?: boolean;
};

/**
 * Options for git checkout
 */
export type CheckoutOpts = {
  /** Force checkout (discard local changes) */
  force?: boolean;
  /** Create new branch */
  createBranch?: boolean;
  /** Start point for new branch */
  startPoint?: string;
  /** Track remote branch */
  track?: boolean;
};

/**
 * Options for git commit
 */
export type CommitOpts = {
  /** Commit message */
  message?: string;
  /** Allow empty commit */
  allowEmpty?: boolean;
  /** Amend previous commit */
  amend?: boolean;
  /** Add all tracked modified files */
  all?: boolean;
  /** Author name and email */
  author?: string;
  /** Override commit date */
  date?: string | Date;
  /** Do not create commit, just update message */
  dryRun?: boolean;
};

/**
 * Commit result
 */
export type CommitResult = {
  /** Commit hash */
  hash: string;
  /** Branch name */
  branch: string;
  /** Commit message summary */
  summary: string;
  /** Files changed */
  filesChanged: number;
  /** Insertions */
  insertions: number;
  /** Deletions */
  deletions: number;
};

/**
 * Options for git diff
 */
export type DiffOpts = {
  /** Compare staged changes */
  staged?: boolean;
  /** Show stat only */
  stat?: boolean;
  /** Show name only */
  nameOnly?: boolean;
  /** Show name and status */
  nameStatus?: boolean;
  /** Number of context lines */
  context?: number;
  /** Ignore whitespace changes */
  ignoreWhitespace?: boolean;
  /** Pathspecs to filter */
  paths?: Array<string>;
};

/**
 * Diff file entry
 */
export type DiffEntry = {
  path: string;
  status: 'A' | 'D' | 'M' | 'R' | 'C' | 'T' | 'U' | 'X';
  oldPath?: string;
  additions?: number;
  deletions?: number;
};

/**
 * Diff result
 */
export type DiffResult = {
  files: Array<DiffEntry>;
  raw?: string;
};

/**
 * Options for git merge
 */
export type MergeOpts = {
  /** Merge message */
  message?: string;
  /** Fast-forward behavior */
  ff?: 'only' | 'no' | boolean;
  /** Squash merge */
  squash?: boolean;
  /** No commit after merge */
  noCommit?: boolean;
  /** Strategy to use */
  strategy?: string;
  /** Strategy options */
  strategyOption?: string | Array<string>;
  /** Abort merge */
  abort?: boolean;
  /** Continue merge */
  continue?: boolean;
};

/**
 * Merge result
 */
export type MergeResult = {
  success: boolean;
  hash?: string;
  conflicts?: Array<string>;
  fastForward?: boolean;
};

/**
 * Options for git pull
 */
export type PullOpts = {
  /** Remote name */
  remote?: string;
  /** Branch to pull */
  branch?: string;
  /** Rebase instead of merge */
  rebase?: boolean | 'merges' | 'interactive';
  /** Fast-forward behavior */
  ff?: 'only' | 'no' | boolean;
  /** Fetch tags */
  tags?: boolean;
  /** Prune remote-tracking refs */
  prune?: boolean;
  /** Progress callback */
  onProgress?: (progress: Progress) => void;
};

/**
 * Options for git reset
 */
export type ResetOpts = {
  /** Reset mode */
  mode?: 'soft' | 'mixed' | 'hard' | 'merge' | 'keep';
};

/**
 * Options for git rm
 */
export type RmOpts = {
  /** Force removal */
  force?: boolean;
  /** Remove from index only (keep in working tree) */
  cached?: boolean;
  /** Allow recursive removal */
  recursive?: boolean;
  /** Dry run */
  dryRun?: boolean;
};

/**
 * Stash entry
 */
export type StashEntry = {
  index: number;
  message: string;
  branch?: string;
  commit: string;
};

/**
 * Options for git stash push
 */
export type StashPushOpts = {
  /** Stash message */
  message?: string;
  /** Include untracked files */
  includeUntracked?: boolean;
  /** Keep index */
  keepIndex?: boolean;
  /** Specific paths to stash */
  paths?: Array<string>;
};

/**
 * Options for git stash pop/apply
 */
export type StashApplyOpts = {
  /** Stash index to apply */
  index?: number;
  /** Try to reinstate index */
  reinstateIndex?: boolean;
};

/**
 * Options for git switch
 */
export type SwitchOpts = {
  /** Create new branch */
  create?: boolean;
  /** Force create (overwrite existing) */
  forceCreate?: boolean;
  /** Discard local changes */
  discard?: boolean;
  /** Start point for new branch */
  startPoint?: string;
  /** Track remote branch */
  track?: boolean;
  /** Detach HEAD */
  detach?: boolean;
};

/**
 * Tag information
 */
export type TagInfo = {
  name: string;
  commit: string;
  message?: string;
  tagger?: {
    name: string;
    email: string;
    date: Date;
  };
  annotated: boolean;
};

/**
 * Options for git tag (list)
 */
export type TagListOpts = {
  /** List pattern */
  pattern?: string;
  /** Sort by */
  sort?: string;
};

/**
 * Options for creating a tag
 */
export type TagCreateOpts = {
  /** Tag message (creates annotated tag) */
  message?: string;
  /** Force (overwrite existing tag) */
  force?: boolean;
  /** Commit to tag */
  commit?: string;
};

// =============================================================================
// Medium Priority Commands
// =============================================================================

/**
 * Options for git cherry-pick
 */
export type CherryPickOpts = {
  /** Edit commit message */
  edit?: boolean;
  /** No commit after cherry-pick */
  noCommit?: boolean;
  /** Add signoff */
  signoff?: boolean;
  /** Mainline parent number for merge commits */
  mainline?: number;
  /** Strategy to use */
  strategy?: string;
  /** Abort cherry-pick */
  abort?: boolean;
  /** Continue cherry-pick */
  continue?: boolean;
  /** Skip current commit */
  skip?: boolean;
};

/**
 * Options for git clean
 */
export type CleanOpts = {
  /** Force clean */
  force?: boolean;
  /** Remove directories too */
  directories?: boolean;
  /** Remove ignored files too */
  ignored?: boolean;
  /** Only remove ignored files */
  onlyIgnored?: boolean;
  /** Dry run */
  dryRun?: boolean;
  /** Paths to clean */
  paths?: Array<string>;
};

/**
 * Options for git mv
 */
export type MvOpts = {
  /** Force move */
  force?: boolean;
  /** Dry run */
  dryRun?: boolean;
};

/**
 * Options for git rebase
 */
export type RebaseOpts = {
  /** Upstream branch */
  upstream?: string;
  /** Onto target */
  onto?: string;
  /** Interactive rebase (not supported - use raw) */
  interactive?: never;
  /** Preserve merges */
  rebaseMerges?: boolean;
  /** Abort rebase */
  abort?: boolean;
  /** Continue rebase */
  continue?: boolean;
  /** Skip current commit */
  skip?: boolean;
};

/**
 * Options for git restore
 */
export type RestoreOpts = {
  /** Restore staged files */
  staged?: boolean;
  /** Restore working tree files */
  worktree?: boolean;
  /** Source to restore from */
  source?: string;
  /** Ours or theirs for conflicts */
  ours?: boolean;
  theirs?: boolean;
};

/**
 * Options for git revert
 */
export type RevertOpts = {
  /** Edit commit message */
  edit?: boolean;
  /** No commit after revert */
  noCommit?: boolean;
  /** Mainline parent number for merge commits */
  mainline?: number;
  /** Abort revert */
  abort?: boolean;
  /** Continue revert */
  continue?: boolean;
  /** Skip current commit */
  skip?: boolean;
};

/**
 * Options for git show
 */
export type ShowOpts = {
  /** Show stat only */
  stat?: boolean;
  /** Show name only */
  nameOnly?: boolean;
  /** Show name and status */
  nameStatus?: boolean;
  /** Format string */
  format?: string;
};

/**
 * Options for git submodule
 */
export type SubmoduleOpts = {
  /** Recursive operation */
  recursive?: boolean;
  /** Initialize submodules */
  init?: boolean;
  /** Remote tracking branch */
  remote?: boolean;
  /** Force update */
  force?: boolean;
};

/**
 * Submodule information
 */
export type SubmoduleInfo = {
  name: string;
  path: string;
  url: string;
  branch?: string;
  commit: string;
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
  include?: Array<string>;
  exclude?: Array<string>;
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
// LFS 2-Phase Upload/Download (§10.3)
// =============================================================================

/**
 * Options for LFS pre-upload (§10.3)
 *
 * Pre-upload allows pushing LFS objects before the refs push,
 * enabling 2-phase commit patterns for improved reliability.
 */
export type LfsPreUploadOpts = {
  /** Object IDs to upload (if omitted, auto-detect pending objects) */
  oids?: Array<string>;
  /** Batch size for upload (default: 50, considers Windows 8KB limit) */
  batchSize?: number;
  /** Remote name (default: 'origin') */
  remote?: string;
};

/**
 * Result from LFS pre-upload
 */
export type LfsPreUploadResult = {
  /** Number of objects uploaded */
  uploadedCount: number;
  /** Total bytes uploaded */
  uploadedBytes: number;
  /** Number of objects skipped (already on remote) */
  skippedCount: number;
};

/**
 * Options for LFS pre-download (§10.3)
 *
 * Pre-download allows fetching LFS objects before checkout,
 * useful for controlled large file management.
 */
export type LfsPreDownloadOpts = {
  /** Object IDs to download (if omitted, auto-detect from ref) */
  oids?: Array<string>;
  /** Git ref to get LFS objects for (branch, tag, or commit) */
  ref?: string;
  /** Batch size for download (default: 50) */
  batchSize?: number;
  /** Remote name (default: 'origin') */
  remote?: string;
};

/**
 * Result from LFS pre-download
 */
export type LfsPreDownloadResult = {
  /** Number of objects downloaded */
  downloadedCount: number;
  /** Total bytes downloaded */
  downloadedBytes: number;
  /** Number of objects skipped (already local) */
  skippedCount: number;
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
  list(opts?: ExecOpts): Promise<Array<Worktree>>;

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
  prune(opts?: WorktreePruneOpts & ExecOpts): Promise<Array<string>>;

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

  /**
   * Pre-upload LFS objects before refs push (§10.3)
   *
   * Enables 2-phase commit pattern for improved reliability with large files.
   * Objects are uploaded in batches to handle Windows command line limits.
   *
   * @example
   * ```typescript
   * // Phase 1: Upload LFS objects first
   * await repo.lfs.preUpload({ onProgress: handleProgress });
   *
   * // Phase 2: Create commit
   * await repo.commit({ message: 'Add large files' });
   *
   * // Phase 3: Push refs (LFS already uploaded, so this is fast)
   * await repo.push();
   * ```
   */
  preUpload(opts?: LfsPreUploadOpts & ExecOpts): Promise<LfsPreUploadResult>;

  /**
   * Pre-download LFS objects before checkout (§10.3)
   *
   * Enables controlled download of large files before checkout.
   * Useful when you need to verify available space or report progress separately.
   */
  preDownload(opts?: LfsPreDownloadOpts & ExecOpts): Promise<LfsPreDownloadResult>;
}

/**
 * Branch operations interface
 */
export interface BranchOperations {
  /**
   * List branches
   */
  list(opts?: BranchOpts & ExecOpts): Promise<Array<BranchInfo>>;

  /**
   * Get current branch name
   */
  current(opts?: ExecOpts): Promise<string | null>;

  /**
   * Create a new branch
   */
  create(name: string, opts?: BranchCreateOpts & ExecOpts): Promise<void>;

  /**
   * Delete a branch
   */
  delete(name: string, opts?: BranchDeleteOpts & ExecOpts): Promise<void>;

  /**
   * Rename a branch
   */
  rename(oldName: string, newName: string, opts?: ExecOpts): Promise<void>;
}

/**
 * Stash operations interface
 */
export interface StashOperations {
  /**
   * List stash entries
   */
  list(opts?: ExecOpts): Promise<Array<StashEntry>>;

  /**
   * Push changes to stash
   */
  push(opts?: StashPushOpts & ExecOpts): Promise<void>;

  /**
   * Pop stash entry
   */
  pop(opts?: StashApplyOpts & ExecOpts): Promise<void>;

  /**
   * Apply stash entry (without removing from stash)
   */
  apply(opts?: StashApplyOpts & ExecOpts): Promise<void>;

  /**
   * Drop a stash entry
   */
  drop(index?: number, opts?: ExecOpts): Promise<void>;

  /**
   * Clear all stash entries
   */
  clear(opts?: ExecOpts): Promise<void>;
}

/**
 * Tag operations interface
 */
export interface TagOperations {
  /**
   * List tags
   */
  list(opts?: TagListOpts & ExecOpts): Promise<Array<string>>;

  /**
   * Create a tag
   */
  create(name: string, opts?: TagCreateOpts & ExecOpts): Promise<void>;

  /**
   * Delete a tag
   */
  delete(name: string, opts?: ExecOpts): Promise<void>;

  /**
   * Get tag info
   */
  show(name: string, opts?: ExecOpts): Promise<TagInfo>;
}

/**
 * Submodule operations interface
 */
export interface SubmoduleOperations {
  /**
   * List submodules
   */
  list(opts?: ExecOpts): Promise<Array<SubmoduleInfo>>;

  /**
   * Initialize submodules
   */
  init(paths?: Array<string>, opts?: ExecOpts): Promise<void>;

  /**
   * Update submodules
   */
  update(opts?: SubmoduleOpts & ExecOpts): Promise<void>;

  /**
   * Add a submodule
   */
  add(url: string, path: string, opts?: ExecOpts): Promise<void>;

  /**
   * Deinitialize a submodule
   */
  deinit(path: string, opts?: ExecOpts): Promise<void>;
}

/**
 * Worktree repository with full working directory support
 */
export interface WorktreeRepo extends RepoBase {
  readonly workdir: string;

  // ==========================================================================
  // MVP Operations
  // ==========================================================================

  /**
   * Get repository status
   */
  status(opts?: StatusOpts & ExecOpts): Promise<StatusPorcelain>;

  /**
   * Get commit log
   */
  log(opts?: LogOpts & ExecOpts): Promise<Array<Commit>>;

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

  // ==========================================================================
  // High Priority Operations
  // ==========================================================================

  /**
   * Add files to the index
   */
  add(paths: string | Array<string>, opts?: AddOpts & ExecOpts): Promise<void>;

  /**
   * Branch operations
   */
  branch: BranchOperations;

  /**
   * Checkout a branch, tag, or commit
   */
  checkout(target: string, opts?: CheckoutOpts & ExecOpts): Promise<void>;

  /**
   * Create a commit
   */
  commit(opts?: CommitOpts & ExecOpts): Promise<CommitResult>;

  /**
   * Show changes between commits, commit and working tree, etc.
   */
  diff(target?: string, opts?: DiffOpts & ExecOpts): Promise<DiffResult>;

  /**
   * Merge branches
   */
  merge(branch: string, opts?: MergeOpts & ExecOpts): Promise<MergeResult>;

  /**
   * Pull from remote (fetch + merge/rebase)
   */
  pull(opts?: PullOpts & ExecOpts): Promise<void>;

  /**
   * Reset current HEAD to the specified state
   */
  reset(target?: string, opts?: ResetOpts & ExecOpts): Promise<void>;

  /**
   * Remove files from the working tree and from the index
   */
  rm(paths: string | Array<string>, opts?: RmOpts & ExecOpts): Promise<void>;

  /**
   * Stash operations
   */
  stash: StashOperations;

  /**
   * Switch branches
   */
  switch(branch: string, opts?: SwitchOpts & ExecOpts): Promise<void>;

  /**
   * Tag operations
   */
  tag: TagOperations;

  // ==========================================================================
  // Medium Priority Operations
  // ==========================================================================

  /**
   * Cherry-pick commits
   */
  cherryPick(commits: string | Array<string>, opts?: CherryPickOpts & ExecOpts): Promise<void>;

  /**
   * Clean untracked files
   */
  clean(opts?: CleanOpts & ExecOpts): Promise<Array<string>>;

  /**
   * Move or rename files
   */
  mv(source: string, destination: string, opts?: MvOpts & ExecOpts): Promise<void>;

  /**
   * Rebase commits
   */
  rebase(opts?: RebaseOpts & ExecOpts): Promise<void>;

  /**
   * Restore working tree files
   */
  restore(paths: string | Array<string>, opts?: RestoreOpts & ExecOpts): Promise<void>;

  /**
   * Revert commits
   */
  revert(commits: string | Array<string>, opts?: RevertOpts & ExecOpts): Promise<void>;

  /**
   * Show various types of objects
   */
  show(object: string, opts?: ShowOpts & ExecOpts): Promise<string>;

  /**
   * Submodule operations
   */
  submodule: SubmoduleOperations;
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

/**
 * Repository interfaces - operations that require a repository context
 */

import type { LsRemoteRef } from '../parsers/index.js';
import type { ExecOpts, GitProgress, LfsMode, RawResult } from './types.js';

/**
 * Base repository interface
 */
export interface RepoBase {
  /**
   * Execute a raw git command in this repository context
   *
   * Wraps: `git <argv...>`
   */
  raw(argv: string[], opts?: ExecOpts): Promise<RawResult>;

  /**
   * Check if this repository is a worktree repository (has working directory)
   *
   * Wraps: `git rev-parse --is-inside-work-tree`
   *
   * This is a runtime check that queries git to determine the repository type.
   * Note: TypeScript cannot automatically narrow the type based on this check
   * since it returns `Promise<boolean>`. Use type assertions after checking.
   *
   * @example
   * ```typescript
   * const repo = await git.openRaw('/path/to/repo');
   * if (await repo.isWorktree()) {
   *   // Use type assertion to access WorktreeRepo methods
   *   const status = await (repo as WorktreeRepo).status();
   * }
   * ```
   */
  isWorktree(): Promise<boolean>;

  /**
   * Check if this repository is a bare repository (no working directory)
   *
   * Wraps: `git rev-parse --is-bare-repository`
   *
   * This is a runtime check that queries git to determine the repository type.
   * Note: TypeScript cannot automatically narrow the type based on this check
   * since it returns `Promise<boolean>`. Use type assertions after checking.
   *
   * @example
   * ```typescript
   * const repo = await git.openRaw('/path/to/repo');
   * if (await repo.isBare()) {
   *   // Use type assertion to access BareRepo methods
   *   await (repo as BareRepo).fetch({ remote: 'origin' });
   * }
   * ```
   */
  isBare(): Promise<boolean>;

  /**
   * List references in a remote repository
   *
   * Wraps: `git ls-remote <remote> [refs...]`
   *
   * Unlike the global `git.lsRemote(url)`, this method operates in the context
   * of a repository and accepts a remote name (e.g., 'origin') instead of a URL.
   *
   * @example
   * ```typescript
   * // List all refs from origin
   * const result = await repo.lsRemote('origin');
   *
   * // List specific branch
   * const result = await repo.lsRemote('origin', { refs: ['main'] });
   *
   * // List only tags
   * const result = await repo.lsRemote('origin', { tags: true });
   * ```
   */
  lsRemote(remote: string, opts?: RepoLsRemoteOpts & ExecOpts): Promise<RepoLsRemoteResult>;

  /**
   * List contents of a tree object
   *
   * Wraps: `git ls-tree <tree-ish> [<path>...]`
   *
   * Lists the contents of a given tree object (commit, tag, or tree hash).
   *
   * @example
   * ```typescript
   * // List all files in HEAD
   * const entries = await repo.lsTree('HEAD');
   *
   * // List files recursively with names only
   * const names = await repo.lsTree('HEAD', { recursive: true, nameOnly: true });
   *
   * // List files in a specific directory
   * const entries = await repo.lsTree('main', { paths: ['src/'] });
   *
   * // Get file sizes
   * const entries = await repo.lsTree('HEAD', { long: true });
   * ```
   */
  lsTree(treeish: string, opts?: LsTreeOpts & ExecOpts): Promise<LsTreeEntry[]>;
}

/**
 * Options for repository-scoped git ls-remote
 */
export type RepoLsRemoteOpts = {
  /** Limit to refs/heads (branches) */
  heads?: boolean;
  /** Limit to refs/tags */
  tags?: boolean;
  /** Show only actual refs (not peeled tags) */
  refsOnly?: boolean;
  /** Show remote URL instead of listing refs */
  getUrl?: boolean;
  /** Sort refs by the given key (e.g., 'version:refname') */
  sort?: string;
  /** Show symbolic refs in addition to object refs */
  symref?: boolean;
  /** Specific refs to query (branch names, tag names, or full ref paths) */
  refs?: string[];
};

/**
 * Result from repository-scoped git ls-remote
 */
export type RepoLsRemoteResult = {
  refs: LsRemoteRef[];
};

/**
 * Object type in a tree
 */
export type LsTreeObjectType = 'blob' | 'tree' | 'commit';

/**
 * Entry from git ls-tree output
 */
export type LsTreeEntry = {
  /** File mode (e.g., '100644' for regular file, '040000' for directory) */
  mode: string;
  /** Object type: blob (file), tree (directory), or commit (submodule) */
  type: LsTreeObjectType;
  /** Object hash (SHA-1 or SHA-256) */
  hash: string;
  /** File path relative to repository root */
  path: string;
  /** Object size in bytes (only for blobs when using --long option) */
  size?: number;
};

/**
 * Options for git ls-tree
 */
export type LsTreeOpts = {
  /** Recurse into sub-trees (-r) */
  recursive?: boolean;
  /** Show only the named tree entry itself, not its children (-d) */
  treeOnly?: boolean;
  /** Show tree entries even when recursing (-t) */
  showTrees?: boolean;
  /** Show object size of blob entries (--long / -l) */
  long?: boolean;
  /** List only filenames (--name-only) */
  nameOnly?: boolean;
  /** List only object names/hashes (--object-only) */
  objectOnly?: boolean;
  /** Show full path names (--full-name) */
  fullName?: boolean;
  /** Do not limit listing to current working directory (--full-tree) */
  fullTree?: boolean;
  /** Abbreviate object names to at least n hexdigits (--abbrev) */
  abbrev?: number | boolean;
  /** Paths to filter (optional patterns to match) */
  paths?: string[];
};

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
  // Existing options
  /** Porcelain output format version (1 or 2) */
  porcelain?: 1 | 2;
  /** How to show untracked files */
  untracked?: 'no' | 'normal' | 'all';

  // New options
  /** Give the output in verbose format */
  verbose?: boolean;
  /** Show stash information */
  showStash?: boolean;
  /** Compute ahead/behind counts for the branch */
  aheadBehind?: boolean;
  /** Use NUL as line terminator */
  nullTerminated?: boolean;
  /** How to show ignored files */
  ignored?: 'traditional' | 'no' | 'matching';
  /** How to handle submodules */
  ignoreSubmodules?: 'none' | 'untracked' | 'dirty' | 'all';
  /** Do not detect renames */
  noRenames?: boolean;
  /** Detect renames (optionally with similarity threshold) */
  findRenames?: boolean | number;
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
  // Existing options
  /** Limit the number of commits to output */
  maxCount?: number;
  /** Skip number of commits before starting to show the output */
  skip?: number;
  /** Show commits more recent than a specific date */
  since?: string | Date;
  /** Show commits older than a specific date */
  until?: string | Date;
  /** Limit commits to those by a specific author */
  author?: string;
  /** Limit commits to those with log message matching the pattern */
  grep?: string;
  /** Pretend as if all refs are listed on the command line */
  all?: boolean;
  /** Follow only the first parent commit upon seeing a merge commit */
  firstParent?: boolean;

  // New options
  /** Print out the ref name given on the command line by which each commit was reached */
  source?: boolean;
  /** Use mailmap file to map author names */
  useMailmap?: boolean;
  /** If no --decorate-refs is given, pretend as if all refs were included */
  decorateRefs?: string;
  /** Do not include refs matching the pattern */
  decorateRefsExclude?: string;
  /** Print out the ref names of any commits that are shown */
  decorate?: 'short' | 'full' | 'auto' | 'no';
  /** Generate a diffstat */
  stat?: boolean;
  /** Output only the last line of the stat */
  shortstat?: boolean;
  /** Show only names of changed files */
  nameOnly?: boolean;
  /** Show only names and status of changed files */
  nameStatus?: boolean;
  /** Show only merge commits */
  merges?: boolean;
  /** Do not show merge commits */
  noMerges?: boolean;
  /** Only display commits that are ancestors of the specified commit */
  ancestryPath?: boolean;
  /** Output commits in reverse order */
  reverse?: boolean;
  /** Alias for since */
  after?: string | Date;
  /** Alias for until */
  before?: string | Date;
  /** Revision or revision range to show (e.g., 'main', 'HEAD~5..HEAD', 'v1.0.0') */
  ref?: string;
};

/**
 * Options for git fetch
 */
export type FetchOpts = {
  // Existing options
  /** Remote name to fetch from */
  remote?: string;
  /** Refspec(s) to fetch */
  refspec?: string | string[];
  /** Remove remote-tracking refs that no longer exist on the remote */
  prune?: boolean;
  /** Fetch all tags from the remote */
  tags?: boolean;
  /** Limit fetching to the specified number of commits */
  depth?: number;

  // New options
  /** Be more verbose */
  verbose?: boolean;
  /** Operate quietly (suppress progress reporting) */
  quiet?: boolean;
  /** Fetch from all remotes */
  all?: boolean;
  /** Set upstream tracking for the fetched branches */
  setUpstream?: boolean;
  /** Append ref names and object names of fetched refs to .git/FETCH_HEAD */
  append?: boolean;
  /** Use atomic transaction to update refs */
  atomic?: boolean;
  /** Force update of local branches */
  force?: boolean;
  /** Allow fetching from multiple remotes */
  multiple?: boolean;
  /** Do not fetch any tags */
  noTags?: boolean;
  /** Number of parallel children for fetching submodules */
  jobs?: number;
  /** Modify the configured refspec to place all refs into refs/prefetch/ */
  prefetch?: boolean;
  /** Also prune tags that are no longer on the remote */
  pruneTags?: boolean;
  /** Fetch submodules recursively */
  recurseSubmodules?: boolean | 'yes' | 'on-demand' | 'no';
  /** Dry run - show what would be done without making changes */
  dryRun?: boolean;
  /** Allow updating FETCH_HEAD */
  writeFetchHead?: boolean;
  /** Keep downloaded pack */
  keep?: boolean;
  /** Allow updating the current branch head */
  updateHeadOk?: boolean;
  /** Deepen a shallow repository by date */
  shallowSince?: string | Date;
  /** Deepen a shallow repository excluding specified revision */
  shallowExclude?: string | string[];
  /** Deepen a shallow repository by specified number of commits */
  deepen?: number;
  /** Convert a shallow repository to a complete one */
  unshallow?: boolean;
  /** Re-fetch all objects even if we already have them */
  refetch?: boolean;
  /** Update shallow boundary if new refs need it */
  updateShallow?: boolean;
  /** Override the default refspec */
  refmap?: string;
  /** Use IPv4 addresses only */
  ipv4?: boolean;
  /** Use IPv6 addresses only */
  ipv6?: boolean;
  /** Partial clone filter specification */
  filter?: string;
  /** Check for forced updates */
  showForcedUpdates?: boolean;
  /** Write commit graph after fetching */
  writeCommitGraph?: boolean;
};

/**
 * Force with lease options for git push
 */
export type ForceWithLeaseOpts = {
  /** Reference name to check (e.g., 'refs/heads/main') */
  refname: string;
  /** Expected value of the ref (commit hash) */
  expect?: string;
};

/**
 * Options for git push
 */
export type PushOpts = {
  // Existing options
  /** Remote name to push to */
  remote?: string;
  /** Refspec(s) to push */
  refspec?: string | string[];
  /** Force updates even if they are not fast-forward */
  force?: boolean;
  /**
   * Force with lease - safer force push that fails if remote has been updated
   * - true: use default behavior (check current remote ref)
   * - ForceWithLeaseOpts: specify refname and optional expected value
   */
  forceWithLease?: boolean | ForceWithLeaseOpts;
  /** Push all tags */
  tags?: boolean;
  /** Set upstream tracking for the pushed branches */
  setUpstream?: boolean;
  /** Bypass pre-push hook */
  noVerify?: boolean;
  /**
   * GPG-sign the push (for signed pushes)
   * - true: sign with default key
   * - 'if-asked': sign only if server supports and requests it
   */
  signed?: boolean | 'if-asked';

  // New options
  /** Be more verbose */
  verbose?: boolean;
  /** Operate quietly (suppress progress reporting) */
  quiet?: boolean;
  /** Override the default repository */
  repo?: string;
  /** Push all branches */
  all?: boolean;
  /** Push all branches (alias for all) */
  branches?: boolean;
  /** Mirror mode - push all refs */
  mirror?: boolean;
  /** Delete the specified refs from the remote */
  deleteRefs?: boolean;
  /** Dry run - show what would be pushed without pushing */
  dryRun?: boolean;
  /** Force only if the remote tip is included in local history */
  forceIfIncludes?: boolean;
  /** Push submodules recursively */
  recurseSubmodules?: 'check' | 'on-demand' | 'only' | 'no';
  /** Use thin pack transfer */
  thin?: boolean;
  /** Prune remote-tracking branches that are deleted locally */
  prune?: boolean;
  /** Push all refs under refs/tags with the commits */
  followTags?: boolean;
  /** Use atomic transaction to update refs */
  atomic?: boolean;
  /** Transmit push options to the server */
  pushOption?: string | string[];
  /** Use IPv4 addresses only */
  ipv4?: boolean;
  /** Use IPv6 addresses only */
  ipv6?: boolean;
};

// =============================================================================
// High-level API Types
// =============================================================================

/**
 * Options for git add
 */
export type AddOpts = {
  // Existing options
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

  // New options
  /** Be verbose */
  verbose?: boolean;
  /** Record only the fact that the path will be added later */
  intentToAdd?: boolean;
  /** Apply the clean process freshly to all tracked files */
  renormalize?: boolean;
  /** Ignore removal of files from working tree */
  ignoreRemoval?: boolean;
  /** Don't add files, just refresh their stat info in the index */
  refresh?: boolean;
  /** If some files could not be added, continue adding others */
  ignoreErrors?: boolean;
  /** Don't report missing files (with --dry-run) */
  ignoreMissing?: boolean;
  /** Allow updating index entries outside of sparse-checkout cone */
  sparse?: boolean;
  /** Override the executable bit of the listed files */
  chmod?: '+x' | '-x';
  /** Read pathspecs from file instead of command line */
  pathspecFromFile?: string;
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
  // Existing options
  /** List all branches (including remote) */
  all?: boolean;
  /** List remote branches only */
  remotes?: boolean;
  /** Show verbose info */
  verbose?: boolean;

  // New options
  /** Suppress informational messages */
  quiet?: boolean;
  /** Only list branches that contain the specified commit */
  contains?: string;
  /** Only list branches that don't contain the specified commit */
  noContains?: string;
  /** Abbreviate object names to specified length */
  abbrev?: number;
  /** Only list branches whose tips are reachable from the specified commit */
  merged?: string;
  /** Only list branches whose tips are not reachable from the specified commit */
  noMerged?: string;
  /** Sorting key (e.g., -committerdate, refname) */
  sort?: string;
  /** Only list branches that point at the specified object */
  pointsAt?: string;
  /** Sorting and filtering are case insensitive */
  ignoreCase?: boolean;
};

/**
 * Options for creating a branch
 */
export type BranchCreateOpts = {
  // Existing options
  /** Start point (commit, branch, or tag) */
  startPoint?: string;
  /** Force creation (overwrite existing) */
  force?: boolean;
  /** Set up tracking */
  track?: boolean;

  // New options
  /** Set up upstream configuration for the new branch */
  setUpstreamTo?: string;
  /** Create the branch's reflog */
  createReflog?: boolean;
  /** Also update submodules */
  recurseSubmodules?: boolean;
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
 * Options for git checkout (branch switching mode)
 *
 * Used for: `git checkout <branch>`
 */
export type CheckoutBranchOpts = {
  /** Force checkout (discard local changes) */
  force?: boolean;
  /** Create new branch */
  createBranch?: boolean;
  /** Start point for new branch */
  startPoint?: string;
  /** Track remote branch */
  track?: boolean;
  /** Create or reset and checkout branch (like -b but forces) */
  forceCreateBranch?: boolean;
  /** Create reflog for new branch */
  createReflog?: boolean;
  /** Try to guess remote tracking branch if target not found */
  guess?: boolean;
  /** Suppress progress reporting */
  quiet?: boolean;
  /** Update submodules */
  recurseSubmodules?: boolean;
  /** Merge local modifications with the new branch */
  merge?: boolean;
  /** Conflict style for merge conflicts */
  conflict?: 'merge' | 'diff3' | 'zdiff3';
  /** Detach HEAD at specified commit */
  detach?: boolean;
  /** Create new orphan branch */
  orphan?: boolean;
  /** Silently overwrite ignored files */
  overwriteIgnore?: boolean;
  /** Ignore if branch is checked out in other worktrees */
  ignoreOtherWorktrees?: boolean;
};

/**
 * Options for git checkout (pathspec mode)
 *
 * Used for: `git checkout [<tree-ish>] -- <pathspec>...`
 */
export type CheckoutPathOpts = {
  /** Force checkout (discard local changes) */
  force?: boolean;
  /** Source tree-ish to checkout from (default: index) */
  source?: string;
  /** Suppress progress reporting */
  quiet?: boolean;
  /** Allow overlapping paths when checking out from tree-ish */
  overlay?: boolean;
  /** Check out 'our' version for unmerged files */
  ours?: boolean;
  /** Check out 'their' version for unmerged files */
  theirs?: boolean;
  /** Read pathspecs from file instead of command line */
  pathspecFromFile?: string;
};

/**
 * Options for git checkout (legacy combined type)
 * @deprecated Use CheckoutBranchOpts or CheckoutPathOpts for type safety
 */
export type CheckoutOpts = CheckoutBranchOpts & CheckoutPathOpts;

/**
 * Options for git commit
 */
export type CommitOpts = {
  // Existing options
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
  /** Bypass pre-commit and commit-msg hooks */
  noVerify?: boolean;
  /** GPG-sign the commit with the default key */
  gpgSign?: boolean;
  /** Do not GPG-sign the commit (override commit.gpgSign config) */
  noGpgSign?: boolean;

  // New options
  /** Suppress commit summary message */
  quiet?: boolean;
  /** Show unified diff between HEAD and working tree */
  verbose?: boolean;
  /** Read commit message from file */
  file?: string;
  /** Take existing commit message and re-edit it */
  reeditMessage?: string;
  /** Take existing commit message and reuse it */
  reuseMessage?: string;
  /** Create a fixup commit for the specified commit */
  fixup?: string;
  /** Create a squash commit for the specified commit */
  squash?: string;
  /** Override author date and ignore cached author identity */
  resetAuthor?: boolean;
  /** Add trailers to the commit message */
  trailer?: string | string[];
  /** Add Signed-off-by trailer */
  signoff?: boolean;
  /** How to clean up the commit message */
  cleanup?: 'strip' | 'whitespace' | 'verbatim' | 'scissors' | 'default';
  /** Before committing, also stage specified paths */
  include?: boolean;
  /** Commit only specified paths, ignoring staged changes */
  only?: boolean;
  /** Bypass post-rewrite hook */
  noPostRewrite?: boolean;
  /** How to show untracked files */
  untrackedFiles?: 'no' | 'normal' | 'all';
  /** Read pathspecs from file instead of command line */
  pathspecFromFile?: string;
  /** Allow commit with empty message */
  allowEmptyMessage?: boolean;
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
  // Existing options
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
  paths?: string[];

  // New options
  /** Use NUL as line terminator */
  nullTerminated?: boolean;
  /** Generate patch output */
  patch?: boolean;
  /** Generate patch and raw format together */
  patchWithRaw?: boolean;
  /** Show number of added/deleted lines in decimal notation */
  numstat?: boolean;
  /** Generate patch and diffstat together */
  patchWithStat?: boolean;
  /** Show full 40-byte hexadecimal object name in diff */
  fullIndex?: boolean;
  /** Abbreviate object names to specified length */
  abbrev?: number;
  /** Swap two inputs (show reverse diff) */
  reverse?: boolean;
  /** Detect rewrites (optionally with threshold like '50%') */
  detectRewrites?: boolean | string;
  /** Detect renames (optionally with threshold like '50%') */
  detectRenames?: boolean | string;
  /** Detect copies (optionally with threshold like '50%') */
  detectCopies?: boolean | string;
  /** Find copies harder (inspects unmodified files as source) */
  findCopiesHarder?: boolean;
  /** Rename limit threshold */
  renameLimit?: number;
  /** Look for string added/removed in a change (pickaxe) */
  pickaxe?: string;
  /** Show all files that changed, not just those with pickaxe match */
  pickaxeAll?: boolean;
  /** Treat all files as text */
  text?: boolean;
  /** Show changes relative to a merge base */
  mergeBase?: string;
  /** Compare two paths on filesystem (not in repository) */
  noIndex?: boolean;
  /** Show word diff */
  wordDiff?: 'color' | 'plain' | 'porcelain' | 'none';
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
  files: DiffEntry[];
  raw?: string;
};

/**
 * Options for git merge
 */
export type MergeOpts = {
  // Existing options
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
  strategyOption?: string | string[];
  /** Abort merge */
  abort?: boolean;
  /** Continue merge */
  continue?: boolean;
  /** Bypass pre-merge-commit hook */
  noVerify?: boolean;

  // New options
  /** Do not show diffstat at end of merge */
  noDiffstat?: boolean;
  /** Show diffstat at end of merge */
  stat?: boolean;
  /** Show compact summary of changed files */
  compactSummary?: boolean;
  /** Add log of commits being merged (optionally with count) */
  log?: boolean | number;
  /** How to clean up the commit message */
  cleanup?: 'strip' | 'whitespace' | 'verbatim' | 'scissors' | 'default';
  /** Automatically update rerere state */
  rerereAutoupdate?: boolean;
  /** Verify that commit is signed with a valid key */
  verifySignatures?: boolean;
  /** Be verbose */
  verbose?: boolean;
  /** Be quiet */
  quiet?: boolean;
  /** Quit the current in-progress merge without cleanup */
  quit?: boolean;
  /** Allow merging histories that do not share a common ancestor */
  allowUnrelatedHistories?: boolean;
  /** GPG-sign the merge commit (optionally with key id) */
  gpgSign?: boolean | string;
  /** Automatically stash before merge and unstash after */
  autostash?: boolean;
  /** Silently overwrite ignored files */
  overwriteIgnore?: boolean;
  /** Add Signed-off-by trailer */
  signoff?: boolean;
  /** Use custom branch name in merge commit message */
  intoName?: string;
};

/**
 * Merge result
 */
export type MergeResult = {
  success: boolean;
  hash?: string;
  conflicts?: string[];
  fastForward?: boolean;
};

/**
 * Options for git pull
 */
export type PullOpts = {
  // Existing options
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
  onProgress?: (progress: GitProgress) => void;

  // New options
  /** Be verbose */
  verbose?: boolean;
  /** Be quiet */
  quiet?: boolean;
  /** Fetch submodules recursively */
  recurseSubmodules?: boolean | 'yes' | 'on-demand' | 'no';
  /** Do not show diffstat at end of merge */
  noStat?: boolean;
  /** Show diffstat at end of merge */
  stat?: boolean;
  /** Show compact summary of changed files */
  compactSummary?: boolean;
  /** Add log of commits being merged (optionally with count) */
  log?: boolean | number;
  /** Add Signed-off-by trailer */
  signoff?: boolean;
  /** Squash merge */
  squash?: boolean;
  /** Perform merge and commit (or not) */
  commit?: boolean;
  /** How to clean up the commit message */
  cleanup?: string;
  /** Run hooks or not */
  verify?: boolean;
  /** Verify that commit is signed with a valid key */
  verifySignatures?: boolean;
  /** Automatically stash before pull and unstash after */
  autostash?: boolean;
  /** Merge strategy to use */
  strategy?: string;
  /** Strategy options */
  strategyOption?: string | string[];
  /** GPG-sign the merge commit (optionally with key id) */
  gpgSign?: boolean | string;
  /** Allow merging histories that do not share a common ancestor */
  allowUnrelatedHistories?: boolean;
  /** Fetch from all remotes */
  all?: boolean;
  /** Append ref names and object names to FETCH_HEAD */
  append?: boolean;
  /** Force update of local branches */
  force?: boolean;
  /** Number of parallel children for fetching submodules */
  jobs?: number;
  /** Dry run */
  dryRun?: boolean;
  /** Keep downloaded pack */
  keep?: boolean;
  /** Limit fetching depth */
  depth?: number;
  /** Deepen shallow clone since date */
  shallowSince?: string | Date;
  /** Deepen shallow clone excluding revision */
  shallowExclude?: string | string[];
  /** Deepen shallow clone by specified commits */
  deepen?: number;
  /** Convert shallow repository to complete one */
  unshallow?: boolean;
  /** Update shallow boundary if new refs need it */
  updateShallow?: boolean;
  /** Use IPv4 addresses only */
  ipv4?: boolean;
  /** Use IPv6 addresses only */
  ipv6?: boolean;
  /** Set upstream tracking for the current branch */
  setUpstream?: boolean;
};

/**
 * Options for git reset
 */
export type ResetOpts = {
  // Existing options
  /** Reset mode */
  mode?: 'soft' | 'mixed' | 'hard' | 'merge' | 'keep';

  // New options
  /** Be quiet (report only errors) */
  quiet?: boolean;
  /** Skip refreshing the index after reset */
  noRefresh?: boolean;
  /** Reset submodules */
  recurseSubmodules?: boolean;
  /** Record intention to add unstaged files */
  intentToAdd?: boolean;
  /** Read pathspecs from file instead of command line */
  pathspecFromFile?: string;
};

/**
 * Options for git rm
 */
export type RmOpts = {
  // Existing options
  /** Force removal */
  force?: boolean;
  /** Remove from index only (keep in working tree) */
  cached?: boolean;
  /** Allow recursive removal */
  recursive?: boolean;
  /** Dry run */
  dryRun?: boolean;

  // New options
  /** Suppress output */
  quiet?: boolean;
  /** Exit with zero status even if no files matched */
  ignoreUnmatch?: boolean;
  /** Allow removing files outside of sparse-checkout cone */
  sparse?: boolean;
  /** Read pathspecs from file instead of command line */
  pathspecFromFile?: string;
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
  // Existing options
  /** Stash message */
  message?: string;
  /** Include untracked files */
  includeUntracked?: boolean;
  /** Keep index */
  keepIndex?: boolean;
  /** Specific paths to stash */
  paths?: string[];

  // New options
  /** Stash only staged changes */
  staged?: boolean;
  /** Suppress output */
  quiet?: boolean;
  /** Stash all files including untracked and ignored */
  all?: boolean;
  /** Read pathspecs from file instead of command line */
  pathspecFromFile?: string;
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
  // Existing options
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

  // New options
  /** Try to guess remote tracking branch if target not found */
  guess?: boolean;
  /** Suppress progress reporting */
  quiet?: boolean;
  /** Update submodules */
  recurseSubmodules?: boolean;
  /** Merge local modifications with the new branch */
  merge?: boolean;
  /** Conflict style for merge conflicts */
  conflict?: 'merge' | 'diff3' | 'zdiff3';
  /** Force switch (throw away local modifications) */
  force?: boolean;
  /** Create new orphan branch */
  orphan?: boolean;
  /** Silently overwrite ignored files */
  overwriteIgnore?: boolean;
  /** Ignore if branch is checked out in other worktrees */
  ignoreOtherWorktrees?: boolean;
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
  // Existing options
  /** List pattern */
  pattern?: string;
  /** Sort by */
  sort?: string;

  // New options
  /** Print n lines of tag message */
  lines?: number;
  /** Only list tags that contain the specified commit */
  contains?: string;
  /** Only list tags that don't contain the specified commit */
  noContains?: string;
  /** Only list tags whose tips are reachable from the specified commit */
  merged?: string;
  /** Only list tags whose tips are not reachable from the specified commit */
  noMerged?: string;
  /** Only list tags that point at the specified object */
  pointsAt?: string;
  /** Sorting and filtering are case insensitive */
  ignoreCase?: boolean;
};

/**
 * Options for creating a tag
 */
export type TagCreateOpts = {
  // Existing options
  /** Tag message (creates annotated tag) */
  message?: string;
  /** Force (overwrite existing tag) */
  force?: boolean;
  /** Commit to tag */
  commit?: string;
  /** GPG-sign the tag with the default key */
  sign?: boolean;

  // New options
  /** Read tag message from file */
  file?: string;
  /** Add trailers to the tag message */
  trailer?: string | string[];
  /** How to clean up the tag message */
  cleanup?: string;
  /** Key to use for GPG signing */
  localUser?: string;
  /** Create the tag's reflog */
  createReflog?: boolean;
};

// =============================================================================
// Medium Priority Commands
// =============================================================================

/**
 * Options for git cherry-pick
 */
export type CherryPickOpts = {
  // Existing options
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
  /** Bypass pre-commit hook */
  noVerify?: boolean;

  // New options
  /** How to clean up the commit message */
  cleanup?: 'strip' | 'whitespace' | 'verbatim' | 'scissors' | 'default';
  /** Automatically update rerere state */
  rerereAutoupdate?: boolean;
  /** Strategy options */
  strategyOption?: string | string[];
  /** GPG-sign the commit (optionally with key id) */
  gpgSign?: boolean | string;
  /** Append (cherry picked from ...) line to original message */
  appendCommitName?: boolean;
  /** Fast-forward if possible */
  ff?: boolean;
  /** Allow recording empty commits */
  allowEmpty?: boolean;
  /** Allow empty commit messages */
  allowEmptyMessage?: boolean;
  /** How to handle originally empty commits */
  empty?: 'drop' | 'keep' | 'stop';
};

/**
 * Options for git clean
 */
export type CleanOpts = {
  // Existing options
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
  paths?: string[];

  // New options
  /** Suppress output */
  quiet?: boolean;
  /** Exclude files matching pattern */
  exclude?: string | string[];
};

/**
 * Options for git mv
 */
export type MvOpts = {
  // Existing options
  /** Force move */
  force?: boolean;
  /** Dry run */
  dryRun?: boolean;

  // New options
  /** Be verbose */
  verbose?: boolean;
  /** Skip errors */
  skipErrors?: boolean;
  /** Allow moving files outside of sparse-checkout cone */
  sparse?: boolean;
};

/**
 * Options for git rebase
 */
export type RebaseOpts = {
  // Existing options
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
  /** Bypass pre-rebase hook */
  noVerify?: boolean;

  // New options
  /** Keep the commits at the base unchanged */
  keepBase?: boolean;
  /** Be quiet */
  quiet?: boolean;
  /** Be verbose */
  verbose?: boolean;
  /** Add signoff */
  signoff?: boolean;
  /** Set committer date to author date */
  committerDateIsAuthorDate?: boolean;
  /** Set author date to committer date */
  resetAuthorDate?: boolean;
  /** Ignore whitespace differences */
  ignoreWhitespace?: boolean;
  /** Whitespace handling mode */
  whitespace?: string;
  /** Force rebase even if already up-to-date */
  forceRebase?: boolean;
  /** Create merge commit instead of rebasing */
  noFf?: boolean;
  /** Use apply strategy */
  apply?: boolean;
  /** Automatically update rerere state */
  rerereAutoupdate?: boolean;
  /** How to handle empty commits */
  empty?: 'drop' | 'keep' | 'ask';
  /** Automatically squash fixup commits */
  autosquash?: boolean;
  /** Update refs that point to rebased commits */
  updateRefs?: boolean;
  /** GPG-sign commits */
  gpgSign?: boolean | string;
  /** Automatically stash/unstash */
  autostash?: boolean;
  /** Execute command after each commit */
  exec?: string;
  /** Use fork point for base */
  forkPoint?: boolean;
  /** Merge strategy */
  strategy?: string;
  /** Strategy options */
  strategyOption?: string | string[];
  /** Rebase from root commit */
  root?: boolean;
  /** Reschedule failed exec commands */
  rescheduleFailedExec?: boolean;
  /** Reapply cherry-picks */
  reapplyCherryPicks?: boolean;
};

/**
 * Options for git restore
 */
export type RestoreOpts = {
  // Existing options
  /** Restore staged files */
  staged?: boolean;
  /** Restore working tree files */
  worktree?: boolean;
  /** Source to restore from */
  source?: string;
  /** Ours or theirs for conflicts */
  ours?: boolean;
  theirs?: boolean;

  // New options
  /** Ignore unmerged entries */
  ignoreUnmerged?: boolean;
  /** Allow overlay mode (default is no-overlay) */
  overlay?: boolean;
  /** Suppress output */
  quiet?: boolean;
  /** Recurse into submodules */
  recurseSubmodules?: boolean;
  /** Show progress */
  progress?: boolean;
  /** Attempt to recreate merge conflicts */
  merge?: boolean;
  /** Conflict style for merge conflicts */
  conflict?: 'merge' | 'diff3' | 'zdiff3';
  /** Ignore skip-worktree bits */
  ignoreSkipWorktreeBits?: boolean;
  /** Read pathspecs from file */
  pathspecFromFile?: string;
};

/**
 * Options for git revert
 */
export type RevertOpts = {
  // Existing options
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
  /** Bypass pre-commit hook */
  noVerify?: boolean;

  // New options
  /** How to clean up the commit message */
  cleanup?: 'strip' | 'whitespace' | 'verbatim' | 'scissors' | 'default';
  /** Add signoff */
  signoff?: boolean;
  /** Automatically update rerere state */
  rerereAutoupdate?: boolean;
  /** Merge strategy */
  strategy?: string;
  /** Strategy options */
  strategyOption?: string | string[];
  /** GPG-sign the commit */
  gpgSign?: boolean | string;
  /** Add reference to reverted commit */
  reference?: boolean;
};

/**
 * Options for git show
 */
export type ShowOpts = {
  // Existing options
  /** Show stat only */
  stat?: boolean;
  /** Show name only */
  nameOnly?: boolean;
  /** Show name and status */
  nameStatus?: boolean;
  /** Format string */
  format?: string;

  // New options
  /** Suppress output */
  quiet?: boolean;
  /** Show source ref for each commit */
  source?: boolean;
  /** Use mailmap for author/committer names */
  useMailmap?: boolean;
  /** Only decorate refs matching pattern */
  decorateRefs?: string;
  /** Exclude refs matching pattern from decoration */
  decorateRefsExclude?: string;
  /** Decorate style */
  decorate?: 'short' | 'full' | 'auto' | 'no';
};

// ==========================================================================
// rev-parse Types
// ==========================================================================

/**
 * Options that return a single path from rev-parse
 *
 * These options are mutually exclusive - only one can be specified at a time.
 */
export type RevParsePathQuery =
  | { gitDir: true }
  | { absoluteGitDir: true }
  | { gitCommonDir: true }
  | { showToplevel: true }
  | { showCdup: true }
  | { showPrefix: true }
  | { showSuperprojectWorkingTree: true }
  | { sharedIndexPath: true }
  | { gitPath: string }
  | { resolveGitDir: string };

/**
 * Options that return a boolean from rev-parse
 *
 * These options are mutually exclusive - only one can be specified at a time.
 */
export type RevParseBooleanQuery =
  | { isInsideGitDir: true }
  | { isInsideWorkTree: true }
  | { isBareRepository: true }
  | { isShallowRepository: true };

/**
 * Common options for list queries
 */
export type RevParseListOpts = {
  /** Exclude refs matching pattern */
  exclude?: string;
  /**
   * Exclude refs that would be hidden by the specified operation.
   * - 'fetch': hidden by `transfer.hideRefs` for fetch
   * - 'receive': hidden by `receive.hideRefs`
   * - 'uploadpack': hidden by `uploadpack.hideRefs`
   */
  excludeHidden?: 'fetch' | 'receive' | 'uploadpack';
};

/**
 * Options that return a list of refs from rev-parse
 *
 * These options are mutually exclusive - only one can be specified at a time.
 * For branches/tags/remotes, you can pass `true` to list all, or a pattern string to filter.
 */
export type RevParseListQuery =
  | ({ all: true } & RevParseListOpts)
  | ({ branches: true | string } & RevParseListOpts)
  | ({ tags: true | string } & RevParseListOpts)
  | ({ remotes: true | string } & RevParseListOpts)
  | ({ glob: string } & RevParseListOpts)
  | { disambiguate: string };

/**
 * Options that modify how a ref is resolved
 */
export type RevParseRefOpts = {
  /** Verify that the parameter can be turned into a raw SHA-1 (stricter parsing) */
  verify?: boolean;
  /** Shorten to unique prefix (true for default length, number for specific length) */
  short?: boolean | number;
  /** Output abbreviated ref name (e.g., "main" instead of SHA) */
  abbrevRef?: boolean | 'strict' | 'loose';
  /** Output in a form as close to the original input as possible */
  symbolic?: boolean;
  /** Output full refname (e.g., "refs/heads/main" instead of "main") */
  symbolicFullName?: boolean;
  /**
   * In --verify mode, exit silently with non-zero status on invalid input
   * instead of outputting an error message. Only works with --verify.
   */
  quiet?: boolean;
};

/**
 * Options that return other information from rev-parse
 */
export type RevParseOtherQuery =
  | { showObjectFormat: true | 'storage' | 'input' | 'output' }
  | { showRefFormat: true }
  | { localEnvVars: true };

/**
 * Path format option for path queries
 */
export type RevParsePathFormat = 'absolute' | 'relative';

/**
 * Additional options for path queries
 */
export type RevParsePathOpts = {
  /** Control whether paths are output as absolute or relative */
  pathFormat?: RevParsePathFormat;
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

  // New options
  /** Do not fetch from remotes */
  noFetch?: boolean;
  /** Checkout the superproject's recorded commit */
  checkout?: boolean;
  /** Merge the commit into the current branch */
  merge?: boolean;
  /** Rebase the current branch onto the commit */
  rebase?: boolean;
  /** Use recommended shallow clone depth */
  recommendShallow?: boolean;
  /** Reference repository for shared clone */
  reference?: string;
  /** Clone only one branch */
  singleBranch?: boolean;
  /** Partial clone filter specification */
  filter?: string;
};

/**
 * Options for adding a submodule
 */
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

/**
 * Options for deinitializing a submodule
 */
export type SubmoduleDeinitOpts = {
  /** Force deinitialization */
  force?: boolean;
  /** Deinitialize all submodules */
  all?: boolean;
};

/**
 * Options for submodule status
 */
export type SubmoduleStatusOpts = {
  /** Check submodules recursively */
  recursive?: boolean;
};

/**
 * Options for submodule summary
 */
export type SubmoduleSummaryOpts = {
  /** Limit to the specified number of commits */
  limit?: number;
  /** Show files in the summary */
  files?: boolean;
};

/**
 * Options for submodule foreach
 */
export type SubmoduleForeachOpts = {
  /** Run the command recursively in nested submodules */
  recursive?: boolean;
};

/**
 * Options for submodule sync
 */
export type SubmoduleSyncOpts = {
  /** Sync recursively in nested submodules */
  recursive?: boolean;
};

/**
 * Options for submodule set-branch
 */
export type SubmoduleSetBranchOpts = {
  /** Set the default tracking branch */
  default?: boolean;
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
  include?: string[];
  exclude?: string[];
};

/**
 * Options for LFS push
 */
export type LfsPushOpts = {
  remote?: string;
  ref?: string;

  // New options
  /** Dry run - show what would be pushed without actually pushing */
  dryRun?: boolean;
  /** Push specified object IDs (OID hashes) instead of all objects */
  objectId?: string | string[];
};

/**
 * Options for LFS status
 */
export type LfsStatusOpts = {
  json?: boolean;

  // New options
  /** Machine-readable output */
  porcelain?: boolean;
};

/**
 * Options for LFS prune
 */
export type LfsPruneOpts = {
  /** Force prune (remove unreferenced objects immediately) */
  force?: boolean;
  /** Dry run - show what would be pruned without actually pruning */
  dryRun?: boolean;
  /** Verify remote copies before pruning */
  verifyRemote?: boolean;
  /** Verify unreferenced copies */
  verifyUnreferenced?: boolean;

  // New options
  /** Only prune objects not accessed recently */
  recent?: boolean;
  /** Show verbose output */
  verbose?: boolean;
  /** When unverified behavior: panic or ignore */
  whenUnverified?: 'panic' | 'ignore';
};

/**
 * Options for LFS fetch
 */
export type LfsFetchOpts = {
  /** Fetch all LFS objects for all refs */
  all?: boolean;
  /** Include patterns */
  include?: string | string[];
  /** Exclude patterns */
  exclude?: string | string[];
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
  /** Remote to fetch from */
  remote?: string;
  /** Refs to fetch */
  refs?: string | string[];
};

/**
 * Options for repository-level LFS install
 *
 * Used with `repo.lfs.install()` for repository-local LFS configuration.
 *
 * @remarks
 * Internally runs `git lfs install --local` by default, which writes to
 * the repository's .git/config file. This ensures LFS configuration is
 * scoped to the current repository only.
 *
 * For global (user-level) or system-wide installation, use `git.lfs.install()` instead.
 */
export type RepoLfsInstallOpts = {
  /** Overwrite existing hooks */
  force?: boolean;
  /**
   * Install for worktree only (instead of repository)
   *
   * @remarks
   * Internally uses `--worktree` flag instead of `--local`.
   * Requires Git 2.20.0+ with worktreeConfig extension enabled.
   */
  worktree?: boolean;
  /** Skip smudge filter (don't download during checkout) */
  skipSmudge?: boolean;
};

/**
 * Options for repository-level LFS uninstall
 *
 * Used with `repo.lfs.uninstall()` for repository-local LFS configuration removal.
 *
 * @remarks
 * Internally runs `git lfs uninstall --local` by default, which modifies
 * the repository's .git/config file only.
 *
 * For global or system-wide uninstallation, use `git.lfs.uninstall()` instead.
 */
export type RepoLfsUninstallOpts = {
  /**
   * Uninstall for worktree only (instead of repository)
   *
   * @remarks
   * Internally uses `--worktree` flag instead of `--local`.
   * Requires Git 2.20.0+ with worktreeConfig extension enabled.
   */
  worktree?: boolean;
};

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
  /** Checkout status */
  status: 'checked-out' | 'not-checked-out';
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
  include?: string | string[];
  /** Exclude patterns */
  exclude?: string | string[];
  /** Show filenames only */
  nameOnly?: boolean;
  /** Output in JSON format */
  json?: boolean;
  /** Ref to list files for */
  ref?: string;
};

/**
 * LFS track entry
 */
export type LfsTrackEntry = {
  /** Pattern being tracked */
  pattern: string;
  /** Source file (e.g., .gitattributes) */
  source: string;
  /** Whether files matching pattern are lockable */
  lockable: boolean;
};

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
  /** Include patterns */
  include?: string | string[];
  /** Exclude patterns */
  exclude?: string | string[];
};

/**
 * Options for LFS migrate info
 */
export type LfsMigrateInfoOpts = {
  /** Only show files above this size */
  above?: string | number;
  /** Show top N files */
  top?: number;
  /** Size unit (b, kb, mb, gb) */
  unit?: 'b' | 'kb' | 'mb' | 'gb';
  /** Show pointer files */
  pointers?: 'follow' | 'no-follow' | 'ignore';
  /** Fix up tracking patterns */
  fixup?: boolean;
  /** Include patterns */
  include?: string | string[];
  /** Exclude patterns */
  exclude?: string | string[];
  /** Include refs */
  includeRef?: string | string[];
  /** Exclude refs */
  excludeRef?: string | string[];
  /** Skip fetching from remote */
  skipFetch?: boolean;
  /** Operate on all refs */
  everything?: boolean;
  /** Confirm destructive operation */
  yesReally?: boolean;
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
  /** Object IDs to import */
  object?: string | string[];
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

/**
 * LFS environment info
 */
export type LfsEnvInfo = {
  /** LFS version */
  lfsVersion: string;
  /** Git version */
  gitVersion: string;
  /** Endpoint URL */
  endpoint: string;
  /** SSH endpoint */
  sshEndpoint?: string;
  /** Local working directory */
  localWorkingDir?: string;
  /** Local git directory */
  localGitDir?: string;
  /** Local git storage directory */
  localGitStorageDir?: string;
  /** Local media directory */
  localMediaDir?: string;
  /** Local reference directories */
  localReferenceDirs?: string;
  /** Temp directory */
  tempDir?: string;
  /** Concurrent transfers */
  concurrentTransfers?: number;
  /** TUS transfers enabled */
  tusTransfers?: boolean;
  /** Basic transfers only */
  basicTransfersOnly?: boolean;
  /** Skip download errors */
  skipDownloadErrors?: boolean;
  /** Fetch recent always */
  fetchRecentAlways?: boolean;
  /** Fetch recent refs days */
  fetchRecentRefsDays?: number;
  /** Fetch recent commits days */
  fetchRecentCommitsDays?: number;
  /** Fetch recent refs include remotes */
  fetchRecentRefsIncludeRemotes?: boolean;
  /** Prune offset days */
  pruneOffsetDays?: number;
  /** Prune verify remote always */
  pruneVerifyRemoteAlways?: boolean;
  /** Prune remote name */
  pruneRemoteName?: string;
  /** Access mode for downloads */
  accessDownload?: string;
  /** Access mode for uploads */
  accessUpload?: string;
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
  oids?: string[];
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
  oids?: string[];
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
  /**
   * Commit-ish to checkout (branch, tag, or commit hash)
   *
   * @example
   * ```typescript
   * // Checkout a specific commit in detached mode
   * await repo.worktree.add('/tmp/worktree', { detach: true, commitish: 'abc1234' });
   *
   * // Checkout a tag
   * await repo.worktree.add('/tmp/worktree', { detach: true, commitish: 'v1.0.0' });
   *
   * // Checkout a branch
   * await repo.worktree.add('/tmp/worktree', { commitish: 'feature-branch' });
   * ```
   */
  commitish?: string;
  /** Branch name to create (-b flag) */
  branch?: string;
  /** Create detached HEAD */
  detach?: boolean;
  /** Track remote branch */
  track?: boolean;

  // New options
  /** Force creation even if branch is already checked out */
  force?: boolean;
  /** Checkout the worktree (true) or not (false) */
  checkout?: boolean;
  /** Keep the worktree locked after creation */
  lock?: boolean;
  /** Create worktree with orphan branch */
  orphan?: boolean;
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

  // New options
  /** Expire worktrees older than the given time */
  expire?: string;
};

/**
 * Options for worktree move
 */
export type WorktreeMoveOpts = {
  /** Force move even if destination exists */
  force?: boolean;
};

/**
 * Options for worktree repair
 */
// biome-ignore lint/complexity/noBannedTypes: Reserved for future options
export type WorktreeRepairOpts = {};

/**
 * Options for locking a worktree
 */
export type WorktreeLockOpts = {
  /** Reason for locking */
  reason?: string;
};

/**
 * Worktree operations
 *
 * Wraps: `git worktree` subcommands
 */
export interface WorktreeOperations {
  /**
   * List all worktrees
   *
   * Wraps: `git worktree list --porcelain`
   */
  list(opts?: ExecOpts): Promise<Worktree[]>;

  /**
   * Add a new worktree and return a repository object for it
   *
   * Wraps: `git worktree add <path>`
   *
   * @returns A WorktreeRepo instance for the newly created worktree
   */
  add(path: string, opts?: WorktreeAddOpts & ExecOpts): Promise<WorktreeRepo>;

  /**
   * Remove a worktree
   *
   * Wraps: `git worktree remove <path>`
   */
  remove(path: string, opts?: WorktreeRemoveOpts & ExecOpts): Promise<void>;

  /**
   * Prune stale worktree references
   *
   * Wraps: `git worktree prune`
   */
  prune(opts?: WorktreePruneOpts & ExecOpts): Promise<string[]>;

  /**
   * Lock a worktree
   *
   * Wraps: `git worktree lock <path>`
   */
  lock(path: string, opts?: WorktreeLockOpts & ExecOpts): Promise<void>;

  /**
   * Unlock a worktree
   *
   * Wraps: `git worktree unlock <path>`
   */
  unlock(path: string, opts?: ExecOpts): Promise<void>;

  /**
   * Move a worktree to a new location and return a repository object for it
   *
   * Wraps: `git worktree move <src> <dst>`
   *
   * @returns A WorktreeRepo instance for the worktree at the new location
   */
  move(src: string, dst: string, opts?: WorktreeMoveOpts & ExecOpts): Promise<WorktreeRepo>;

  /**
   * Repair worktree administrative files
   *
   * Wraps: `git worktree repair`
   */
  repair(paths?: string[], opts?: ExecOpts): Promise<void>;
}

/**
 * LFS operations
 *
 * Wraps: `git lfs` subcommands
 */
export interface LfsOperations {
  /**
   * Pull LFS objects
   *
   * Wraps: `git lfs pull`
   */
  pull(opts?: LfsPullOpts & ExecOpts): Promise<void>;

  /**
   * Push LFS objects
   *
   * Wraps: `git lfs push`
   */
  push(opts?: LfsPushOpts & ExecOpts): Promise<void>;

  /**
   * Get LFS status
   *
   * Wraps: `git lfs status`
   */
  status(opts?: LfsStatusOpts & ExecOpts): Promise<LfsStatus>;

  /**
   * Prune old and unreferenced LFS objects from local storage
   *
   * Wraps: `git lfs prune`
   */
  prune(opts?: LfsPruneOpts & ExecOpts): Promise<void>;

  /**
   * Fetch LFS objects from remote
   *
   * Wraps: `git lfs fetch`
   */
  fetch(opts?: LfsFetchOpts & ExecOpts): Promise<void>;

  /**
   * Install Git LFS hooks for this repository
   *
   * Wraps: `git lfs install --local`
   *
   * Installs LFS hooks to the repository's .git/config file.
   * This ensures LFS configuration is scoped to this repository only.
   *
   * @remarks
   * Internally always adds `--local` flag (or `--worktree` if specified).
   * For global or system-wide installation, use `git.lfs.install()` instead.
   *
   * @example
   * ```typescript
   * // Install LFS locally for this repository
   * await repo.lfs.install();
   *
   * // Install for worktree only (Git 2.20.0+)
   * await repo.lfs.install({ worktree: true });
   * ```
   */
  install(opts?: RepoLfsInstallOpts & ExecOpts): Promise<void>;

  /**
   * Uninstall Git LFS hooks from this repository
   *
   * Wraps: `git lfs uninstall --local`
   *
   * Removes LFS hooks from the repository's .git/config file.
   *
   * @remarks
   * Internally always adds `--local` flag (or `--worktree` if specified).
   * For global or system-wide uninstallation, use `git.lfs.uninstall()` instead.
   *
   * @example
   * ```typescript
   * // Uninstall LFS from this repository
   * await repo.lfs.uninstall();
   * ```
   */
  uninstall(opts?: RepoLfsUninstallOpts & ExecOpts): Promise<void>;

  /**
   * List LFS files in the repository
   *
   * Wraps: `git lfs ls-files`
   */
  lsFiles(opts?: LfsLsFilesOpts & ExecOpts): Promise<LfsFileEntry[]>;

  /**
   * Track files with LFS
   *
   * Wraps: `git lfs track <pattern>...`
   */
  track(patterns: string | string[], opts?: LfsTrackOpts & ExecOpts): Promise<void>;

  /**
   * List tracked patterns
   *
   * Wraps: `git lfs track` (without arguments)
   */
  trackList(opts?: ExecOpts): Promise<LfsTrackEntry[]>;

  /**
   * Untrack files from LFS
   *
   * Wraps: `git lfs untrack <pattern>...`
   */
  untrack(patterns: string | string[], opts?: ExecOpts): Promise<void>;

  /**
   * Lock a file
   *
   * Wraps: `git lfs lock <path>`
   */
  lock(path: string, opts?: LfsLockOpts & ExecOpts): Promise<LfsLockEntry>;

  /**
   * Unlock a file
   *
   * Wraps: `git lfs unlock <path>`
   */
  unlock(pathOrId: string, opts?: LfsUnlockOpts & ExecOpts): Promise<void>;

  /**
   * List locked files
   *
   * Wraps: `git lfs locks`
   */
  locks(opts?: LfsLocksOpts & ExecOpts): Promise<LfsLockEntry[]>;

  /**
   * Checkout LFS files (replace pointer files with actual content)
   *
   * Wraps: `git lfs checkout`
   */
  checkout(patterns?: string | string[], opts?: LfsCheckoutOpts & ExecOpts): Promise<void>;

  /**
   * Show information about LFS files that would be migrated
   *
   * Wraps: `git lfs migrate info`
   */
  migrateInfo(opts?: LfsMigrateInfoOpts & ExecOpts): Promise<string>;

  /**
   * Import files into LFS
   *
   * Wraps: `git lfs migrate import`
   */
  migrateImport(opts?: LfsMigrateImportOpts & ExecOpts): Promise<void>;

  /**
   * Export files from LFS
   *
   * Wraps: `git lfs migrate export`
   */
  migrateExport(opts?: LfsMigrateExportOpts & ExecOpts): Promise<void>;

  /**
   * Get LFS environment information
   *
   * Wraps: `git lfs env`
   */
  env(opts?: ExecOpts): Promise<LfsEnvInfo>;

  /**
   * Get Git LFS version
   *
   * Wraps: `git lfs version`
   */
  version(opts?: ExecOpts): Promise<string>;
}

/**
 * LFS Extra operations interface (inspired by fs-extra)
 *
 * Additional LFS utilities not part of the core LFS commands.
 * These enable advanced patterns like 2-phase commit/fetch.
 */
export interface LfsExtraOperations {
  /**
   * Pre-upload LFS objects before refs push (§10.3)
   *
   * Enables 2-phase commit pattern for improved reliability with large files.
   * Objects are uploaded in batches to handle Windows command line limits.
   *
   * @example
   * ```typescript
   * // Phase 1: Upload LFS objects first
   * await repo.lfsExtra.preUpload({ onProgress: handleProgress });
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
 * Branch operations
 *
 * Wraps: `git branch` subcommands
 */
export interface BranchOperations {
  /**
   * List branches
   *
   * Wraps: `git branch --list`
   */
  list(opts?: BranchOpts & ExecOpts): Promise<BranchInfo[]>;

  /**
   * Get current branch name
   *
   * Wraps: `git branch --show-current`
   */
  current(opts?: ExecOpts): Promise<string | null>;

  /**
   * Create a new branch
   *
   * Wraps: `git branch <name>`
   */
  create(name: string, opts?: BranchCreateOpts & ExecOpts): Promise<void>;

  /**
   * Delete a branch
   *
   * Wraps: `git branch -d|-D <name>`
   */
  delete(name: string, opts?: BranchDeleteOpts & ExecOpts): Promise<void>;

  /**
   * Rename a branch
   *
   * Wraps: `git branch -m <old> <new>`
   */
  rename(oldName: string, newName: string, opts?: ExecOpts): Promise<void>;
}

/**
 * Stash operations
 *
 * Wraps: `git stash` subcommands
 */
export interface StashOperations {
  /**
   * List stash entries
   *
   * Wraps: `git stash list`
   */
  list(opts?: ExecOpts): Promise<StashEntry[]>;

  /**
   * Push changes to stash
   *
   * Wraps: `git stash push`
   */
  push(opts?: StashPushOpts & ExecOpts): Promise<void>;

  /**
   * Pop stash entry
   *
   * Wraps: `git stash pop`
   */
  pop(opts?: StashApplyOpts & ExecOpts): Promise<void>;

  /**
   * Apply stash entry (without removing from stash)
   *
   * Wraps: `git stash apply`
   */
  apply(opts?: StashApplyOpts & ExecOpts): Promise<void>;

  /**
   * Drop a stash entry
   *
   * Wraps: `git stash drop`
   */
  drop(index?: number, opts?: ExecOpts): Promise<void>;

  /**
   * Clear all stash entries
   *
   * Wraps: `git stash clear`
   */
  clear(opts?: ExecOpts): Promise<void>;
}

/**
 * Tag operations
 *
 * Wraps: `git tag` subcommands
 */
export interface TagOperations {
  /**
   * List tags
   *
   * Wraps: `git tag --list`
   */
  list(opts?: TagListOpts & ExecOpts): Promise<string[]>;

  /**
   * Create a tag
   *
   * Wraps: `git tag <name>`
   */
  create(name: string, opts?: TagCreateOpts & ExecOpts): Promise<void>;

  /**
   * Delete a tag
   *
   * Wraps: `git tag -d <name>`
   */
  delete(name: string, opts?: ExecOpts): Promise<void>;

  /**
   * Get tag info
   *
   * Wraps: `git tag -v <name>` / `git show <tag>`
   */
  show(name: string, opts?: ExecOpts): Promise<TagInfo>;
}

// =============================================================================
// Remote Operations
// =============================================================================

/**
 * Remote information
 */
export type RemoteInfo = {
  /** Remote name */
  name: string;
  /** Fetch URL */
  fetchUrl: string;
  /** Push URL (may differ from fetchUrl) */
  pushUrl: string;
};

/**
 * Options for adding a remote
 */
export type RemoteAddOpts = {
  /** Set up tracking for default branch */
  track?: string;
  /** Only fetch specified branches */
  fetch?: boolean;
  /** Set up as mirror */
  mirror?: 'fetch' | 'push';

  // New options
  /** Import tags from remote (true) or not (false) */
  tags?: boolean;
};

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

/**
 * Options for getting/setting remote URL
 */
export type RemoteUrlOpts = {
  /** Target push URL instead of fetch URL */
  push?: boolean;
};

/**
 * Remote operations
 *
 * Wraps: `git remote` subcommands
 */
export interface RemoteOperations {
  /**
   * List remotes
   *
   * Wraps: `git remote -v`
   */
  list(opts?: ExecOpts): Promise<RemoteInfo[]>;

  /**
   * Add a remote
   *
   * Wraps: `git remote add <name> <url>`
   */
  add(name: string, url: string, opts?: RemoteAddOpts & ExecOpts): Promise<void>;

  /**
   * Remove a remote
   *
   * Wraps: `git remote remove <name>`
   */
  remove(name: string, opts?: ExecOpts): Promise<void>;

  /**
   * Rename a remote
   *
   * Wraps: `git remote rename <old> <new>`
   */
  rename(oldName: string, newName: string, opts?: ExecOpts): Promise<void>;

  /**
   * Get remote URL
   *
   * Wraps: `git remote get-url <name>`
   */
  getUrl(name: string, opts?: RemoteUrlOpts & ExecOpts): Promise<string>;

  /**
   * Set remote URL
   *
   * Wraps: `git remote set-url <name> <url>`
   */
  setUrl(name: string, url: string, opts?: RemoteUrlOpts & ExecOpts): Promise<void>;

  /**
   * Set remote HEAD
   *
   * Wraps: `git remote set-head <remote> <branch>`
   */
  setHead(remote: string, branch?: string, opts?: RemoteSetHeadOpts & ExecOpts): Promise<void>;

  /**
   * Show information about a remote
   *
   * Wraps: `git remote show <remote>`
   */
  show(remote: string, opts?: RemoteShowOpts & ExecOpts): Promise<string>;

  /**
   * Prune stale remote-tracking branches
   *
   * Wraps: `git remote prune <remote>`
   */
  prune(remote: string, opts?: RemotePruneOpts & ExecOpts): Promise<string[]>;

  /**
   * Update remotes
   *
   * Wraps: `git remote update`
   */
  update(remotes?: string[], opts?: RemoteUpdateOpts & ExecOpts): Promise<void>;

  /**
   * Set tracked branches for a remote
   *
   * Wraps: `git remote set-branches <remote> <branch>...`
   */
  setBranches(
    remote: string,
    branches: string[],
    opts?: RemoteSetBranchesOpts & ExecOpts,
  ): Promise<void>;
}

// =============================================================================
// Config Operations (Repository-level)
// =============================================================================

/**
 * Config entry
 */
export type ConfigEntry = {
  /** Config key (e.g., 'user.name') */
  key: string;
  /** Config value */
  value: string;
};

/**
 * Options for config get
 */
export type ConfigGetOpts = {
  /** Get all values for multi-valued key */
  all?: boolean;

  // New options
  /** Type to interpret the value as */
  type?: 'bool' | 'int' | 'bool-or-int' | 'path' | 'expiry-date' | 'color';
  /** Default value to use if the key is not set */
  default?: string;
};

/**
 * Options for config set
 */
export type ConfigSetOpts = {
  /** Add value to multi-valued key instead of replacing */
  add?: boolean;
};

/**
 * Options for config list
 */
export type ConfigListOpts = {
  /** Show origin of each value */
  showOrigin?: boolean;
  /** Show scope of each value */
  showScope?: boolean;

  // New options
  /** Respect include directives */
  includes?: boolean;
  /** Only show config key names */
  nameOnly?: boolean;
};

// =============================================================================
// Typed Config Keys
// =============================================================================

/**
 * Well-known git config keys with their expected value types
 *
 * This provides type safety for common config operations.
 * For arbitrary keys, use getRaw/setRaw.
 */
export type ConfigSchema = {
  // User settings
  'user.name': string;
  'user.email': string;
  'user.signingkey': string;

  // Core settings
  'core.autocrlf': 'true' | 'false' | 'input';
  'core.filemode': 'true' | 'false';
  'core.ignorecase': 'true' | 'false';
  'core.bare': 'true' | 'false';
  'core.logallrefupdates': 'true' | 'false' | 'always';
  'core.repositoryformatversion': string;
  'core.quotepath': 'true' | 'false';
  'core.editor': string;
  'core.pager': string;
  'core.excludesfile': string;
  'core.attributesfile': string;
  'core.hooksPath': string;
  'core.sshCommand': string;

  // Init settings
  'init.defaultBranch': string;

  // Commit settings
  'commit.gpgsign': 'true' | 'false';
  'commit.template': string;

  // Tag settings
  'tag.gpgsign': 'true' | 'false';
  'tag.forcesignannotated': 'true' | 'false';

  // Push settings
  'push.default': 'nothing' | 'current' | 'upstream' | 'tracking' | 'simple' | 'matching';
  'push.followTags': 'true' | 'false';
  'push.autoSetupRemote': 'true' | 'false';
  'push.gpgSign': 'true' | 'false' | 'if-asked';

  // Pull settings
  'pull.rebase': 'true' | 'false' | 'merges' | 'interactive';
  'pull.ff': 'true' | 'false' | 'only';

  // Fetch settings
  'fetch.prune': 'true' | 'false';
  'fetch.pruneTags': 'true' | 'false';

  // Merge settings
  'merge.ff': 'true' | 'false' | 'only';
  'merge.conflictstyle': 'merge' | 'diff3' | 'zdiff3';

  // Rebase settings
  'rebase.autoStash': 'true' | 'false';
  'rebase.autoSquash': 'true' | 'false';
  'rebase.updateRefs': 'true' | 'false';

  // Diff settings
  'diff.algorithm': 'default' | 'minimal' | 'patience' | 'histogram';
  'diff.colorMoved': 'no' | 'default' | 'plain' | 'blocks' | 'zebra' | 'dimmed-zebra';

  // Color settings
  'color.ui': 'auto' | 'always' | 'never' | 'true' | 'false';

  // Credential settings
  'credential.helper': string;

  // GPG settings
  'gpg.format': 'openpgp' | 'x509' | 'ssh';
  'gpg.program': string;
  'gpg.ssh.program': string;
  'gpg.ssh.allowedSignersFile': string;

  // HTTP settings
  'http.proxy': string;
  'http.sslVerify': 'true' | 'false';

  // LFS settings
  'lfs.fetchexclude': string;
  'lfs.fetchinclude': string;

  // Safe directory
  'safe.directory': string;
};

/**
 * Known config key names
 */
export type ConfigKey = keyof ConfigSchema;

/**
 * Config operations (repository-level)
 *
 * Wraps: `git config` subcommands
 */
export interface ConfigOperations {
  /**
   * Get a typed config value
   *
   * Wraps: `git config --get <key>`
   *
   * @returns Config value or undefined if not set
   */
  get<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<ConfigSchema[K] | undefined>;

  /**
   * Get all values for a multi-valued config key
   *
   * Wraps: `git config --get-all <key>`
   */
  getAll<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<ConfigSchema[K][]>;

  /**
   * Set a typed config value
   *
   * Wraps: `git config <key> <value>`
   */
  set<K extends ConfigKey>(key: K, value: ConfigSchema[K], opts?: ExecOpts): Promise<void>;

  /**
   * Add a value to a multi-valued config key
   *
   * Wraps: `git config --add <key> <value>`
   */
  add<K extends ConfigKey>(key: K, value: ConfigSchema[K], opts?: ExecOpts): Promise<void>;

  /**
   * Unset a typed config value
   *
   * Wraps: `git config --unset <key>`
   */
  unset<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<void>;

  /**
   * Get a raw config value (for arbitrary keys)
   *
   * Wraps: `git config --get <key>`
   *
   * @returns Config value or undefined if not set
   */
  getRaw(key: string, opts?: ConfigGetOpts & ExecOpts): Promise<string | string[] | undefined>;

  /**
   * Set a raw config value (for arbitrary keys)
   *
   * Wraps: `git config <key> <value>`
   */
  setRaw(key: string, value: string, opts?: ConfigSetOpts & ExecOpts): Promise<void>;

  /**
   * Unset a raw config value (for arbitrary keys)
   *
   * Wraps: `git config --unset <key>`
   */
  unsetRaw(key: string, opts?: ExecOpts): Promise<void>;

  /**
   * List all config values
   *
   * Wraps: `git config --list`
   */
  list(opts?: ConfigListOpts & ExecOpts): Promise<ConfigEntry[]>;

  /**
   * Rename a config section
   *
   * Wraps: `git config --rename-section <old> <new>`
   */
  renameSection(oldName: string, newName: string, opts?: ExecOpts): Promise<void>;

  /**
   * Remove a config section
   *
   * Wraps: `git config --remove-section <name>`
   */
  removeSection(name: string, opts?: ExecOpts): Promise<void>;
}

/**
 * Submodule operations
 *
 * Wraps: `git submodule` subcommands
 */
export interface SubmoduleOperations {
  /**
   * List submodules
   *
   * Wraps: `git submodule status`
   */
  list(opts?: ExecOpts): Promise<SubmoduleInfo[]>;

  /**
   * Initialize submodules
   *
   * Wraps: `git submodule init`
   */
  init(paths?: string[], opts?: ExecOpts): Promise<void>;

  /**
   * Update submodules
   *
   * Wraps: `git submodule update`
   */
  update(opts?: SubmoduleOpts & ExecOpts): Promise<void>;

  /**
   * Add a submodule
   *
   * Wraps: `git submodule add <url> <path>`
   */
  add(url: string, path: string, opts?: SubmoduleAddOpts & ExecOpts): Promise<void>;

  /**
   * Deinitialize a submodule
   *
   * Wraps: `git submodule deinit <path>`
   */
  deinit(path: string, opts?: SubmoduleDeinitOpts & ExecOpts): Promise<void>;

  /**
   * Get submodule status
   *
   * Wraps: `git submodule status`
   */
  status(paths?: string[], opts?: SubmoduleStatusOpts & ExecOpts): Promise<string>;

  /**
   * Get submodule summary
   *
   * Wraps: `git submodule summary`
   */
  summary(opts?: SubmoduleSummaryOpts & ExecOpts): Promise<string>;

  /**
   * Run a command in each submodule
   *
   * Wraps: `git submodule foreach <command>`
   */
  foreach(command: string, opts?: SubmoduleForeachOpts & ExecOpts): Promise<string>;

  /**
   * Sync submodule URL configuration
   *
   * Wraps: `git submodule sync`
   */
  sync(paths?: string[], opts?: SubmoduleSyncOpts & ExecOpts): Promise<void>;

  /**
   * Absorb git directories of submodules into the superproject
   *
   * Wraps: `git submodule absorbgitdirs`
   */
  absorbGitDirs(opts?: ExecOpts): Promise<void>;

  /**
   * Set the branch for a submodule
   *
   * Wraps: `git submodule set-branch --branch <branch> -- <path>`
   */
  setBranch(path: string, branch: string, opts?: SubmoduleSetBranchOpts & ExecOpts): Promise<void>;

  /**
   * Set the URL for a submodule
   *
   * Wraps: `git submodule set-url -- <path> <url>`
   */
  setUrl(path: string, url: string, opts?: ExecOpts): Promise<void>;
}

/**
 * Repository with working directory
 *
 * Provides type-safe wrappers for Git commands that operate on repositories
 * with a working tree. Each method corresponds to a specific Git CLI command
 * or subcommand.
 */
export interface WorktreeRepo extends RepoBase {
  /** Path to the working directory */
  readonly workdir: string;

  // ==========================================================================
  // MVP Operations
  // ==========================================================================

  /**
   * Get repository status
   *
   * Wraps: `git status`
   *
   * @example
   * ```typescript
   * const status = await repo.status();
   * console.log(status.entries); // Changed files
   * console.log(status.branch);  // Current branch
   * ```
   */
  status(opts?: StatusOpts & ExecOpts): Promise<StatusPorcelain>;

  /**
   * Get commit log
   *
   * Wraps: `git log`
   *
   * @example
   * ```typescript
   * const commits = await repo.log({ maxCount: 10 });
   * ```
   */
  log(opts?: LogOpts & ExecOpts): Promise<Commit[]>;

  /**
   * Fetch from remote
   *
   * Wraps: `git fetch`
   *
   * @example
   * ```typescript
   * await repo.fetch({ remote: 'origin', prune: true });
   * ```
   */
  fetch(opts?: FetchOpts & ExecOpts): Promise<void>;

  /**
   * Push to remote
   *
   * Wraps: `git push`
   *
   * @example
   * ```typescript
   * await repo.push({ remote: 'origin', refspec: 'main' });
   * ```
   */
  push(opts?: PushOpts & ExecOpts): Promise<void>;

  /**
   * Git LFS operations
   *
   * Wraps: `git lfs *` commands
   */
  lfs: LfsOperations;

  /**
   * Git LFS extra operations (inspired by fs-extra)
   *
   * Additional utilities for advanced LFS patterns like 2-phase commit/fetch.
   */
  lfsExtra: LfsExtraOperations;

  /**
   * Git worktree operations
   *
   * Wraps: `git worktree *` commands
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
   *
   * Wraps: `git add`
   *
   * @example
   * ```typescript
   * await repo.add(['file1.txt', 'file2.txt']);
   * await repo.add('.', { all: true });
   * ```
   */
  add(paths: string | string[], opts?: AddOpts & ExecOpts): Promise<void>;

  /**
   * Git branch operations
   *
   * Wraps: `git branch *` commands
   */
  branch: BranchOperations;

  /**
   * Checkout a branch, tag, or commit (branch switching mode)
   *
   * Wraps: `git checkout <branch>`
   *
   * @example
   * ```typescript
   * await repo.checkout('main');
   * await repo.checkout('feature', { createBranch: true });
   * await repo.checkout('feature', { createBranch: true, startPoint: 'origin/main' });
   * ```
   */
  checkout(target: string, opts?: CheckoutBranchOpts & ExecOpts): Promise<void>;

  /**
   * Checkout specific files from a tree-ish (pathspec mode)
   *
   * Wraps: `git checkout [<tree-ish>] -- <pathspec>...`
   *
   * @example
   * ```typescript
   * // Restore file from index (discard working tree changes)
   * await repo.checkout(['file.txt']);
   *
   * // Restore file from HEAD
   * await repo.checkout(['file.txt'], { source: 'HEAD' });
   *
   * // Restore file from specific commit
   * await repo.checkout(['src/'], { source: 'abc123' });
   *
   * // Resolve conflict with ours/theirs
   * await repo.checkout(['conflicted.txt'], { ours: true });
   * ```
   */
  checkout(paths: string[], opts?: CheckoutPathOpts & ExecOpts): Promise<void>;

  /**
   * Create a commit
   *
   * Wraps: `git commit`
   *
   * @example
   * ```typescript
   * const result = await repo.commit({ message: 'feat: add new feature' });
   * console.log(result.hash);
   * ```
   */
  commit(opts?: CommitOpts & ExecOpts): Promise<CommitResult>;

  /**
   * Show changes between commits, commit and working tree, etc.
   *
   * Wraps: `git diff`
   *
   * @example
   * ```typescript
   * const diff = await repo.diff('HEAD~1');
   * const staged = await repo.diff({ staged: true });
   * ```
   */
  diff(target?: string, opts?: DiffOpts & ExecOpts): Promise<DiffResult>;

  /**
   * Merge branches
   *
   * Wraps: `git merge`
   *
   * @example
   * ```typescript
   * const result = await repo.merge('feature-branch');
   * ```
   */
  merge(branch: string, opts?: MergeOpts & ExecOpts): Promise<MergeResult>;

  /**
   * Pull from remote (fetch + merge/rebase)
   *
   * Wraps: `git pull`
   *
   * @example
   * ```typescript
   * await repo.pull({ remote: 'origin', rebase: true });
   * ```
   */
  pull(opts?: PullOpts & ExecOpts): Promise<void>;

  /**
   * Reset current HEAD to the specified state
   *
   * Wraps: `git reset`
   *
   * @example
   * ```typescript
   * await repo.reset('HEAD~1', { hard: true });
   * await repo.reset({ soft: true });
   * ```
   */
  reset(target?: string, opts?: ResetOpts & ExecOpts): Promise<void>;

  /**
   * Remove files from the working tree and from the index
   *
   * Wraps: `git rm`
   *
   * @example
   * ```typescript
   * await repo.rm('file.txt');
   * await repo.rm('dir/', { recursive: true });
   * ```
   */
  rm(paths: string | string[], opts?: RmOpts & ExecOpts): Promise<void>;

  /**
   * Git stash operations
   *
   * Wraps: `git stash *` commands
   */
  stash: StashOperations;

  /**
   * Switch branches
   *
   * Wraps: `git switch`
   *
   * @example
   * ```typescript
   * await repo.switch('main');
   * await repo.switch('new-branch', { create: true });
   * ```
   */
  switch(branch: string, opts?: SwitchOpts & ExecOpts): Promise<void>;

  /**
   * Git tag operations
   *
   * Wraps: `git tag *` commands
   */
  tag: TagOperations;

  // ==========================================================================
  // Medium Priority Operations
  // ==========================================================================

  /**
   * Apply changes from existing commits
   *
   * Wraps: `git cherry-pick`
   *
   * @example
   * ```typescript
   * await repo.cherryPick('abc123');
   * await repo.cherryPick(['abc123', 'def456']);
   * ```
   */
  cherryPick(commits: string | string[], opts?: CherryPickOpts & ExecOpts): Promise<void>;

  /**
   * Remove untracked files from the working tree
   *
   * Wraps: `git clean`
   *
   * @example
   * ```typescript
   * const removed = await repo.clean({ force: true, directories: true });
   * ```
   */
  clean(opts?: CleanOpts & ExecOpts): Promise<string[]>;

  /**
   * Move or rename files
   *
   * Wraps: `git mv`
   *
   * @example
   * ```typescript
   * await repo.mv('old-name.txt', 'new-name.txt');
   * ```
   */
  mv(source: string, destination: string, opts?: MvOpts & ExecOpts): Promise<void>;

  /**
   * Reapply commits on top of another base
   *
   * Wraps: `git rebase`
   *
   * @example
   * ```typescript
   * await repo.rebase({ onto: 'main' });
   * await repo.rebase({ abort: true });
   * ```
   */
  rebase(opts?: RebaseOpts & ExecOpts): Promise<void>;

  /**
   * Restore working tree files
   *
   * Wraps: `git restore`
   *
   * @example
   * ```typescript
   * await repo.restore(['file.txt'], { staged: true });
   * await repo.restore(['.'], { source: 'HEAD' });
   * ```
   */
  restore(paths: string | string[], opts?: RestoreOpts & ExecOpts): Promise<void>;

  /**
   * Revert existing commits
   *
   * Wraps: `git revert`
   *
   * @example
   * ```typescript
   * await repo.revert('abc123');
   * await repo.revert(['abc123', 'def456'], { noCommit: true });
   * ```
   */
  revert(commits: string | string[], opts?: RevertOpts & ExecOpts): Promise<void>;

  /**
   * Show various types of objects
   *
   * Wraps: `git show`
   *
   * @example
   * ```typescript
   * const content = await repo.show('HEAD:README.md');
   * const commitInfo = await repo.show('abc123');
   * ```
   */
  show(object: string, opts?: ShowOpts & ExecOpts): Promise<string>;

  // ==========================================================================
  // Plumbing Operations
  // ==========================================================================

  /**
   * Parse revision specification and return information about the repository
   *
   * Wraps: `git rev-parse`
   *
   * This is a versatile command with multiple use cases based on the options provided:
   *
   * **Resolve ref to SHA:**
   * ```typescript
   * const sha = await repo.revParse('HEAD');
   * const parentSha = await repo.revParse('HEAD~1');
   * const short = await repo.revParse('HEAD', { short: true });
   * const branch = await repo.revParse('HEAD', { abbrevRef: true });
   * ```
   *
   * **Query paths:**
   * ```typescript
   * const gitDir = await repo.revParse({ gitDir: true });
   * const toplevel = await repo.revParse({ showToplevel: true });
   * ```
   *
   * **Query repository state:**
   * ```typescript
   * const isShallow = await repo.revParse({ isShallowRepository: true });
   * const isBare = await repo.revParse({ isBareRepository: true });
   * ```
   *
   * **List refs:**
   * ```typescript
   * const allRefs = await repo.revParse({ all: true });
   * const branches = await repo.revParse({ branches: true });
   * const featureBranches = await repo.revParse({ branches: 'feature/*' });
   * ```
   */
  revParse(ref: string, opts?: RevParseRefOpts & ExecOpts): Promise<string>;
  revParse(opts: RevParsePathQuery & RevParsePathOpts & ExecOpts): Promise<string>;
  revParse(opts: RevParseBooleanQuery & ExecOpts): Promise<boolean>;
  revParse(opts: RevParseListQuery & ExecOpts): Promise<string[]>;
  revParse(
    opts: { showObjectFormat: true | 'storage' | 'input' | 'output' } & ExecOpts,
  ): Promise<string>;
  revParse(opts: { showRefFormat: true } & ExecOpts): Promise<string>;
  revParse(opts: { localEnvVars: true } & ExecOpts): Promise<string[]>;

  /**
   * Count the number of commits reachable from a ref
   *
   * Wraps: `git rev-list --count`
   *
   * @example
   * ```typescript
   * const count = await repo.revListCount('HEAD');
   * const featureCommits = await repo.revListCount('main..feature');
   * ```
   */
  revListCount(ref?: string, opts?: ExecOpts): Promise<number>;

  /**
   * Read or modify symbolic refs
   *
   * Wraps: `git symbolic-ref`
   *
   * Without newRef: reads the symbolic ref (e.g., get what HEAD points to)
   * With newRef: sets the symbolic ref to point to newRef
   *
   * @example
   * ```typescript
   * // Read what HEAD points to
   * const branch = await repo.symbolicRef('HEAD');
   *
   * // Set HEAD to point to a branch
   * await repo.symbolicRef('HEAD', 'refs/heads/main');
   * ```
   */
  symbolicRef(name: string, newRef?: string, opts?: ExecOpts): Promise<string | undefined>;

  /**
   * Git submodule operations
   *
   * Wraps: `git submodule *` commands
   */
  submodule: SubmoduleOperations;

  /**
   * Git remote operations
   *
   * Wraps: `git remote *` commands
   */
  remote: RemoteOperations;

  /**
   * Git config operations (repository-level)
   *
   * Wraps: `git config` (without --global)
   */
  config: ConfigOperations;
}

/**
 * Bare repository (no working directory)
 *
 * A bare repository contains only the Git data without a working tree.
 * Typically used for shared/server repositories.
 */
export interface BareRepo extends RepoBase {
  /** Path to the git directory */
  readonly gitDir: string;

  /**
   * Fetch from remote
   *
   * Wraps: `git fetch`
   */
  fetch(opts?: FetchOpts & ExecOpts): Promise<void>;

  /**
   * Push to remote
   *
   * Wraps: `git push`
   */
  push(opts?: PushOpts & ExecOpts): Promise<void>;

  /**
   * Remote operations
   *
   * Wraps: `git remote` subcommands
   */
  remote: RemoteOperations;

  /**
   * Config operations (repository-level)
   *
   * Wraps: `git config` subcommands
   */
  config: ConfigOperations;

  /**
   * Parse revision specification and return information about the repository
   *
   * Wraps: `git rev-parse`
   *
   * @example
   * ```typescript
   * const sha = await repo.revParse('HEAD');
   * const gitDir = await repo.revParse({ gitDir: true });
   * const isShallow = await repo.revParse({ isShallowRepository: true });
   * ```
   */
  revParse(ref: string, opts?: RevParseRefOpts & ExecOpts): Promise<string>;
  revParse(opts: RevParsePathQuery & RevParsePathOpts & ExecOpts): Promise<string>;
  revParse(opts: RevParseBooleanQuery & ExecOpts): Promise<boolean>;
  revParse(opts: RevParseListQuery & ExecOpts): Promise<string[]>;
  revParse(
    opts: { showObjectFormat: true | 'storage' | 'input' | 'output' } & ExecOpts,
  ): Promise<string>;
  revParse(opts: { showRefFormat: true } & ExecOpts): Promise<string>;
  revParse(opts: { localEnvVars: true } & ExecOpts): Promise<string[]>;
}

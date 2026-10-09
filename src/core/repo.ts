import type { GitCommandClient } from '../commands/types.js';
import type { CheckedOptions, ExclusiveQuery } from './option-rules.js';
/**
 * Repository interfaces - operations that require a repository context
 */

import type { LsRemoteRef } from '../parsers/index.js';
import type { ExecOpts, GitProgress, LfsMode, RawResult } from './types.js';

/**
 * Base repository interface
 */
export interface RepoBase extends GitCommandClient {
  readonly kind: 'worktree' | 'bare';
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
  lsTree(
    treeish: string,
    opts: LsTreeOpts & ({ nameOnly: true } | { objectOnly: true }) & ExecOpts,
  ): Promise<string[]>;
  lsTree(
    treeish: string,
    opts?: LsTreeOpts & { nameOnly?: false; objectOnly?: false } & ExecOpts,
  ): Promise<LsTreeEntry[]>;
  lsTree(treeish: string, opts?: LsTreeOpts & ExecOpts): Promise<LsTreeEntry[] | string[]>;
}

/**
 * Options for repository-scoped git ls-remote
 */
export type RepoLsRemoteOpts = CheckedOptions<
  {
    /** Limit to refs/heads (branches) */
    heads?: boolean;
    /** Limit to refs/tags */
    tags?: boolean;
    /** Show only actual refs (not peeled tags) */
    refsOnly?: boolean;
    /** @deprecated Use raw() for this operation or output format. */
    getUrl?: boolean;
    /** Sort refs by the given key (e.g., 'version:refname') */
    sort?: string;
    /** @deprecated Use raw() for this operation or output format. */
    symref?: boolean;
    /** Specific refs to query (branch names, tag names, or full ref paths) */
    refs?: string[];
  },
  'lsRemote'
>;

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
export type LsTreeOpts = CheckedOptions<
  {
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
  },
  'lsTree'
>;

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
  /** Number of stashed entries, when requested (Git 2.35+). */
  stash?: number;
};

/**
 * Options for git status
 */
export type StatusOpts = CheckedOptions<
  {
    // Existing options
    /** Porcelain output format version (1 or 2) */
    porcelain?: 1 | 2;
    /** How to show untracked files */
    untracked?: 'no' | 'normal' | 'all';

    // New options
    /** @deprecated Use raw() for this operation or output format. */
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
  },
  'status'
>;

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
export type LogOpts = CheckedOptions<
  {
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
    /** @deprecated Use raw() for this operation or output format. */
    source?: boolean;
    /** Use mailmap file to map author names */
    useMailmap?: boolean;
    /** @deprecated Use raw() for this operation or output format. */
    decorateRefs?: string;
    /** @deprecated Use raw() for this operation or output format. */
    decorateRefsExclude?: string;
    /** @deprecated Use raw() for this operation or output format. */
    decorate?: 'short' | 'full' | 'auto' | 'no';
    /** @deprecated Use raw() for this operation or output format. */
    stat?: boolean;
    /** @deprecated Use raw() for this operation or output format. */
    shortstat?: boolean;
    /** @deprecated Use raw() for this operation or output format. */
    nameOnly?: boolean;
    /** @deprecated Use raw() for this operation or output format. */
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
  },
  'log'
>;

/**
 * Options for git fetch
 */
export type FetchOpts = CheckedOptions<
  {
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
    /** @deprecated Use raw() for this operation or output format. */
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
  },
  'fetch'
>;

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
export type PushOpts = CheckedOptions<
  {
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
  },
  'push'
>;

// =============================================================================
// High-level API Types
// =============================================================================

/**
 * Options for git add
 */
export type AddOpts = CheckedOptions<
  {
    // Existing options
    /** Add all files (including untracked) */
    all?: boolean;
    /** Dry run - show what would be added */
    dryRun?: boolean;
    /** Add modified and deleted files, but not untracked */
    update?: boolean;
    /** Force add of ignored files */
    force?: boolean;
    /** @deprecated Use raw() for this operation or output format. */
    interactive?: boolean;
    /** @deprecated Use raw() for this operation or output format. */
    patch?: boolean;

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
  },
  'add'
>;

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
export type CheckoutBranchOpts = CheckedOptions<
  {
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
  },
  'checkoutBranch'
>;

/**
 * Options for git checkout (pathspec mode)
 *
 * Used for: `git checkout [<tree-ish>] -- <pathspec>...`
 */
export type CheckoutPathOpts = CheckedOptions<
  {
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
  },
  'checkoutPath'
>;

/**
 * Options for git checkout (legacy combined type)
 * @deprecated Use CheckoutBranchOpts or CheckoutPathOpts for type safety
 */
export type CheckoutOpts = CheckoutBranchOpts & CheckoutPathOpts;

/**
 * Options for git commit
 */
export type CommitOpts = CheckedOptions<
  {
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
    /** @deprecated Use raw() for this operation or output format. */
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
    /** @deprecated Use raw() for this operation or output format. */
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
  },
  'commit'
>;

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
export type DiffOpts = CheckedOptions<
  {
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
    mergeBase?: boolean;
    /** @deprecated Use raw() for this operation or output format. */
    noIndex?: boolean;
    /** Show word diff */
    wordDiff?: 'color' | 'plain' | 'porcelain' | 'none';
  },
  'diff'
>;

/**
 * Diff file entry
 */
export type DiffEntry = {
  path: string;
  status: 'A' | 'D' | 'M' | 'R' | 'C' | 'T' | 'U' | 'X' | 'B';
  /** Rename/copy similarity percentage. */
  similarity?: number;
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
export type MergeOpts = CheckedOptions<
  {
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
  },
  'merge'
>;

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
export type PullOpts = CheckedOptions<
  {
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
  },
  'pull'
>;

/**
 * Options for git reset
 */
export type ResetOpts = CheckedOptions<
  {
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
  },
  'reset'
>;

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
export type StashPushOpts = CheckedOptions<
  {
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
  },
  'stashPush'
>;

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
export type SwitchOpts = CheckedOptions<
  {
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
  },
  'switch'
>;

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
export type TagCreateOpts = CheckedOptions<
  {
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
  },
  'tagCreate'
>;

// =============================================================================
// Medium Priority Commands
// =============================================================================

/**
 * Options for git cherry-pick
 */
export type CherryPickOpts = CheckedOptions<
  {
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
    /** @deprecated Use raw() for this operation or output format. */
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
  },
  'cherryPick'
>;

/**
 * Options for git clean
 */
export type CleanOpts = CheckedOptions<
  {
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
  },
  'clean'
>;

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
export type RebaseOpts = CheckedOptions<
  {
    // Existing options
    /** Upstream branch */
    upstream?: string;
    /** Onto target */
    onto?: string;
    /** @deprecated Use raw() for this operation or output format. */
    interactive?: boolean;
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
  },
  'rebase'
>;

/**
 * Options for git restore
 */
export type RestoreOpts = CheckedOptions<
  {
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
  },
  'restore'
>;

/**
 * Options for git revert
 */
export type RevertOpts = CheckedOptions<
  {
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
    /** @deprecated Use raw() for this operation or output format. */
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
  },
  'revert'
>;

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
export type RevParsePathQuery = ExclusiveQuery<
  | { gitDir: true }
  | { absoluteGitDir: true }
  | { gitCommonDir: true }
  | { showToplevel: true }
  | { showCdup: true }
  | { showPrefix: true }
  | { showSuperprojectWorkingTree: true }
  | { sharedIndexPath: true }
  | { gitPath: string }
  | { resolveGitDir: string }
>;

/**
 * Options that return a boolean from rev-parse
 *
 * These options are mutually exclusive - only one can be specified at a time.
 */
export type RevParseBooleanQuery = ExclusiveQuery<
  | { isInsideGitDir: true }
  | { isInsideWorkTree: true }
  | { isBareRepository: true }
  | { isShallowRepository: true }
>;

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
export type RevParseListQuery = ExclusiveQuery<
  | ({ all: true } & RevParseListOpts)
  | ({ branches: true | string } & RevParseListOpts)
  | ({ tags: true | string } & RevParseListOpts)
  | ({ remotes: true | string } & RevParseListOpts)
  | ({ glob: string } & RevParseListOpts)
  | { disambiguate: string }
>;

/**
 * Options that modify how a ref is resolved (shared by all ref-resolution modes)
 */
export type RevParseRefBaseOpts = {
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
};

/**
 * Options that modify how a ref is resolved
 *
 * Resolution failures throw a `GitError`. Use {@link RevParseQuietRefOpts} to get
 * `undefined` instead.
 */
export type RevParseRefOpts = RevParseRefBaseOpts & { quiet?: false };

/**
 * Options for resolving a ref that may not exist (`git rev-parse --verify --quiet`)
 *
 * When the ref cannot be resolved (e.g. the commit does not exist), `revParse` returns
 * `undefined` instead of throwing. Other failures (e.g. not a repository) still throw.
 * `quiet` requires `verify`, as Git only honors `--quiet` in `--verify` mode.
 */
export type RevParseQuietRefOpts = RevParseRefBaseOpts & {
  verify: true;
  /** Return `undefined` instead of throwing when the ref cannot be resolved */
  quiet: true;
};

/**
 * Ref resolution options accepted by every `revParse(ref)` overload, including a dynamic
 * `quiet` flag when `verify` is set
 */
export type RevParseAnyRefOpts =
  | RevParseRefOpts
  | (RevParseRefBaseOpts & { verify: true; quiet?: boolean });

/**
 * Options that return other information from rev-parse
 */
export type RevParseOtherQuery = ExclusiveQuery<
  | { showObjectFormat: true | 'storage' | 'input' | 'output' }
  | { showRefFormat: true }
  | { localEnvVars: true }
>;

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
export type SubmoduleOpts = CheckedOptions<
  {
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
  },
  'submoduleUpdate'
>;

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
    /** Present only when Git LFS supplies a size. */
    size?: number;
    /** Status code supplied by git lfs status (for example A or M). */
    status: string;
  }>;
};

/**
 * Options for LFS pull
 */
export type LfsPullOpts = CheckedOptions<
  {
    remote?: string;
    ref?: string;
    include?: string[];
    exclude?: string[];
  },
  'lfsPull'
>;

/**
 * Options for LFS push
 */
export type LfsPushOpts = CheckedOptions<
  {
    remote?: string;
    ref?: string;

    // New options
    /** Dry run - show what would be pushed without actually pushing */
    dryRun?: boolean;
    /** Push specified object IDs (OID hashes) instead of all objects. Empty arrays require stdin: true. */
    objectId?: string | string[];
    /** Send objectId values (or ref) as newline-delimited standard input. Requires objectId or ref. */
    stdin?: boolean;
  },
  'lfsPush'
>;

/**
 * Options for LFS status
 */
export type LfsStatusOpts = CheckedOptions<
  {
    json?: boolean;

    // New options
    /** @deprecated Use raw() for this operation or output format. */
    porcelain?: boolean;
  },
  'lfsStatus'
>;

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
export type LfsFetchOpts = CheckedOptions<
  {
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
  },
  'lfsFetch'
>;

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
export type LfsLsFilesOpts = CheckedOptions<
  {
    /** Show full OID (not abbreviated) */
    long?: boolean;
    /** Show file sizes */
    size?: boolean;
    /** @deprecated Use raw() for this operation or output format. */
    debug?: boolean;
    /** Show all LFS files (not just current ref) */
    all?: boolean;
    /** Show deleted files */
    deleted?: boolean;
    /** Include patterns */
    include?: string | string[];
    /** Exclude patterns */
    exclude?: string | string[];
    /** @deprecated Use raw() for this operation or output format. */
    nameOnly?: boolean;
    /** Output in JSON format */
    json?: boolean;
    /** Ref to list files for */
    ref?: string;
  },
  'lfsLsFiles'
>;

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
  /** Whether the lock belongs to us; provided when verifying locks. */
  ours?: boolean;
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
export type LfsLocksOpts = CheckedOptions<
  {
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
  },
  'lfsLocks'
>;

/**
 * Options for LFS checkout
 */
export type LfsCheckoutOpts = CheckedOptions<
  {
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
  },
  'lfsCheckout'
>;

/**
 * Options for LFS migrate info
 */
export type LfsMigrateInfoOpts = CheckedOptions<
  {
    /** Include patterns (combined as a comma-separated LFS filter). */
    include?: string | string[];
    exclude?: string | string[];
    includeRef?: string | string[];
    excludeRef?: string | string[];
    skipFetch?: boolean;
    everything?: boolean;
    yesReally?: boolean;
    /** Positional references to migrate. */
    refs?: string | string[];
    above?: string | number;
    top?: number;
    /** Git LFS storage unit (for example b, kb, mb, gb, tib). */
    unit?: string;
    pointers?: 'follow' | 'no-follow' | 'ignore';
    fixup?: boolean;
  },
  'lfsMigrateInfo'
>;

/** Options for git lfs migrate import. */
export type LfsMigrateImportOpts = CheckedOptions<
  {
    /** Include patterns (combined as a comma-separated LFS filter). */
    include?: string | string[];
    exclude?: string | string[];
    includeRef?: string | string[];
    excludeRef?: string | string[];
    skipFetch?: boolean;
    everything?: boolean;
    yesReally?: boolean;
    /** Positional references to migrate. */
    refs?: string | string[];
    above?: string | number;
    fixup?: boolean;
    verbose?: boolean;
    objectMap?: string;
    noRewrite?: boolean;
    message?: string;
    /** Files for --no-rewrite; these are positional paths, not object IDs. */
    files?: [string, ...string[]];
    /** @deprecated Git LFS migrate has no --object option. Use files with noRewrite. */
    object?: string | string[];
    /** @deprecated Supported only by migrate info. */
    top?: number;
    /** @deprecated Supported only by migrate info. */
    unit?: string;
    /** @deprecated Supported only by migrate info. */
    pointers?: string;
  },
  'lfsMigrateImport'
>;

/** Options for git lfs migrate export. */
export type LfsMigrateExportOpts = CheckedOptions<
  {
    /** Include patterns (combined as a comma-separated LFS filter). */
    include?: string | string[];
    exclude?: string | string[];
    includeRef?: string | string[];
    excludeRef?: string | string[];
    skipFetch?: boolean;
    everything?: boolean;
    yesReally?: boolean;
    /** Positional references to migrate. */
    refs?: string | string[];
    verbose?: boolean;
    objectMap?: string;
    remote?: string;
    /** @deprecated Supported only by migrate info/import. */
    above?: string | number;
    /** @deprecated Supported only by migrate info. */
    top?: number;
    /** @deprecated Supported only by migrate info. */
    unit?: string;
    /** @deprecated Supported only by migrate info. */
    pointers?: string;
    /** @deprecated Supported only by migrate info/import. */
    fixup?: boolean;
  },
  'lfsMigrateExport'
>;

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
  /**
   * Number of OIDs per `git lfs push --object-id` invocation (default: 200).
   *
   * Each batch is one spawned process, so the batch size is bounded by the
   * OS command-line length limit. Git is spawned without a shell, so the
   * binding limit is the Windows CreateProcess limit (32,767 characters);
   * the default stays around 40% of it.
   */
  batchSize?: number;
  /**
   * Maximum number of batches uploaded concurrently (default: 4).
   *
   * Each `git lfs push` invocation pays a fixed cost (process spawn,
   * credential lookup, LFS batch API round-trip) before any bytes are
   * transferred; concurrent batches overlap that cost with other batches'
   * transfers. The first batch always runs alone and the remaining batches
   * start only after it succeeds, so a failure common to all batches (e.g.
   * an unreachable remote) costs a single round-trip. Once a batch fails, no
   * new batch is started; in-flight batches are awaited and the remaining
   * objects are reported in `skippedCount`. Set to 1 for strictly serial
   * uploads.
   *
   * Note: each `git lfs push` process transfers multiple objects in parallel
   * on its own (`lfs.concurrenttransfers`, default 8), so the peak transfer
   * parallelism is `concurrency` times that value. With `concurrency` > 1,
   * progress callbacks from different batches may interleave.
   */
  concurrency?: number;
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
  /**
   * Number of objects not uploaded: the objects of the batch that failed or
   * was aborted, plus those of the batches never started after that failure.
   * `uploadedCount + skippedCount` always equals the number of objects.
   */
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
export type WorktreeAddOpts = CheckedOptions<
  {
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
  },
  'worktreeAdd'
>;

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
  checkout(
    patterns: string | [string],
    opts: LfsCheckoutOpts & { to: string } & ExecOpts,
  ): Promise<void>;
  checkout(
    patterns?: string | string[],
    opts?: LfsCheckoutOpts & { to?: '' } & ExecOpts,
  ): Promise<void>;

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
  migrateExport(opts: LfsMigrateExportOpts & ExecOpts): Promise<void>;

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
export type RemoteAddOpts = CheckedOptions<
  {
    /** Set up tracking for default branch */
    track?: string;
    /** Only fetch specified branches */
    fetch?: boolean;
    /** Set up as mirror */
    mirror?: 'fetch' | 'push';

    // New options
    /** Import tags from remote (true) or not (false) */
    tags?: boolean;
  },
  'remoteAdd'
>;

/**
 * Options for remote set-head
 */
export type RemoteSetHeadOpts = CheckedOptions<
  {
    /** Automatically determine remote HEAD */
    auto?: boolean;
    /** Delete the symbolic-ref for remote HEAD */
    delete?: boolean;
  },
  'remoteSetHead'
>;

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
  /** Source and scope, when requested. */
  origin?: string;
  scope?: string;
  /** Config key (e.g., 'user.name') */
  key: string;
  /** Config value */
  value: string;
};

/**
 * Options for config get
 */
export type ConfigGetOpts = CheckedOptions<
  {
    /** Get all values for multi-valued key */
    all?: boolean;

    // New options
    /** Type to interpret the value as */
    type?: 'bool' | 'int' | 'bool-or-int' | 'path' | 'expiry-date' | 'color';
    /** Default value to use if the key is not set */
    default?: string;
  },
  'configGet'
>;

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
export type ConfigListOpts = CheckedOptions<
  {
    /** Show origin of each value */
    showOrigin?: boolean;
    /** Show scope of each value */
    showScope?: boolean;

    // New options
    /** Respect include directives */
    includes?: boolean;
    /** @deprecated Use raw() for this operation or output format. */
    nameOnly?: boolean;
  },
  'configList'
>;

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
  getRaw(key: string, opts: ConfigGetOpts & { all: true } & ExecOpts): Promise<string[]>;
  getRaw(
    key: string,
    opts?: ConfigGetOpts & { all?: false } & ExecOpts,
  ): Promise<string | undefined>;
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
  readonly kind: 'worktree';
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
  add(paths: [], opts: AddOpts & { pathspecFromFile: string } & ExecOpts): Promise<void>;
  add(
    paths: string | string[],
    opts?: AddOpts & { pathspecFromFile?: never } & ExecOpts,
  ): Promise<void>;

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
  checkout(
    paths: [],
    opts: CheckoutPathOpts & { pathspecFromFile: string } & ExecOpts,
  ): Promise<void>;
  checkout(
    paths: string[],
    opts?: CheckoutPathOpts & { pathspecFromFile?: never } & ExecOpts,
  ): Promise<void>;

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
  diff(
    target: string | undefined,
    opts: DiffOpts & { nameOnly: true } & ExecOpts,
  ): Promise<string[]>;
  diff(target?: string, opts?: DiffOpts & { nameOnly?: false } & ExecOpts): Promise<DiffResult>;
  diff(target?: string, opts?: DiffOpts & ExecOpts): Promise<DiffResult | string[]>;

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
  rm(paths: [], opts: RmOpts & { pathspecFromFile: string } & ExecOpts): Promise<void>;
  rm(
    paths: string | string[],
    opts?: RmOpts & { pathspecFromFile?: never } & ExecOpts,
  ): Promise<void>;

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
  restore(paths: [], opts: RestoreOpts & { pathspecFromFile: string } & ExecOpts): Promise<void>;
  restore(
    paths: string | string[],
    opts?: RestoreOpts & { pathspecFromFile?: never } & ExecOpts,
  ): Promise<void>;

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
   *
   * // Returns undefined instead of throwing when the commit does not exist.
   * // Peel with ^{commit}: a full 40-hex SHA is otherwise echoed back without
   * // checking that the object exists.
   * const commit = await repo.revParse(`${sha}^{commit}`, { verify: true, quiet: true });
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
  revParse(ref: string, opts: RevParseQuietRefOpts & ExecOpts): Promise<string | undefined>;
  revParse(ref: string, opts?: RevParseRefOpts & ExecOpts): Promise<string>;
  revParse(ref: string, opts?: RevParseAnyRefOpts & ExecOpts): Promise<string | undefined>;
  revParse(opts: RevParsePathQuery & RevParsePathOpts & ExecOpts): Promise<string>;
  revParse(opts: RevParseBooleanQuery & ExecOpts): Promise<boolean>;
  revParse(opts: RevParseListQuery & ExecOpts): Promise<string[]>;
  revParse(
    opts: ExclusiveQuery<{ showObjectFormat: true | 'storage' | 'input' | 'output' }> & ExecOpts,
  ): Promise<string>;
  revParse(opts: ExclusiveQuery<{ showRefFormat: true }> & ExecOpts): Promise<string>;
  revParse(opts: ExclusiveQuery<{ localEnvVars: true }> & ExecOpts): Promise<string[]>;

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
  readonly kind: 'bare';
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
  revParse(ref: string, opts: RevParseQuietRefOpts & ExecOpts): Promise<string | undefined>;
  revParse(ref: string, opts?: RevParseRefOpts & ExecOpts): Promise<string>;
  revParse(ref: string, opts?: RevParseAnyRefOpts & ExecOpts): Promise<string | undefined>;
  revParse(opts: RevParsePathQuery & RevParsePathOpts & ExecOpts): Promise<string>;
  revParse(opts: RevParseBooleanQuery & ExecOpts): Promise<boolean>;
  revParse(opts: RevParseListQuery & ExecOpts): Promise<string[]>;
  revParse(
    opts: ExclusiveQuery<{ showObjectFormat: true | 'storage' | 'input' | 'output' }> & ExecOpts,
  ): Promise<string>;
  revParse(opts: ExclusiveQuery<{ showRefFormat: true }> & ExecOpts): Promise<string>;
  revParse(opts: ExclusiveQuery<{ localEnvVars: true }> & ExecOpts): Promise<string[]>;
}

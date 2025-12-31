/**
 * nodegit Backend Implementation
 *
 * Native libgit2 bindings for Node.js.
 * Provides high performance Git operations.
 * Does NOT support LFS operations.
 */

import type {
  BackendAddOpts,
  BackendBranchCreateOpts,
  BackendCapabilities,
  BackendExecOpts,
  GitBackend,
  NodeGitBackendOptions,
} from '../../core/backend.js';
import type { CloneOpts, InitOpts } from '../../core/git.js';
import type {
  BranchInfo,
  BranchOpts,
  CheckoutBranchOpts,
  CheckoutPathOpts,
  Commit,
  CommitOpts,
  CommitResult,
  DiffOpts,
  DiffResult,
  FetchOpts,
  LogOpts,
  MergeOpts,
  MergeResult,
  PullOpts,
  PushOpts,
  ResetOpts,
  StashApplyOpts,
  StashEntry,
  StashPushOpts,
  StatusOpts,
  StatusPorcelain,
  TagCreateOpts,
  TagListOpts,
} from '../../core/repo.js';
import { GitError } from '../../core/types.js';
import {
  convertBranches,
  convertCommit,
  convertStatus,
  type NodeGitCommit,
  type NodeGitReference,
  type NodeGitRepository,
  type NodeGitStatusFile,
} from './converters.js';

/**
 * nodegit module interface
 */
interface NodeGitModule {
  Repository: {
    open(path: string): Promise<NodeGitRepositoryImpl>;
    init(path: string, isBare: number): Promise<NodeGitRepositoryImpl>;
  };
  Clone: {
    clone(url: string, path: string, options?: unknown): Promise<NodeGitRepositoryImpl>;
  };
  Branch: {
    create(
      repo: NodeGitRepositoryImpl,
      name: string,
      commit: NodeGitCommit,
      force: boolean,
    ): Promise<NodeGitReference>;
  };
  Signature: {
    now(name: string, email: string): unknown;
    default(repo: NodeGitRepositoryImpl): Promise<unknown>;
  };
  Index: unknown;
  Cred: {
    userpassPlaintextNew(username: string, password: string): unknown;
    sshKeyFromAgent(username: string): unknown;
  };
  // Extended operations - optional since they may not exist in older nodegit versions
  Remote?: {
    lookup(repo: NodeGitRepositoryImpl, name: string): Promise<NodeGitRemote>;
  };
  Checkout?: {
    head(repo: NodeGitRepositoryImpl, options?: unknown): Promise<void>;
    tree(repo: NodeGitRepositoryImpl, treeish: unknown, options?: unknown): Promise<void>;
  };
  Merge?: {
    merge(
      repo: NodeGitRepositoryImpl,
      theirHead: unknown,
      mergeOpts: unknown,
      checkoutOpts: unknown,
    ): Promise<void>;
    commits(repo: NodeGitRepositoryImpl, ourCommit: unknown, theirCommit: unknown): Promise<void>;
  };
  Reset?: {
    reset(repo: NodeGitRepositoryImpl, commit: NodeGitCommit, resetType: number): Promise<void>;
    SOFT: 1;
    MIXED: 2;
    HARD: 3;
  };
  Stash?: {
    save(
      repo: NodeGitRepositoryImpl,
      stasher: unknown,
      message: string,
      flags: number,
    ): Promise<unknown>;
    pop(repo: NodeGitRepositoryImpl, index: number, options?: unknown): Promise<void>;
    foreach(repo: NodeGitRepositoryImpl, callback: StashForeachCallback): Promise<void>;
    APPLY_DEFAULT: 0;
    INCLUDE_UNTRACKED: 1;
    KEEP_INDEX: 2;
  };
  Tag?: {
    list(repo: NodeGitRepositoryImpl): Promise<string[]>;
    create(
      repo: NodeGitRepositoryImpl,
      name: string,
      target: unknown,
      tagger: unknown,
      message: string,
      force: number,
    ): Promise<unknown>;
    createLightweight(
      repo: NodeGitRepositoryImpl,
      name: string,
      target: unknown,
      force: number,
    ): Promise<unknown>;
  };
}

/**
 * Stash foreach callback type
 */
type StashForeachCallback = (index: number, message: string, stashOid: unknown) => number;

/**
 * nodegit Remote interface
 */
interface NodeGitRemote {
  fetch(
    refSpecs: string[],
    options: unknown,
    message: string,
  ): Promise<void>;
  push(refSpecs: string[], options: unknown): Promise<number>;
}

/**
 * nodegit Repository implementation interface
 */
interface NodeGitRepositoryImpl extends NodeGitRepository {
  isBare(): boolean;
  getStatus(): Promise<NodeGitStatusFile[]>;
  getHeadCommit(): Promise<NodeGitCommit>;
  refreshIndex(): Promise<NodeGitIndex>;
  index(): Promise<NodeGitIndex>;
  createCommitOnHead(
    files: string[],
    author: unknown,
    committer: unknown,
    message: string,
  ): Promise<string>;
  createBranch(name: string, commit: NodeGitCommit, force: boolean): Promise<NodeGitReference>;
  getRemote(name: string): Promise<NodeGitRemote>;
  setHead(refname: string): Promise<void>;
  checkoutBranch(branch: string, options?: unknown): Promise<NodeGitReference>;
  getBranchCommit(name: string): Promise<NodeGitCommit>;
  getTagByName(name: string): Promise<NodeGitTag>;
  mergeBranches(
    to: string,
    from: string,
    signature: unknown,
    preference: number,
    options?: unknown,
  ): Promise<unknown>;
}

/**
 * nodegit Index interface
 */
interface NodeGitIndex {
  addAll(patterns?: string[], flags?: number): Promise<void>;
  addByPath(path: string): Promise<void>;
  write(): Promise<void>;
  writeTree(): Promise<unknown>;
}

/**
 * nodegit Tag interface
 */
interface NodeGitTag {
  targetId(): { tostrS(): string };
}

/**
 * nodegit Backend
 */
export class NodeGitBackend implements GitBackend {
  private readonly certificateCheck: NodeGitBackendOptions['certificateCheck'];
  private readonly credentials: NodeGitBackendOptions['credentials'];
  private nodegit: NodeGitModule | null = null;

  public constructor(options?: NodeGitBackendOptions) {
    this.certificateCheck = options?.certificateCheck;
    this.credentials = options?.credentials;
  }

  /**
   * Lazy load nodegit module
   */
  private async getNodeGit(): Promise<NodeGitModule> {
    if (this.nodegit) {
      return this.nodegit;
    }

    try {
      const module = await import('nodegit');
      const nodegit = module.default ?? module;
      this.nodegit = nodegit;
      return nodegit;
    } catch (_error) {
      throw new GitError(
        'SpawnFailed',
        'Failed to load nodegit. Make sure it is installed: npm install nodegit',
        {},
        'unknown',
      );
    }
  }

  public getCapabilities(): BackendCapabilities {
    return {
      type: 'nodegit',
      supportsLfs: false,
      supportsProgress: true,
      supportsAbort: false, // nodegit doesn't support AbortSignal
      supportsBareRepo: true,
      supportsBrowser: false,
    };
  }

  // ===========================================================================
  // Repository Operations
  // ===========================================================================

  public async checkRepository(path: string): Promise<{ isBare: boolean } | null> {
    const nodegit = await this.getNodeGit();

    try {
      const repo = await nodegit.Repository.open(path);
      return { isBare: repo.isBare() };
    } catch {
      return null;
    }
  }

  public async init(path: string, opts?: InitOpts & BackendExecOpts): Promise<void> {
    const nodegit = await this.getNodeGit();

    try {
      await nodegit.Repository.init(path, opts?.bare ? 1 : 0);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async clone(url: string, path: string, opts?: CloneOpts & BackendExecOpts): Promise<void> {
    const nodegit = await this.getNodeGit();

    try {
      const cloneOptions: Record<string, unknown> = {};

      if (opts?.bare) {
        cloneOptions.bare = 1;
      }

      // Set up fetch options for authentication and progress
      const fetchOpts: Record<string, unknown> = {
        callbacks: {} as Record<string, unknown>,
      };

      // Certificate check
      if (this.certificateCheck) {
        (fetchOpts.callbacks as Record<string, unknown>).certificateCheck = this.certificateCheck;
      }

      // Credentials
      if (this.credentials) {
        (fetchOpts.callbacks as Record<string, unknown>).credentials = this.credentials;
      }

      // Progress tracking
      if (opts?.onProgress) {
        (fetchOpts.callbacks as Record<string, unknown>).transferProgress = (stats: {
          receivedObjects(): number;
          totalObjects(): number;
        }) => {
          const received = stats.receivedObjects();
          const total = stats.totalObjects();
          opts.onProgress?.({
            phase: 'Receiving objects',
            current: received,
            total,
            percent: total > 0 ? Math.round((received / total) * 100) : null,
          });
        };
      }

      cloneOptions.fetchOpts = fetchOpts;

      await nodegit.Clone.clone(url, path, cloneOptions);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  // ===========================================================================
  // Repository-Scoped Operations
  // ===========================================================================

  public async status(
    workdir: string,
    _opts?: StatusOpts & BackendExecOpts,
  ): Promise<StatusPorcelain> {
    const nodegit = await this.getNodeGit();

    try {
      const repo = await nodegit.Repository.open(workdir);
      const statusFiles = await repo.getStatus();
      const entries = convertStatus(statusFiles);

      // Get current branch
      let branch: string | undefined;
      try {
        const head = await repo.head();
        branch = head.shorthand();
      } catch {
        // Ignore errors getting branch
      }

      return {
        entries,
        branch,
        upstream: undefined,
        ahead: undefined,
        behind: undefined,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async log(workdir: string, opts?: LogOpts & BackendExecOpts): Promise<Commit[]> {
    const nodegit = await this.getNodeGit();

    try {
      const repo = await nodegit.Repository.open(workdir);
      const headCommit = await repo.getHeadCommit();

      // Walk the commit history
      const commits: Commit[] = [];
      const maxCount = opts?.maxCount ?? 100;

      // Use a simple walk approach
      let current: NodeGitCommit | null = headCommit;
      let count = 0;

      while (current && count < maxCount) {
        commits.push(convertCommit(current));
        count++;

        // Get first parent (linear history)
        const parents = current.parents();
        if (parents.length > 0) {
          try {
            // Get the parent commit
            const parentOid = parents[0];
            if (parentOid) {
              // Use repo to get the commit by OID
              current = await (
                repo as unknown as { getCommit(oid: { tostrS(): string }): Promise<NodeGitCommit> }
              ).getCommit(parentOid);
            } else {
              current = null;
            }
          } catch {
            current = null;
          }
        } else {
          current = null;
        }
      }

      return commits;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async commit(
    workdir: string,
    message: string,
    opts?: CommitOpts & BackendExecOpts,
  ): Promise<CommitResult> {
    const nodegit = await this.getNodeGit();

    try {
      const repo = await nodegit.Repository.open(workdir);

      // Get or create signature
      let signature: unknown;
      if (opts?.author) {
        const match = opts.author.match(/^(.+?)\s*<(.+?)>$/);
        if (match?.[1] && match[2]) {
          signature = nodegit.Signature.now(match[1].trim(), match[2].trim());
        }
      }

      if (!signature) {
        try {
          signature = await nodegit.Signature.default(repo);
        } catch {
          throw new GitError(
            'NonZeroExit',
            'No author/committer configured. Set user.name and user.email in git config.',
            {},
          );
        }
      }

      // Get index and write tree
      const index = await repo.refreshIndex();
      await index.write();
      const treeOid = await index.writeTree();

      // Get head commit for parent
      let parentCommits: NodeGitCommit[] = [];
      try {
        const headCommit = await repo.getHeadCommit();
        parentCommits = [headCommit];
      } catch {
        // No head commit (initial commit)
      }

      // Create commit
      const commitOid = await (
        repo as unknown as {
          createCommit(
            updateRef: string,
            author: unknown,
            committer: unknown,
            commitMessage: string,
            tree: unknown,
            commitParents: NodeGitCommit[],
          ): Promise<{ tostrS(): string }>;
        }
      ).createCommit('HEAD', signature, signature, message, treeOid, parentCommits);

      const hash = commitOid.tostrS();

      // Get current branch
      let branch = 'HEAD';
      try {
        const head = await repo.head();
        branch = head.shorthand();
      } catch {
        // Ignore errors
      }

      return {
        hash,
        branch,
        summary: message.split('\n')[0] ?? message,
        filesChanged: 0, // nodegit doesn't provide this easily
        insertions: 0,
        deletions: 0,
      };
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw this.mapError(error);
    }
  }

  public async add(
    workdir: string,
    paths: string[],
    opts?: BackendAddOpts & BackendExecOpts,
  ): Promise<void> {
    const nodegit = await this.getNodeGit();

    try {
      const repo = await nodegit.Repository.open(workdir);
      const index = await repo.index();

      if (opts?.all || paths.includes('.')) {
        await index.addAll();
      } else {
        for (const filepath of paths) {
          await index.addByPath(filepath);
        }
      }

      await index.write();
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async branchList(
    workdir: string,
    _opts?: BranchOpts & BackendExecOpts,
  ): Promise<BranchInfo[]> {
    const nodegit = await this.getNodeGit();

    try {
      const repo = await nodegit.Repository.open(workdir);
      const references = await repo.getReferences();
      return convertBranches(repo, references);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async branchCreate(
    workdir: string,
    name: string,
    opts?: BackendBranchCreateOpts & BackendExecOpts,
  ): Promise<void> {
    const nodegit = await this.getNodeGit();

    try {
      const repo = await nodegit.Repository.open(workdir);

      // Get the commit to branch from
      let commit: NodeGitCommit;
      if (opts?.startPoint) {
        // Resolve the start point
        commit = await (
          repo as unknown as { getCommit(ref: string): Promise<NodeGitCommit> }
        ).getCommit(opts.startPoint);
      } else {
        commit = await repo.getHeadCommit();
      }

      await nodegit.Branch.create(repo, name, commit, opts?.force ?? false);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  // ===========================================================================
  // Extended Operations (Tier 1 + Tier 2)
  // ===========================================================================

  public async fetch(workdir: string, opts?: FetchOpts & BackendExecOpts): Promise<void> {
    const nodegit = await this.getNodeGit();

    if (!nodegit.Remote) {
      throw new GitError('CapabilityMissing', 'Fetch is not supported by this nodegit version.', {});
    }

    try {
      const repo = await nodegit.Repository.open(workdir);
      const remoteName = opts?.remote ?? 'origin';
      const remote = await nodegit.Remote.lookup(repo, remoteName);

      const fetchOpts: Record<string, unknown> = {
        callbacks: {} as Record<string, unknown>,
      };

      // Certificate check
      if (this.certificateCheck) {
        (fetchOpts.callbacks as Record<string, unknown>).certificateCheck = this.certificateCheck;
      }

      // Credentials
      if (this.credentials) {
        (fetchOpts.callbacks as Record<string, unknown>).credentials = this.credentials;
      }

      // Progress tracking
      if (opts?.onProgress) {
        (fetchOpts.callbacks as Record<string, unknown>).transferProgress = (stats: {
          receivedObjects(): number;
          totalObjects(): number;
        }) => {
          opts.onProgress?.({
            phase: 'Receiving objects',
            current: stats.receivedObjects(),
            total: stats.totalObjects(),
            percent:
              stats.totalObjects() > 0
                ? Math.round((stats.receivedObjects() / stats.totalObjects()) * 100)
                : null,
          });
        };
      }

      await remote.fetch([], fetchOpts, 'Fetch');
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async push(workdir: string, opts?: PushOpts & BackendExecOpts): Promise<void> {
    const nodegit = await this.getNodeGit();

    if (!nodegit.Remote) {
      throw new GitError('CapabilityMissing', 'Push is not supported by this nodegit version.', {});
    }

    try {
      const repo = await nodegit.Repository.open(workdir);
      const remoteName = opts?.remote ?? 'origin';
      const remote = await nodegit.Remote.lookup(repo, remoteName);

      const pushOpts: Record<string, unknown> = {
        callbacks: {} as Record<string, unknown>,
      };

      // Certificate check
      if (this.certificateCheck) {
        (pushOpts.callbacks as Record<string, unknown>).certificateCheck = this.certificateCheck;
      }

      // Credentials
      if (this.credentials) {
        (pushOpts.callbacks as Record<string, unknown>).credentials = this.credentials;
      }

      // Build refspecs
      const refSpecs: string[] = [];

      if (opts?.refspec) {
        // Use provided refspec(s)
        const specs = Array.isArray(opts.refspec) ? opts.refspec : [opts.refspec];
        for (const spec of specs) {
          if (opts?.force && !spec.startsWith('+')) {
            refSpecs.push(`+${spec}`);
          } else {
            refSpecs.push(spec);
          }
        }
      } else {
        // Default: push current branch
        const repo = await nodegit.Repository.open(workdir);
        const head = await repo.head();
        const branch = head.shorthand();
        if (opts?.force) {
          refSpecs.push(`+refs/heads/${branch}:refs/heads/${branch}`);
        } else {
          refSpecs.push(`refs/heads/${branch}:refs/heads/${branch}`);
        }
      }

      await remote.push(refSpecs, pushOpts);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async checkout(
    workdir: string,
    target: string,
    opts?: CheckoutBranchOpts & BackendExecOpts,
  ): Promise<void> {
    const nodegit = await this.getNodeGit();

    try {
      const repo = await nodegit.Repository.open(workdir);

      const checkoutOpts: Record<string, unknown> = {};

      if (opts?.force) {
        // FORCE = 2 in libgit2
        checkoutOpts.checkoutStrategy = 2;
      }

      if (opts?.createBranch || opts?.forceCreateBranch) {
        // Create new branch and checkout
        let startCommit: NodeGitCommit;
        if (opts?.startPoint) {
          startCommit = await (
            repo as unknown as { getCommit(ref: string): Promise<NodeGitCommit> }
          ).getCommit(opts.startPoint);
        } else {
          startCommit = await repo.getHeadCommit();
        }
        await nodegit.Branch.create(repo, target, startCommit, opts?.forceCreateBranch ?? false);
        await repo.checkoutBranch(target, checkoutOpts);
      } else {
        // Try to checkout existing branch/commit
        try {
          await repo.checkoutBranch(target, checkoutOpts);
        } catch {
          // Not a branch, try as commit
          if (!nodegit.Checkout) {
            throw new GitError('CapabilityMissing', 'Checkout is not supported by this nodegit version.', {});
          }
          const commit = await (
            repo as unknown as { getCommit(ref: string): Promise<NodeGitCommit> }
          ).getCommit(target);
          await nodegit.Checkout.tree(repo, commit, checkoutOpts);
          await repo.setHead(`refs/heads/${target}`);
        }
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async checkoutPaths(
    workdir: string,
    paths: string[],
    opts?: CheckoutPathOpts & BackendExecOpts,
  ): Promise<void> {
    const nodegit = await this.getNodeGit();

    if (!nodegit.Checkout) {
      throw new GitError('CapabilityMissing', 'CheckoutPaths is not supported by this nodegit version.', {});
    }

    try {
      const repo = await nodegit.Repository.open(workdir);

      const checkoutOpts: Record<string, unknown> = {
        paths,
      };

      if (opts?.source) {
        // Checkout from specific commit/branch
        const commit = await (
          repo as unknown as { getCommit(ref: string): Promise<NodeGitCommit> }
        ).getCommit(opts.source);
        await nodegit.Checkout.tree(repo, commit, checkoutOpts);
      } else {
        // Checkout from HEAD
        await nodegit.Checkout.head(repo, checkoutOpts);
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async diff(
    workdir: string,
    target?: string,
    opts?: DiffOpts & BackendExecOpts,
  ): Promise<DiffResult> {
    const nodegit = await this.getNodeGit();

    try {
      const repo = await nodegit.Repository.open(workdir);

      // nodegit has complex diff APIs, using simplified approach
      type DiffEntry = {
        oldFile(): { path(): string };
        newFile(): { path(): string };
        status(): number;
        isAdded(): boolean;
        isDeleted(): boolean;
        isModified(): boolean;
        isRenamed(): boolean;
        isTypeChange(): boolean;
      };

      type NodeGitDiff = {
        patches(): Promise<DiffEntry[]>;
        numDeltas(): number;
      };

      let diff: NodeGitDiff;

      if (target) {
        // Diff between target and HEAD
        const commit = await (
          repo as unknown as { getCommit(ref: string): Promise<NodeGitCommit> }
        ).getCommit(target);
        const tree = await (
          commit as unknown as { getTree(): Promise<unknown> }
        ).getTree();
        const headCommit = await repo.getHeadCommit();
        const headTree = await (
          headCommit as unknown as { getTree(): Promise<unknown> }
        ).getTree();
        diff = await (
          repo as unknown as {
            diffTreeToTree(
              oldTree: unknown,
              newTree: unknown,
              opts?: unknown,
            ): Promise<NodeGitDiff>;
          }
        ).diffTreeToTree(tree, headTree, undefined);
      } else if (opts?.staged) {
        // Diff of staged changes
        const headCommit = await repo.getHeadCommit();
        const tree = await (
          headCommit as unknown as { getTree(): Promise<unknown> }
        ).getTree();
        diff = await (
          repo as unknown as {
            diffTreeToIndex(tree: unknown, index?: unknown, opts?: unknown): Promise<NodeGitDiff>;
          }
        ).diffTreeToIndex(tree, undefined, undefined);
      } else {
        // Diff of unstaged changes
        diff = await (
          repo as unknown as {
            diffIndexToWorkdir(index?: unknown, opts?: unknown): Promise<NodeGitDiff>;
          }
        ).diffIndexToWorkdir(undefined, undefined);
      }

      // Convert patches to file entries
      const patches = await diff.patches();
      const files = patches.map((patch) => {
        let status: 'A' | 'D' | 'M' | 'R' | 'T' | 'U' = 'M';
        if (patch.isAdded()) {
          status = 'A';
        }
        if (patch.isDeleted()) {
          status = 'D';
        }
        if (patch.isRenamed()) {
          status = 'R';
        }
        if (patch.isTypeChange()) {
          status = 'T';
        }

        return {
          path: patch.newFile().path() || patch.oldFile().path(),
          status,
          oldPath: patch.isRenamed() ? patch.oldFile().path() : undefined,
        };
      });

      return { files };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async reset(
    workdir: string,
    target?: string,
    opts?: ResetOpts & BackendExecOpts,
  ): Promise<void> {
    const nodegit = await this.getNodeGit();

    try {
      const repo = await nodegit.Repository.open(workdir);

      // Get target commit
      let commit: NodeGitCommit;
      if (target) {
        commit = await (
          repo as unknown as { getCommit(ref: string): Promise<NodeGitCommit> }
        ).getCommit(target);
      } else {
        commit = await repo.getHeadCommit();
      }

      // Determine reset type
      // Default reset type values from libgit2: SOFT=1, MIXED=2, HARD=3
      const RESET_SOFT = 1;
      const RESET_MIXED = 2;
      const RESET_HARD = 3;

      let resetType = RESET_MIXED; // default
      if (opts?.mode === 'soft') {
        resetType = RESET_SOFT;
      } else if (opts?.mode === 'hard') {
        resetType = RESET_HARD;
      } else if (opts?.mode === 'merge' || opts?.mode === 'keep') {
        // nodegit doesn't directly support merge/keep modes
        // Fall back to mixed
        resetType = RESET_MIXED;
      }

      if (!nodegit.Reset) {
        throw new GitError('CapabilityMissing', 'Reset is not supported by this nodegit version.', {});
      }

      await nodegit.Reset.reset(repo, commit, resetType);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async merge(
    workdir: string,
    branch: string,
    opts?: MergeOpts & BackendExecOpts,
  ): Promise<MergeResult> {
    const nodegit = await this.getNodeGit();

    try {
      const repo = await nodegit.Repository.open(workdir);

      // Get current branch
      const head = await repo.head();
      const currentBranch = head.shorthand();

      // Get signature for merge commit
      let signature: unknown;
      try {
        signature = await nodegit.Signature.default(repo);
      } catch {
        signature = nodegit.Signature.now('type-git', 'type-git@localhost');
      }

      // Merge preference (0 = no fast-forward, 1 = fast-forward only, 2 = fast-forward if possible)
      let preference = 2; // default: fast-forward if possible
      if (opts?.ff === 'only') {
        preference = 1;
      } else if (opts?.ff === 'no' || opts?.ff === false) {
        preference = 0;
      }

      try {
        await repo.mergeBranches(currentBranch, branch, signature, preference, undefined);
        return { success: true, conflicts: [] };
      } catch (error) {
        const errorObj = error as { message?: string };
        if (errorObj.message?.includes('conflict')) {
          // Get list of conflicting files from status
          const statusFiles = await repo.getStatus();
          const conflicts = statusFiles
            .filter((f) => {
              const flags = f.status();
              return flags.includes(32768); // STATUS_CONFLICTED
            })
            .map((f) => f.path());

          return { success: false, conflicts };
        }
        throw error;
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async pull(workdir: string, opts?: PullOpts & BackendExecOpts): Promise<void> {
    // Pull is composed as fetch + merge
    await this.fetch(workdir, {
      remote: opts?.remote,
      onProgress: opts?.onProgress,
      signal: opts?.signal,
    });

    // Get remote tracking branch
    const nodegit = await this.getNodeGit();
    const repo = await nodegit.Repository.open(workdir);
    const head = await repo.head();
    const branchName = head.shorthand();
    const remote = opts?.remote ?? 'origin';

    await this.merge(workdir, `${remote}/${branchName}`, {
      ff: opts?.ff,
    });
  }

  public async stashPush(workdir: string, opts?: StashPushOpts & BackendExecOpts): Promise<void> {
    const nodegit = await this.getNodeGit();

    if (!nodegit.Stash) {
      throw new GitError('CapabilityMissing', 'Stash is not supported by this nodegit version.', {});
    }

    try {
      const repo = await nodegit.Repository.open(workdir);

      // Get signature
      let signature: unknown;
      try {
        signature = await nodegit.Signature.default(repo);
      } catch {
        signature = nodegit.Signature.now('type-git', 'type-git@localhost');
      }

      const message = opts?.message ?? '';
      let flags = 0;

      if (opts?.includeUntracked) {
        flags |= nodegit.Stash.INCLUDE_UNTRACKED;
      }
      if (opts?.keepIndex) {
        flags |= nodegit.Stash.KEEP_INDEX;
      }

      await nodegit.Stash.save(repo, signature, message, flags);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async stashPop(workdir: string, opts?: StashApplyOpts & BackendExecOpts): Promise<void> {
    const nodegit = await this.getNodeGit();

    if (!nodegit.Stash) {
      throw new GitError('CapabilityMissing', 'Stash is not supported by this nodegit version.', {});
    }

    try {
      const repo = await nodegit.Repository.open(workdir);
      const index = opts?.index ?? 0;

      await nodegit.Stash.pop(repo, index, undefined);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async stashList(workdir: string, _opts?: BackendExecOpts): Promise<StashEntry[]> {
    const nodegit = await this.getNodeGit();

    if (!nodegit.Stash) {
      throw new GitError('CapabilityMissing', 'Stash is not supported by this nodegit version.', {});
    }

    try {
      const repo = await nodegit.Repository.open(workdir);
      const entries: StashEntry[] = [];

      await nodegit.Stash.foreach(repo, (index, message, stashOid) => {
        entries.push({
          index,
          message,
          branch: undefined, // nodegit doesn't provide branch info easily
          commit: typeof stashOid === 'object' && stashOid !== null && 'tostrS' in stashOid
            ? (stashOid as { tostrS(): string }).tostrS().substring(0, 7)
            : String(stashOid).substring(0, 7),
        });
        return 0; // Continue iteration
      });

      return entries;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async tagList(workdir: string, opts?: TagListOpts & BackendExecOpts): Promise<string[]> {
    const nodegit = await this.getNodeGit();

    if (!nodegit.Tag) {
      throw new GitError('CapabilityMissing', 'Tag is not supported by this nodegit version.', {});
    }

    try {
      const repo = await nodegit.Repository.open(workdir);
      let tags = await nodegit.Tag.list(repo);

      // Apply pattern filter if specified
      if (opts?.pattern) {
        const regex = new RegExp(
          opts.pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
        );
        tags = tags.filter((tag) => regex.test(tag));
      }

      return tags;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async tagCreate(
    workdir: string,
    name: string,
    opts?: TagCreateOpts & BackendExecOpts,
  ): Promise<void> {
    const nodegit = await this.getNodeGit();

    if (!nodegit.Tag) {
      throw new GitError('CapabilityMissing', 'Tag is not supported by this nodegit version.', {});
    }

    try {
      const repo = await nodegit.Repository.open(workdir);

      // Get target commit
      let targetCommit: NodeGitCommit;
      if (opts?.commit) {
        targetCommit = await (
          repo as unknown as { getCommit(ref: string): Promise<NodeGitCommit> }
        ).getCommit(opts.commit);
      } else {
        targetCommit = await repo.getHeadCommit();
      }

      if (opts?.message) {
        // Annotated tag
        let signature: unknown;
        try {
          signature = await nodegit.Signature.default(repo);
        } catch {
          signature = nodegit.Signature.now('type-git', 'type-git@localhost');
        }

        await nodegit.Tag.create(
          repo,
          name,
          targetCommit,
          signature,
          opts.message,
          opts?.force ? 1 : 0,
        );
      } else {
        // Lightweight tag
        await nodegit.Tag.createLightweight(
          repo,
          name,
          targetCommit,
          opts?.force ? 1 : 0,
        );
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private mapError(error: unknown): GitError {
    if (error instanceof GitError) {
      return error;
    }

    const errorObj = error as { errno?: number; message?: string };
    const message = errorObj.message ?? String(error);
    const errno = errorObj.errno;

    // libgit2 error codes
    const GIT_EAUTH = -16;
    const GIT_ECONFLICT = -13;

    let category: 'auth' | 'network' | 'conflict' | 'permission' | 'unknown' = 'unknown';

    if (errno === GIT_EAUTH) {
      category = 'auth';
    } else if (errno === GIT_ECONFLICT) {
      category = 'conflict';
    } else if (message.includes('SSL') || message.includes('certificate')) {
      category = 'network';
    } else if (message.includes('permission') || message.includes('Permission')) {
      category = 'permission';
    }

    return new GitError('NonZeroExit', message, { exitCode: errno }, category);
  }
}

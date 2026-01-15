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
  Commit,
  CommitOpts,
  CommitResult,
  LogOpts,
  StatusOpts,
  StatusPorcelain,
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

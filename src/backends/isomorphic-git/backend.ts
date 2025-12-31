/**
 * isomorphic-git Backend Implementation
 *
 * Pure JavaScript Git implementation that works in Node.js, Deno, Bun, and browsers.
 * Does NOT support LFS operations.
 */

import type {
  BackendAddOpts,
  BackendBranchCreateOpts,
  BackendCapabilities,
  BackendExecOpts,
  GitBackend,
  IsomorphicGitBackendOptions,
} from '../../core/backend.js';
import type { CloneOpts, InitOpts } from '../../core/git.js';
import type {
  BranchInfo,
  BranchOpts,
  CheckoutBranchOpts,
  Commit,
  CommitOpts,
  CommitResult,
  FetchOpts,
  LogOpts,
  MergeOpts,
  MergeResult,
  PullOpts,
  PushOpts,
  StatusOpts,
  StatusPorcelain,
  TagCreateOpts,
  TagListOpts,
} from '../../core/repo.js';
import { GitError } from '../../core/types.js';
import {
  convertBranches,
  convertCommits,
  convertStatusMatrix,
  type IsomorphicGitCommit,
  type StatusMatrixEntry,
} from './converters.js';

/**
 * isomorphic-git module interface
 * We use dynamic import to avoid bundling issues
 */
interface IsomorphicGit {
  init: (opts: {
    fs: unknown;
    dir: string;
    bare?: boolean;
    defaultBranch?: string;
  }) => Promise<void>;
  clone: (opts: {
    fs: unknown;
    http?: unknown;
    dir: string;
    url: string;
    depth?: number;
    singleBranch?: boolean;
    noCheckout?: boolean;
    ref?: string;
    onProgress?: (progress: { phase: string; loaded: number; total: number }) => void;
    onAuth?: (url: string) => { username: string; password: string } | undefined;
    onAuthFailure?: (
      url: string,
      auth: { username: string; password: string },
    ) => { username: string; password: string } | undefined;
  }) => Promise<void>;
  statusMatrix: (opts: {
    fs: unknown;
    dir: string;
    filter?: (f: string) => boolean;
  }) => Promise<StatusMatrixEntry[]>;
  log: (opts: {
    fs: unknown;
    dir: string;
    depth?: number;
    ref?: string;
  }) => Promise<IsomorphicGitCommit[]>;
  commit: (opts: {
    fs: unknown;
    dir: string;
    message: string;
    author?: { name: string; email: string; timestamp?: number };
    committer?: { name: string; email: string; timestamp?: number };
    noUpdateBranch?: boolean;
  }) => Promise<string>;
  add: (opts: { fs: unknown; dir: string; filepath: string }) => Promise<void>;
  listBranches: (opts: { fs: unknown; dir: string; remote?: string }) => Promise<string[]>;
  branch: (opts: {
    fs: unknown;
    dir: string;
    ref: string;
    object?: string;
    checkout?: boolean;
    force?: boolean;
  }) => Promise<void>;
  currentBranch: (opts: {
    fs: unknown;
    dir: string;
    fullname?: boolean;
  }) => Promise<string | undefined>;
  resolveRef: (opts: { fs: unknown; dir: string; ref: string }) => Promise<string>;
  findRoot: (opts: { fs: unknown; filepath: string }) => Promise<string>;
  // Extended operations
  fetch: (opts: {
    fs: unknown;
    http?: unknown;
    dir: string;
    remote?: string;
    ref?: string;
    depth?: number;
    prune?: boolean;
    tags?: boolean;
    singleBranch?: boolean;
    onProgress?: (progress: { phase: string; loaded: number; total: number }) => void;
    onAuth?: (url: string) => { username: string; password: string } | undefined;
    onAuthFailure?: (
      url: string,
      auth: { username: string; password: string },
    ) => { username: string; password: string } | undefined;
  }) => Promise<{ fetchHead: string | null; fetchHeadDescription: string | null }>;
  push: (opts: {
    fs: unknown;
    http?: unknown;
    dir: string;
    remote?: string;
    ref?: string;
    force?: boolean;
    delete?: boolean;
    onProgress?: (progress: { phase: string; loaded: number; total: number }) => void;
    onAuth?: (url: string) => { username: string; password: string } | undefined;
    onAuthFailure?: (
      url: string,
      auth: { username: string; password: string },
    ) => { username: string; password: string } | undefined;
  }) => Promise<{ ok: boolean; error?: string }>;
  checkout: (opts: {
    fs: unknown;
    dir: string;
    ref?: string;
    filepaths?: string[];
    remote?: string;
    force?: boolean;
    noCheckout?: boolean;
    onProgress?: (progress: { phase: string; loaded: number; total: number }) => void;
  }) => Promise<void>;
  merge: (opts: {
    fs: unknown;
    dir: string;
    ours?: string;
    theirs: string;
    fastForward?: boolean;
    fastForwardOnly?: boolean;
    dryRun?: boolean;
    noUpdateBranch?: boolean;
    abortOnConflict?: boolean;
    message?: string;
    author?: { name: string; email: string };
    committer?: { name: string; email: string };
  }) => Promise<{ oid?: string; alreadyMerged?: boolean; fastForward?: boolean; tree?: string }>;
  listTags: (opts: { fs: unknown; dir: string }) => Promise<string[]>;
  tag: (opts: {
    fs: unknown;
    dir: string;
    ref: string;
    object?: string;
    force?: boolean;
    message?: string;
    signature?: { name: string; email: string };
  }) => Promise<void>;
}

/**
 * isomorphic-git Backend
 */
export class IsomorphicGitBackend implements GitBackend {
  private readonly fs: unknown;
  private readonly http: unknown | undefined;
  private readonly onAuth: IsomorphicGitBackendOptions['onAuth'];
  private readonly onAuthFailure: IsomorphicGitBackendOptions['onAuthFailure'];
  private git: IsomorphicGit | null = null;

  public constructor(options: IsomorphicGitBackendOptions) {
    this.fs = options.fs;
    this.http = options.http;
    this.onAuth = options.onAuth;
    this.onAuthFailure = options.onAuthFailure;
  }

  /**
   * Lazy load isomorphic-git module
   */
  private async getGit(): Promise<IsomorphicGit> {
    if (this.git) {
      return this.git;
    }

    try {
      // Dynamic import to support different module systems
      const module = await import('isomorphic-git');
      const git = module.default ?? module;
      this.git = git;
      return git;
    } catch (_error) {
      throw new GitError(
        'SpawnFailed',
        'Failed to load isomorphic-git. Make sure it is installed: npm install isomorphic-git',
        {},
        'unknown',
      );
    }
  }

  public getCapabilities(): BackendCapabilities {
    return {
      type: 'isomorphic-git',
      supportsLfs: false,
      supportsProgress: true,
      supportsAbort: false, // isomorphic-git doesn't support AbortSignal natively
      supportsBareRepo: true,
      supportsBrowser: true,
    };
  }

  // ===========================================================================
  // Repository Operations
  // ===========================================================================

  public async checkRepository(path: string): Promise<{ isBare: boolean } | null> {
    const git = await this.getGit();

    try {
      // Try to find the git root
      await git.findRoot({ fs: this.fs, filepath: path });

      // Check if it's bare by looking for HEAD in the directory
      // (bare repos have HEAD directly, worktrees have .git/HEAD)
      const fs = this.fs as {
        promises?: { stat: (path: string) => Promise<unknown> };
        stat?: (path: string, cb: (err: unknown, stat: unknown) => void) => void;
      };

      try {
        // Check for .git directory (worktree repo)
        if (fs.promises) {
          await fs.promises.stat(`${path}/.git`);
        } else if (fs.stat) {
          await new Promise((resolve, reject) => {
            fs.stat?.(`${path}/.git`, (err, stat) => {
              if (err) {
                reject(err);
              } else {
                resolve(stat);
              }
            });
          });
        }
        return { isBare: false };
      } catch {
        // No .git directory, might be bare
        try {
          if (fs.promises) {
            await fs.promises.stat(`${path}/HEAD`);
          } else if (fs.stat) {
            await new Promise((resolve, reject) => {
              fs.stat?.(`${path}/HEAD`, (err, stat) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(stat);
                }
              });
            });
          }
          return { isBare: true };
        } catch {
          return null;
        }
      }
    } catch {
      return null;
    }
  }

  public async init(path: string, opts?: InitOpts & BackendExecOpts): Promise<void> {
    const git = await this.getGit();

    try {
      await git.init({
        fs: this.fs,
        dir: path,
        bare: opts?.bare,
        defaultBranch: opts?.initialBranch,
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async clone(url: string, path: string, opts?: CloneOpts & BackendExecOpts): Promise<void> {
    const git = await this.getGit();

    try {
      await git.clone({
        fs: this.fs,
        http: this.http,
        dir: path,
        url,
        depth: opts?.depth,
        singleBranch: opts?.singleBranch,
        noCheckout: opts?.noCheckout,
        ref: opts?.branch,
        onProgress: opts?.onProgress
          ? (progress) => {
              opts.onProgress?.({
                phase: progress.phase,
                current: progress.loaded,
                total: progress.total,
                percent:
                  progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : null,
              });
            }
          : undefined,
        onAuth: this.onAuth,
        onAuthFailure: this.onAuthFailure,
      });
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
    const git = await this.getGit();

    try {
      const matrix = await git.statusMatrix({
        fs: this.fs,
        dir: workdir,
      });

      const entries = convertStatusMatrix(matrix);

      // Get current branch
      let branch: string | undefined;
      try {
        branch = await git.currentBranch({ fs: this.fs, dir: workdir });
      } catch {
        // Ignore errors getting branch
      }

      return {
        entries,
        branch,
        upstream: undefined, // isomorphic-git doesn't easily expose this
        ahead: undefined,
        behind: undefined,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async log(workdir: string, opts?: LogOpts & BackendExecOpts): Promise<Commit[]> {
    const git = await this.getGit();

    try {
      const commits = await git.log({
        fs: this.fs,
        dir: workdir,
        depth: opts?.maxCount,
        ref: opts?.all ? undefined : 'HEAD',
      });

      return convertCommits(commits);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async commit(
    workdir: string,
    message: string,
    opts?: CommitOpts & BackendExecOpts,
  ): Promise<CommitResult> {
    const git = await this.getGit();

    try {
      // Parse author if provided
      let author: { name: string; email: string } | undefined;
      if (opts?.author) {
        const match = opts.author.match(/^(.+?)\s*<(.+?)>$/);
        if (match?.[1] && match[2]) {
          author = { name: match[1].trim(), email: match[2].trim() };
        }
      }

      const hash = await git.commit({
        fs: this.fs,
        dir: workdir,
        message,
        author,
      });

      // Get current branch
      let branch = 'HEAD';
      try {
        const currentBranch = await git.currentBranch({ fs: this.fs, dir: workdir });
        if (currentBranch) {
          branch = currentBranch;
        }
      } catch {
        // Ignore errors
      }

      // isomorphic-git doesn't provide stats, so we return zeros
      return {
        hash,
        branch,
        summary: message.split('\n')[0] ?? message,
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async add(
    workdir: string,
    paths: string[],
    _opts?: BackendAddOpts & BackendExecOpts,
  ): Promise<void> {
    const git = await this.getGit();

    try {
      // isomorphic-git adds one file at a time
      for (const filepath of paths) {
        if (filepath === '.') {
          // For '.', we need to add all files - isomorphic-git doesn't have a built-in way
          // This is a limitation - we'd need to walk the directory
          throw new GitError(
            'CapabilityMissing',
            'isomorphic-git does not support adding all files with ".". Please specify individual file paths.',
            {},
          );
        }

        await git.add({
          fs: this.fs,
          dir: workdir,
          filepath,
        });
      }
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw this.mapError(error);
    }
  }

  public async branchList(
    workdir: string,
    opts?: BranchOpts & BackendExecOpts,
  ): Promise<BranchInfo[]> {
    const git = await this.getGit();

    try {
      const branches = await git.listBranches({
        fs: this.fs,
        dir: workdir,
        remote: opts?.remotes ? 'origin' : undefined,
      });

      const currentBranch = await git.currentBranch({ fs: this.fs, dir: workdir });

      return convertBranches(branches, currentBranch, async (ref) => {
        return git.resolveRef({ fs: this.fs, dir: workdir, ref });
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async branchCreate(
    workdir: string,
    name: string,
    opts?: BackendBranchCreateOpts & BackendExecOpts,
  ): Promise<void> {
    const git = await this.getGit();

    try {
      await git.branch({
        fs: this.fs,
        dir: workdir,
        ref: name,
        object: opts?.startPoint,
        force: opts?.force,
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  // ===========================================================================
  // Extended Operations (Tier 1 + Tier 2)
  // ===========================================================================

  public async fetch(workdir: string, opts?: FetchOpts & BackendExecOpts): Promise<void> {
    const git = await this.getGit();

    try {
      await git.fetch({
        fs: this.fs,
        http: this.http,
        dir: workdir,
        remote: opts?.remote,
        ref: opts?.refspec
          ? Array.isArray(opts.refspec)
            ? opts.refspec[0]
            : opts.refspec
          : undefined,
        depth: opts?.depth,
        prune: opts?.prune,
        tags: opts?.tags,
        singleBranch: false,
        onProgress: opts?.onProgress
          ? (progress) => {
              opts.onProgress?.({
                phase: progress.phase,
                current: progress.loaded,
                total: progress.total,
                percent:
                  progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : null,
              });
            }
          : undefined,
        onAuth: this.onAuth,
        onAuthFailure: this.onAuthFailure,
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async push(workdir: string, opts?: PushOpts & BackendExecOpts): Promise<void> {
    const git = await this.getGit();

    try {
      const result = await git.push({
        fs: this.fs,
        http: this.http,
        dir: workdir,
        remote: opts?.remote,
        ref: opts?.refspec
          ? Array.isArray(opts.refspec)
            ? opts.refspec[0]
            : opts.refspec
          : undefined,
        force: opts?.force,
        delete: opts?.deleteRefs,
        onProgress: opts?.onProgress
          ? (progress) => {
              opts.onProgress?.({
                phase: progress.phase,
                current: progress.loaded,
                total: progress.total,
                percent:
                  progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : null,
              });
            }
          : undefined,
        onAuth: this.onAuth,
        onAuthFailure: this.onAuthFailure,
      });

      if (!result.ok && result.error) {
        throw new GitError('NonZeroExit', result.error, {});
      }
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw this.mapError(error);
    }
  }

  public async checkout(
    workdir: string,
    target: string,
    opts?: CheckoutBranchOpts & BackendExecOpts,
  ): Promise<void> {
    const git = await this.getGit();

    try {
      // If creating a new branch, create it first
      if (opts?.createBranch || opts?.forceCreateBranch) {
        await git.branch({
          fs: this.fs,
          dir: workdir,
          ref: target,
          object: opts.startPoint,
          force: opts.forceCreateBranch,
        });
      }

      await git.checkout({
        fs: this.fs,
        dir: workdir,
        ref: target,
        force: opts?.force,
        onProgress: opts?.onProgress
          ? (progress) => {
              opts.onProgress?.({
                phase: progress.phase,
                current: progress.loaded,
                total: progress.total,
                percent:
                  progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : null,
              });
            }
          : undefined,
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async merge(
    workdir: string,
    branch: string,
    opts?: MergeOpts & BackendExecOpts,
  ): Promise<MergeResult> {
    const git = await this.getGit();

    try {
      // Parse author if provided in message or from config
      let author: { name: string; email: string } | undefined;

      const result = await git.merge({
        fs: this.fs,
        dir: workdir,
        theirs: branch,
        fastForward: opts?.ff !== 'no' && opts?.ff !== false,
        fastForwardOnly: opts?.ff === 'only',
        message: opts?.message,
        author,
        abortOnConflict: true, // Always abort on conflict for now
      });

      return {
        success: true,
        hash: result.oid,
        fastForward: result.fastForward,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Check if it's a conflict error
      if (
        message.includes('MergeNotSupportedError') ||
        message.includes('conflict') ||
        message.includes('Merge conflict')
      ) {
        return {
          success: false,
          conflicts: [], // isomorphic-git doesn't provide conflict list easily
        };
      }

      throw this.mapError(error);
    }
  }

  public async pull(workdir: string, opts?: PullOpts & BackendExecOpts): Promise<void> {
    // isomorphic-git doesn't have a native pull, so we compose fetch + merge
    const git = await this.getGit();

    try {
      // Fetch first
      await this.fetch(workdir, {
        remote: opts?.remote,
        tags: opts?.tags,
        prune: opts?.prune,
        depth: opts?.depth,
        onProgress: opts?.onProgress,
      });

      // Get the current branch
      const currentBranch = await git.currentBranch({ fs: this.fs, dir: workdir });
      if (!currentBranch) {
        throw new GitError('NonZeroExit', 'Not on any branch', {});
      }

      // Merge remote tracking branch
      const remote = opts?.remote ?? 'origin';
      const remoteBranch = `${remote}/${opts?.branch ?? currentBranch}`;

      await this.merge(workdir, remoteBranch, {
        ff: opts?.ff,
        message: `Merge ${remoteBranch} into ${currentBranch}`,
      });
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw this.mapError(error);
    }
  }

  public async tagList(workdir: string, _opts?: TagListOpts & BackendExecOpts): Promise<string[]> {
    const git = await this.getGit();

    try {
      const tags = await git.listTags({ fs: this.fs, dir: workdir });
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
    const git = await this.getGit();

    try {
      await git.tag({
        fs: this.fs,
        dir: workdir,
        ref: name,
        object: opts?.commit,
        force: opts?.force,
        message: opts?.message,
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  // Note: The following operations are NOT supported by isomorphic-git:
  // - checkoutPaths (path-based checkout)
  // - diff (no native diff API)
  // - reset (limited - only resetIndex for mixed/soft)
  // - stashPush/stashPop/stashList (no stash support)

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private mapError(error: unknown): GitError {
    if (error instanceof GitError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    // Detect error category from message
    let category: 'auth' | 'network' | 'conflict' | 'permission' | 'unknown' = 'unknown';

    if (
      message.includes('401') ||
      message.includes('authentication') ||
      message.includes('Authentication')
    ) {
      category = 'auth';
    } else if (
      message.includes('ENOTFOUND') ||
      message.includes('network') ||
      message.includes('fetch')
    ) {
      category = 'network';
    } else if (message.includes('conflict') || message.includes('Merge conflict')) {
      category = 'conflict';
    } else if (message.includes('permission') || message.includes('EACCES')) {
      category = 'permission';
    }

    return new GitError('NonZeroExit', message, {}, category);
  }
}

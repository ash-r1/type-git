/**
 * Backend-based Git implementation
 *
 * This module provides a Git implementation that uses GitBackend
 * instead of directly using CliRunner. This allows using alternative
 * backends like isomorphic-git, nodegit, or wasm-git.
 */

import type { GitBackend } from '../core/backend.js';
import type {
  CloneOpts,
  Git,
  GlobalConfigOperations,
  GlobalLfsOperations,
  InitOpts,
  LsRemoteOpts,
  LsRemoteResult,
} from '../core/git.js';
import type { BareRepo, WorktreeRepo } from '../core/repo.js';
import type { ExecOpts, GitOpenOptions, RawResult } from '../core/types.js';
import { GitError } from '../core/types.js';
import { BackendBareRepoImpl } from './backend-bare-repo-impl.js';
import { BackendWorktreeRepoImpl } from './backend-worktree-repo-impl.js';

/**
 * Options for creating a backend-based Git instance
 */
export type CreateBackendGitOptions = {
  /** Git backend to use */
  backend: GitBackend;
};

/**
 * Backend-based Git implementation
 *
 * This implementation uses GitBackend for all operations,
 * allowing the use of alternative Git implementations.
 */
export class BackendGitImpl implements Git {
  private readonly backend: GitBackend;
  public readonly config: GlobalConfigOperations;
  public readonly lfs: GlobalLfsOperations;

  public constructor(options: CreateBackendGitOptions) {
    this.backend = options.backend;

    // Config and LFS operations are not supported in backend mode
    // They throw errors indicating the limitation
    this.config = {
      get: this.unsupportedConfigOp.bind(this),
      getAll: this.unsupportedConfigOp.bind(this),
      set: this.unsupportedConfigOp.bind(this),
      add: this.unsupportedConfigOp.bind(this),
      unset: this.unsupportedConfigOp.bind(this),
      getRaw: this.unsupportedConfigOp.bind(this),
      setRaw: this.unsupportedConfigOp.bind(this),
      unsetRaw: this.unsupportedConfigOp.bind(this),
      list: this.unsupportedConfigOp.bind(this),
    };

    this.lfs = {
      install: this.unsupportedLfsOp.bind(this),
      uninstall: this.unsupportedLfsOp.bind(this),
      version: this.unsupportedLfsOp.bind(this),
    };
  }

  /**
   * Open an existing worktree repository
   * Throws GitError if the repository is bare.
   */
  public async open(path: string, opts?: GitOpenOptions): Promise<WorktreeRepo> {
    const repo = await this.openRaw(path, opts);

    // Check if it's a worktree repo
    if (await repo.isBare()) {
      throw new GitError(
        'NotWorktreeRepo',
        `Expected worktree repository but found bare repository: ${path}`,
        { gitDir: path },
      );
    }

    return repo as WorktreeRepo;
  }

  /**
   * Open an existing bare repository
   * Throws GitError if the repository is not bare.
   */
  public async openBare(path: string, opts?: GitOpenOptions): Promise<BareRepo> {
    const repo = await this.openRaw(path, opts);

    // Check if it's a bare repo
    if (!(await repo.isBare())) {
      throw new GitError(
        'NotBareRepo',
        `Expected bare repository but found worktree repository: ${path}`,
        { workdir: path },
      );
    }

    return repo as BareRepo;
  }

  /**
   * Open an existing repository without type guarantee
   * Returns either WorktreeRepo or BareRepo depending on the repository type.
   */
  public async openRaw(path: string, _opts?: GitOpenOptions): Promise<WorktreeRepo | BareRepo> {
    const result = await this.backend.checkRepository(path);

    if (!result) {
      throw new GitError('NonZeroExit', `Not a git repository: ${path}`, {});
    }

    if (result.isBare) {
      return new BackendBareRepoImpl(this.backend, path);
    }

    return new BackendWorktreeRepoImpl(this.backend, path);
  }

  /**
   * Clone a repository
   */
  public clone(
    url: string,
    path: string,
    opts: CloneOpts & { bare: true } & ExecOpts,
  ): Promise<BareRepo>;
  public clone(
    url: string,
    path: string,
    opts: CloneOpts & { mirror: true } & ExecOpts,
  ): Promise<BareRepo>;
  public clone(url: string, path: string, opts?: CloneOpts & ExecOpts): Promise<WorktreeRepo>;
  public async clone(
    url: string,
    path: string,
    opts?: CloneOpts & ExecOpts,
  ): Promise<WorktreeRepo | BareRepo> {
    await this.backend.clone(url, path, opts);

    if (opts?.bare || opts?.mirror) {
      return new BackendBareRepoImpl(this.backend, path);
    }

    return new BackendWorktreeRepoImpl(this.backend, path);
  }

  /**
   * Initialize a new repository
   */
  public init(path: string, opts: InitOpts & { bare: true } & ExecOpts): Promise<BareRepo>;
  public init(path: string, opts?: InitOpts & ExecOpts): Promise<WorktreeRepo>;
  public async init(path: string, opts?: InitOpts & ExecOpts): Promise<WorktreeRepo | BareRepo> {
    await this.backend.init(path, opts);

    if (opts?.bare) {
      return new BackendBareRepoImpl(this.backend, path);
    }

    return new BackendWorktreeRepoImpl(this.backend, path);
  }

  /**
   * List references in a remote repository
   *
   * Note: This operation may not be supported by all backends.
   */
  public async lsRemote(url: string, opts?: LsRemoteOpts & ExecOpts): Promise<LsRemoteResult> {
    // lsRemote is typically only available in CLI backend
    if (!this.backend.raw) {
      throw new GitError(
        'CapabilityMissing',
        'lsRemote is not supported by this backend. Use CLI backend for this operation.',
        {},
      );
    }

    const args = ['ls-remote'];

    if (opts?.heads) {
      args.push('--heads');
    }

    if (opts?.tags) {
      args.push('--tags');
    }

    if (opts?.refs) {
      args.push('--refs');
    }

    args.push(url);

    const result = await this.backend.raw({ type: 'global' }, args, opts);

    // Parse ls-remote output
    const refs = result.stdout
      .trim()
      .split('\n')
      .filter((line) => line)
      .map((line) => {
        const [hash, name] = line.split('\t');
        return { hash: hash ?? '', name: name ?? '' };
      });

    return { refs };
  }

  /**
   * Get git version
   *
   * Note: Returns backend version information for non-CLI backends.
   */
  public async version(opts?: ExecOpts): Promise<string> {
    const caps = this.backend.getCapabilities();

    if (this.backend.raw) {
      const result = await this.backend.raw({ type: 'global' }, ['--version'], opts);
      const match = result.stdout.match(/git version (\S+)/);
      return match?.[1] ?? result.stdout.trim();
    }

    // Return backend type as version for non-CLI backends
    return `${caps.type} backend`;
  }

  /**
   * Execute a raw git command (repository-agnostic)
   *
   * Note: This operation is only supported by CLI backend.
   */
  public async raw(argv: string[], opts?: ExecOpts): Promise<RawResult> {
    if (!this.backend.raw) {
      throw new GitError(
        'CapabilityMissing',
        'Raw git commands are not supported by this backend. Use CLI backend for this operation.',
        {},
      );
    }

    return this.backend.raw({ type: 'global' }, argv, opts);
  }

  // ===========================================================================
  // Unsupported Operations
  // ===========================================================================

  private async unsupportedConfigOp(): Promise<never> {
    const caps = this.backend.getCapabilities();
    throw new GitError(
      'CapabilityMissing',
      `Global config operations are not supported by ${caps.type} backend. Use CLI backend for this operation.`,
      {},
    );
  }

  private async unsupportedLfsOp(): Promise<never> {
    const caps = this.backend.getCapabilities();
    throw new GitError(
      'CapabilityMissing',
      `LFS operations are not supported by ${caps.type} backend. Use CLI backend with LFS for this operation.`,
      {},
    );
  }
}

/**
 * Create a new Git instance using a backend
 *
 * @param options - Creation options including the backend
 * @returns Git instance
 */
export function createBackendGit(options: CreateBackendGitOptions): Git {
  return new BackendGitImpl(options);
}

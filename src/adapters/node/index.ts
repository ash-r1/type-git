/**
 * Node.js adapter exports
 */

import type { RuntimeAdapters } from '../../core/adapters.js';
import type {
  CloneOpts,
  Git,
  GlobalConfigOperations,
  GlobalLfsOperations,
  InitOpts,
  LsRemoteOpts,
  LsRemoteResult,
} from '../../core/git.js';
import type { BareRepo, WorktreeRepo } from '../../core/repo.js';
import type { ExecOpts, GitOpenOptions, RawResult } from '../../core/types.js';
import { type CreateGitOptions, createGit, createGitSync } from '../../impl/git-impl.js';
import { NodeExecAdapter } from './exec.js';
import { NodeFsAdapter } from './fs.js';

export { NodeExecAdapter } from './exec.js';
export { NodeFsAdapter } from './fs.js';

/**
 * Create Node.js runtime adapters
 */
export function createNodeAdapters(): RuntimeAdapters {
  return {
    exec: new NodeExecAdapter(),
    fs: new NodeFsAdapter(),
  };
}

/**
 * Options for creating a TypeGit instance (Node.js)
 * Excludes adapters as they are automatically configured
 */
export type TypeGitOptions = Omit<CreateGitOptions, 'adapters'>;

/**
 * Pre-configured Git client for Node.js
 *
 * This is a convenience class that automatically configures Node.js adapters.
 *
 * @example
 * ```typescript
 * import { TypeGit } from 'type-git/node';
 *
 * // Recommended: Use create() for version check
 * const git = await TypeGit.create();
 *
 * // Skip version check (not recommended)
 * const git = await TypeGit.create({ skipVersionCheck: true });
 *
 * // Legacy: constructor (no version check, deprecated)
 * const git = new TypeGit();
 *
 * const repo = await git.open('/path/to/repo');
 * ```
 */
export class TypeGit {
  private readonly git: Git;

  /**
   * Create a TypeGit instance with Git version check
   *
   * @param createOpts - Options including skipVersionCheck
   * @returns TypeGit instance
   * @throws GitError with kind 'UnsupportedGitVersion' if Git version is below minimum
   */
  public static async create(createOpts?: TypeGitOptions): Promise<TypeGit> {
    const gitInstance = await createGit({
      ...createOpts,
      adapters: createNodeAdapters(),
    });
    return new TypeGit(gitInstance);
  }

  /**
   * @deprecated Use TypeGit.create() instead for version checking
   */
  public constructor(constructorOpts?: TypeGitOptions);
  /** @internal */
  public constructor(existingGit: Git);
  public constructor(optionsOrGit?: TypeGitOptions | Git) {
    if (optionsOrGit && 'open' in optionsOrGit) {
      // Internal: passed a Git instance
      this.git = optionsOrGit;
    } else {
      // Legacy: construct synchronously without version check
      this.git = createGitSync({
        ...optionsOrGit,
        adapters: createNodeAdapters(),
      });
    }
  }

  /**
   * Open an existing worktree repository
   *
   * This is the most common use case. Throws GitError if the repository is bare.
   *
   * @throws GitError with kind 'NotWorktreeRepo' if the repository is bare
   */
  public get open(): (path: string, opts?: GitOpenOptions) => Promise<WorktreeRepo> {
    return this.git.open.bind(this.git);
  }

  /**
   * Open an existing bare repository
   *
   * Throws GitError if the repository is not bare.
   *
   * @throws GitError with kind 'NotBareRepo' if the repository is not bare
   */
  public get openBare(): (path: string, opts?: GitOpenOptions) => Promise<BareRepo> {
    return this.git.openBare.bind(this.git);
  }

  /**
   * Open an existing repository without type guarantee
   *
   * Returns either WorktreeRepo or BareRepo depending on the repository type.
   * Use this when you don't know the repository type at compile time.
   */
  public get openRaw(): (path: string, opts?: GitOpenOptions) => Promise<WorktreeRepo | BareRepo> {
    return this.git.openRaw.bind(this.git);
  }

  /**
   * Clone a repository
   *
   * The return type depends on the `bare` or `mirror` option:
   * - `{ bare: true }` or `{ mirror: true }` → `BareRepo`
   * - Otherwise → `WorktreeRepo`
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
  public clone(
    url: string,
    path: string,
    opts?: CloneOpts & ExecOpts,
  ): Promise<WorktreeRepo | BareRepo> {
    return this.git.clone(url, path, opts);
  }

  /**
   * Initialize a new repository
   *
   * The return type depends on the `bare` option:
   * - `{ bare: true }` → `BareRepo`
   * - Otherwise → `WorktreeRepo`
   */
  public init(path: string, opts: InitOpts & { bare: true } & ExecOpts): Promise<BareRepo>;
  public init(path: string, opts?: InitOpts & ExecOpts): Promise<WorktreeRepo>;
  public init(path: string, opts?: InitOpts & ExecOpts): Promise<WorktreeRepo | BareRepo> {
    return this.git.init(path, opts);
  }

  /**
   * List references in a remote repository
   */
  public get lsRemote(): (url: string, opts?: LsRemoteOpts & ExecOpts) => Promise<LsRemoteResult> {
    return this.git.lsRemote.bind(this.git);
  }

  /**
   * Get git version
   */
  public get version(): (opts?: ExecOpts) => Promise<string> {
    return this.git.version.bind(this.git);
  }

  /**
   * Execute a raw git command (repository-agnostic)
   */
  public get raw(): (argv: Array<string>, opts?: ExecOpts) => Promise<RawResult> {
    return this.git.raw.bind(this.git);
  }

  /**
   * Global config operations
   *
   * Operates on ~/.gitconfig (user-level configuration).
   * For repository-level config, use repo.config instead.
   */
  public get config(): GlobalConfigOperations {
    return this.git.config;
  }

  /**
   * Global LFS operations
   *
   * Operates on ~/.gitconfig (user-level) or /etc/gitconfig (system-level).
   * For repository-level LFS operations, use repo.lfs instead.
   *
   * @example
   * ```typescript
   * // Install LFS globally
   * await git.lfs.install();
   *
   * // Install system-wide
   * await git.lfs.install({ system: true });
   *
   * // Get LFS version
   * const version = await git.lfs.version();
   * ```
   */
  public get lfs(): GlobalLfsOperations {
    return this.git.lfs;
  }
}

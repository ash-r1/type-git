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
/** Runtime-independent convenience client. Runtime entrypoints supply the adapters. */
export class GitClient implements Git {
  public constructor(private readonly git: Git) {}
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
  public clone(
    url: string,
    path: string,
    opts?: CloneOpts & { bare?: false; mirror?: false } & ExecOpts,
  ): Promise<WorktreeRepo>;
  public clone(
    url: string,
    path: string,
    opts?: CloneOpts & ExecOpts,
  ): Promise<WorktreeRepo | BareRepo>;
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
  public init(path: string, opts?: InitOpts & { bare?: false } & ExecOpts): Promise<WorktreeRepo>;
  public init(path: string, opts?: InitOpts & ExecOpts): Promise<WorktreeRepo | BareRepo>;
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
  public get raw(): (argv: string[], opts?: ExecOpts) => Promise<RawResult> {
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

/**
 * Node.js adapter exports
 */

import type { RuntimeAdapters } from '../../core/adapters.js';
import type { CloneOpts, Git, InitOpts, LsRemoteOpts, LsRemoteResult } from '../../core/git.js';
import type { BareRepo, WorktreeRepo } from '../../core/repo.js';
import type { ExecOpts, GitOpenOptions, RawResult } from '../../core/types.js';
import { type CreateGitOptions, createGit } from '../../impl/git-impl.js';
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
 * const git = new TypeGit();
 * const repo = await git.open('/path/to/repo');
 * ```
 */
export class TypeGit {
  private readonly git: Git;

  public constructor(options?: TypeGitOptions) {
    this.git = createGit({
      ...options,
      adapters: createNodeAdapters(),
    });
  }

  /**
   * Open an existing repository
   */
  public get open(): (path: string, opts?: GitOpenOptions) => Promise<WorktreeRepo | BareRepo> {
    return this.git.open.bind(this.git);
  }

  /**
   * Clone a repository
   */
  public get clone(): (
    url: string,
    path: string,
    opts?: CloneOpts & ExecOpts,
  ) => Promise<WorktreeRepo | BareRepo> {
    return this.git.clone.bind(this.git);
  }

  /**
   * Initialize a new repository
   */
  public get init(): (
    path: string,
    opts?: InitOpts & ExecOpts,
  ) => Promise<WorktreeRepo | BareRepo> {
    return this.git.init.bind(this.git);
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
}

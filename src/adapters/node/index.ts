/**
 * Node.js adapter exports
 */

import type { RuntimeAdapters } from '../../core/adapters.js';
import type { Git } from '../../core/git.js';
import { createGit, type CreateGitOptions } from '../../impl/git-impl.js';
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

  constructor(options?: TypeGitOptions) {
    this.git = createGit({
      ...options,
      adapters: createNodeAdapters(),
    });
  }

  /**
   * Open an existing repository
   */
  get open() {
    return this.git.open.bind(this.git);
  }

  /**
   * Clone a repository
   */
  get clone() {
    return this.git.clone.bind(this.git);
  }

  /**
   * Initialize a new repository
   */
  get init() {
    return this.git.init.bind(this.git);
  }

  /**
   * List references in a remote repository
   */
  get lsRemote() {
    return this.git.lsRemote.bind(this.git);
  }

  /**
   * Get git version
   */
  get version() {
    return this.git.version.bind(this.git);
  }

  /**
   * Execute a raw git command (repository-agnostic)
   */
  get raw() {
    return this.git.raw.bind(this.git);
  }
}

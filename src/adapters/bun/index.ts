/**
 * Bun adapter exports
 */

import type { RuntimeAdapters } from '../../core/adapters.js';
import type { Git } from '../../core/git.js';
import { createGit, type CreateGitOptions } from '../../impl/git-impl.js';
import { BunExecAdapter } from './exec.js';
import { BunFsAdapter } from './fs.js';

export { BunExecAdapter } from './exec.js';
export { BunFsAdapter } from './fs.js';

/**
 * Create Bun runtime adapters
 */
export function createBunAdapters(): RuntimeAdapters {
  return {
    exec: new BunExecAdapter(),
    fs: new BunFsAdapter(),
  };
}

/**
 * Options for creating a TypeGit instance (Bun)
 * Excludes adapters as they are automatically configured
 */
export type TypeGitOptions = Omit<CreateGitOptions, 'adapters'>;

/**
 * Pre-configured Git client for Bun
 *
 * This is a convenience class that automatically configures Bun adapters.
 *
 * @example
 * ```typescript
 * import { TypeGit } from 'type-git/bun';
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
      adapters: createBunAdapters(),
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

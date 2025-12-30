/**
 * Deno adapter exports
 */

import type { RuntimeAdapters } from '../../core/adapters.js';
import type { Git } from '../../core/git.js';
import { createGit, type CreateGitOptions } from '../../impl/git-impl.js';
import { DenoExecAdapter } from './exec.js';
import { DenoFsAdapter } from './fs.js';

export { DenoExecAdapter } from './exec.js';
export { DenoFsAdapter } from './fs.js';

/**
 * Create Deno runtime adapters
 */
export function createDenoAdapters(): RuntimeAdapters {
  return {
    exec: new DenoExecAdapter(),
    fs: new DenoFsAdapter(),
  };
}

/**
 * Options for creating a TypeGit instance (Deno)
 * Excludes adapters as they are automatically configured
 */
export type TypeGitOptions = Omit<CreateGitOptions, 'adapters'>;

/**
 * Pre-configured Git client for Deno
 *
 * This is a convenience class that automatically configures Deno adapters.
 *
 * @example
 * ```typescript
 * import { TypeGit } from 'type-git/deno';
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
      adapters: createDenoAdapters(),
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

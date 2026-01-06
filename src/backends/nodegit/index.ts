/**
 * nodegit Backend Entry Point
 *
 * Native libgit2 bindings for Node.js providing high performance Git operations.
 *
 * @example
 * ```typescript
 * import { createNodeGitBackend } from 'type-git/backends/nodegit';
 * import { createGit } from 'type-git';
 *
 * const backend = createNodeGitBackend();
 * const git = createGit({ backend });
 * const repo = await git.open('/path/to/repo');
 * ```
 */

export type { NodeGitBackendOptions } from '../../core/backend.js';
export { NodeGitBackend } from './backend.js';

import type { GitBackend, NodeGitBackendOptions } from '../../core/backend.js';
import { NodeGitBackend } from './backend.js';

/**
 * Create a nodegit backend instance
 *
 * @param options - Backend options for credentials and certificate handling
 * @returns GitBackend instance
 *
 * @example
 * ```typescript
 * // Basic usage
 * const backend = createNodeGitBackend();
 *
 * // With custom credentials
 * const backend = createNodeGitBackend({
 *   credentials: (url, username) => {
 *     return nodegit.Cred.userpassPlaintextNew(
 *       process.env.GIT_USER,
 *       process.env.GIT_TOKEN
 *     );
 *   }
 * });
 * ```
 */
export function createNodeGitBackend(options?: NodeGitBackendOptions): GitBackend {
  return new NodeGitBackend(options);
}

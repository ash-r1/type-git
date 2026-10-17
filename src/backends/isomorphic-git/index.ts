/**
 * isomorphic-git Backend Entry Point
 *
 * Pure JavaScript Git implementation that works in Node.js, Deno, Bun, and browsers.
 *
 * @example
 * ```typescript
 * import { createIsomorphicGitBackend } from 'type-git/backends/isomorphic-git';
 * import { createGit } from 'type-git';
 * import fs from 'fs';
 *
 * const backend = createIsomorphicGitBackend({ fs });
 * const git = createGit({ backend });
 * const repo = await git.open('/path/to/repo');
 * ```
 */

export type { IsomorphicGitBackendOptions } from '../../core/backend.js';
export { IsomorphicGitBackend } from './backend.js';

import type { GitBackend, IsomorphicGitBackendOptions } from '../../core/backend.js';
import { IsomorphicGitBackend } from './backend.js';

/**
 * Create an isomorphic-git backend instance
 *
 * @param options - Backend options including fs implementation
 * @returns GitBackend instance
 *
 * @example
 * ```typescript
 * // Node.js
 * import fs from 'fs';
 * const backend = createIsomorphicGitBackend({ fs });
 *
 * // Browser with lightning-fs
 * import LightningFS from '@isomorphic-git/lightning-fs';
 * const fs = new LightningFS('my-app');
 * const backend = createIsomorphicGitBackend({ fs });
 * ```
 */
export function createIsomorphicGitBackend(options: IsomorphicGitBackendOptions): GitBackend {
  return new IsomorphicGitBackend(options);
}

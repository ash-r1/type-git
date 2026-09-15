/**
 * wasm-git Backend Entry Point
 *
 * WebAssembly-based libgit2 implementation for cross-platform compatibility.
 *
 * @example
 * ```typescript
 * import { createWasmGitBackend } from 'type-git/backends/wasm-git';
 * import { createGit } from 'type-git';
 *
 * const backend = await createWasmGitBackend();
 * const git = createGit({ backend });
 * const repo = await git.open('/path/to/repo');
 * ```
 */

export type { WasmGitBackendOptions } from '../../core/backend.js';
export { WasmGitBackend } from './backend.js';

import type { GitBackend, WasmGitBackendOptions } from '../../core/backend.js';
import { WasmGitBackend } from './backend.js';

/**
 * Create a wasm-git backend instance
 *
 * @param options - Backend options
 * @returns GitBackend instance
 *
 * @example
 * ```typescript
 * // Basic usage
 * const backend = createWasmGitBackend();
 *
 * // With custom WASM path
 * const backend = createWasmGitBackend({
 *   wasmPath: '/path/to/lg2.wasm'
 * });
 * ```
 */
export function createWasmGitBackend(options?: WasmGitBackendOptions): GitBackend {
  return new WasmGitBackend(options);
}

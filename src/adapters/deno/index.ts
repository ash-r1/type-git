/**
 * Deno adapter exports
 */

import type { RuntimeAdapters } from '../../core/adapters.js';
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

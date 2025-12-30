/**
 * Bun adapter exports
 */

import type { RuntimeAdapters } from '../../core/adapters.js';
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

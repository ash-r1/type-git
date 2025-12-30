/**
 * Node.js adapter exports
 */

import type { RuntimeAdapters } from '../../core/adapters.js';
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

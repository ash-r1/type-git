import type { GitCommandClient } from '../../src/commands/types.js';
declare const git: GitCommandClient;

// Actual Git 2.25/2.47 accepts these decimal values before -h. Unknown native
// parser families must retain that valid possibility rather than impose 2.55.
git.command('column', [['--width', 2147483648], ['-h']]);
git.command('column', [['--width', '4294967297'], ['-h']]);

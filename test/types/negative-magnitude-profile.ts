import type { GitCommandClient } from '../../src/commands/types.js';
declare const git: GitCommandClient;

// Git 2.25's unsigned strtoumax magnitude parser accepts negative zero.
// Unknown selected Git profiles must preserve this actual valid possibility.
git.command('pack-objects', [['--max-pack-size', '-0'], ['-h']]);
git.command('clone', [['--filter', 'blob:limit=-0'], ['-h']]);

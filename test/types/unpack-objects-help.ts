import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('unpack-objects', [['--help-all']]);
// @ts-expect-error Full usage tuples must be sole words.
git.command('unpack-objects', [['--help-all'], { operand: 'ignored' }]);
// @ts-expect-error Full usage does not bypass ordinary options in a multiword call.
git.command('unpack-objects', [['-n'], ['--help-all']]);
// @ts-expect-error Flag values remain invalid.
git.command('unpack-objects', [['--help-all', true]]);

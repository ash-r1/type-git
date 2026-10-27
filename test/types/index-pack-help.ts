import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('index-pack', [['--help-all']]);
// @ts-expect-error Full usage tuples must be sole words.
git.command('index-pack', [['--help-all'], { operand: 'ignored' }]);
// @ts-expect-error Full usage does not bypass ordinary options in a multiword call.
git.command('index-pack', [['--verify'], ['--help-all']]);
// @ts-expect-error Flag values remain invalid.
git.command('index-pack', [['--help-all', true]]);

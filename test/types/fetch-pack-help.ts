import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('fetch-pack', [['--help-all']]);
// @ts-expect-error Full usage tuples must be sole words.
git.command('fetch-pack', [['--help-all'], { operand: 'ignored' }]);
// @ts-expect-error Full usage does not bypass ordinary options in a multiword call.
git.command('fetch-pack', [['--quiet'], ['--help-all']]);
// @ts-expect-error Flag values remain invalid.
git.command('fetch-pack', [['--help-all', true]]);

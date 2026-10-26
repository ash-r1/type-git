import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('pack-redundant', [['--help-all']]);
// @ts-expect-error Full usage tuples must be sole words.
git.command('pack-redundant', [['--help-all'], { operand: 'ignored' }]);
// @ts-expect-error Full usage does not bypass ordinary options in a multiword call.
git.command('pack-redundant', [['--all'], ['--help-all']]);
// @ts-expect-error Flag values remain invalid.
git.command('pack-redundant', [['--help-all', true]]);

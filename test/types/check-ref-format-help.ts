import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('check-ref-format', [['--help-all']]);
// @ts-expect-error Full usage tuples must be sole words.
git.command('check-ref-format', [['--help-all'], { operand: 'ignored' }]);
// @ts-expect-error Full usage does not bypass ordinary options in a multiword call.
git.command('check-ref-format', [['--normalize'], ['--help-all']]);
// @ts-expect-error Flag values remain invalid.
git.command('check-ref-format', [['--help-all', true]]);

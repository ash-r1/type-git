import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('mailsplit', [['--help-all']]);
// @ts-expect-error Full usage tuples must be sole words.
git.command('mailsplit', [['--help-all'], { operand: 'ignored' }]);
// @ts-expect-error Full usage does not bypass ordinary options in a multiword call.
git.command('mailsplit', [['-b'], ['--help-all']]);
// @ts-expect-error Flag values remain invalid.
git.command('mailsplit', [['--help-all', true]]);

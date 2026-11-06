import type { StrictGit } from '../../src/strict/index.js';
declare const git: StrictGit;
git.command('mailsplit', [['--help-all']]);
// @ts-expect-error Full usage tuples must be sole words.
git.command('mailsplit', [['--help-all'], { operand: 'ignored' }]);
// @ts-expect-error Full usage does not bypass ordinary options in a multiword call.
git.command('mailsplit', [['-b'], ['--help-all']]);
// @ts-expect-error Flag values remain invalid.
git.command('mailsplit', [['--help-all', true]]);

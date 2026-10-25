import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('mailinfo', [['--help-all']]);
git.command('mailinfo', [['--git-completion-helper']]);
git.command('mailinfo', [['--git-completion-helper-all']]);
git.command('mailinfo', [['--message-id'], ['--help']]);
git.command('mailinfo', [['--quoted-cr', 'warn'], ['--help-all']]);
git.command('mailinfo', [['--help-all'], ['--quoted-cr', 'invalid-action']]);
git.command('mailinfo', [['--encoding', '--help-all'], ['--help-all']]);
git.command('mailinfo', [['--help-all'], ['--git-completion-helper']]);
// @ts-expect-error A reached invalid callback fails before later help.
git.command('mailinfo', [['--quoted-cr', 'invalid-action'], ['--help-all']]);
// @ts-expect-error A consumed encoding value alone does not bypass final arity.
git.command('mailinfo', [['--encoding', '--help-all']]);
// @ts-expect-error A multiword completion helper fails before later help.
git.command('mailinfo', [['--git-completion-helper'], ['--help-all']]);
// @ts-expect-error A literal after the end marker still needs two output paths.
git.command('mailinfo', [['--'], { operand: '--help-all' }]);
// @ts-expect-error Option tuples cannot follow the end marker.
git.command('mailinfo', [['--'], ['--help-all']]);
// @ts-expect-error Flag shape survives help.
git.command('mailinfo', [['--help-all'], ['--message-id', true]]);
// @ts-expect-error NUL is never an argv byte.
git.command('mailinfo', [['--help-all'], { operand: '\0' }]);
declare const mailinfoMaybeHelp: '--help-all' | '--git-completion-helper';
// @ts-expect-error A failed completion arm must remain in the whole union check.
git.command('mailinfo', [[mailinfoMaybeHelp], ['--help-all']]);

import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('cherry', [['--help-all']]);
git.command('cherry', [['--git-completion-helper']]);
git.command('cherry', [['--git-completion-helper-all']]);
git.command('cherry', [['--verbose'], ['--help']]);
git.command('cherry', [['--abbrev', '-1'], ['--help-all']]);
git.command('cherry', [['--help-all'], ['--abbrev', 'bad']]);
git.command('cherry', [['--help-all'], ['--git-completion-helper']]);
git.command('cherry', [['--'], { operand: '--help-all' }]);
// @ts-expect-error The reached malformed callback fails before later help.
git.command('cherry', [['--abbrev', 'bad'], ['--help-all']]);
// @ts-expect-error A consumed help-looking value is not a parser exit.
git.command('cherry', [['--abbrev', '--help-all']]);
// @ts-expect-error A multiword completion helper fails before later help.
git.command('cherry', [['--git-completion-helper'], ['--help-all']]);
// @ts-expect-error Option tuples cannot follow the end-of-options marker.
git.command('cherry', [['--'], ['--help-all']]);
// @ts-expect-error Shape constraints survive an earlier help exit.
git.command('cherry', [['--help-all'], ['--verbose', true]]);
// @ts-expect-error NUL is never a valid argv byte.
git.command('cherry', [['--help-all'], { operand: '\0' }]);
declare const cherryMaybeHelp: '--help-all' | '--git-completion-helper';
// @ts-expect-error The reached helper branch fails even though the help branch exits.
git.command('cherry', [[cherryMaybeHelp], ['--help-all']]);

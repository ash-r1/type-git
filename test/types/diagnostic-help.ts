import type { Git } from '../../src/index.js';
declare const git: Git;

git.command('bugreport', [['-h'], ['--diagnose', 'invalid']]);
git.command('diagnose', [['-h'], ['--mode', 'invalid']]);
git.command('bugreport', [['--help-all'], ['--diagnose', 'invalid']]);
git.command('diagnose', [['--help-all'], ['--mode', 'invalid']]);
git.command('bugreport', [['--help-all'], ['--type-git-ignored-tail']]);
git.command('diagnose', [['--help-all'], ['--type-git-ignored-tail']]);
git.command('bugreport', [['--git-completion-helper']]);
git.command('diagnose', [['--git-completion-helper-all']]);
// @ts-expect-error A reached callback fails before later help.
git.command('bugreport', [['--diagnose', 'invalid'], ['-h']]);
// @ts-expect-error A reached callback fails before later help.
git.command('diagnose', [['--mode', 'invalid'], ['--help-all']]);
// @ts-expect-error Repeated valid values cannot repair an earlier callback error.
git.command('diagnose', [['--mode', 'invalid'], ['--mode', 'stats'], ['-h']]);
// @ts-expect-error A multiword completion helper is an unknown option before help.
git.command('bugreport', [['--git-completion-helper'], ['-h']]);
// @ts-expect-error A multiword completion helper is an unknown option before help.
git.command('diagnose', [['--git-completion-helper-all'], ['-h']]);
// @ts-expect-error A preceding unknown option cannot be hidden by later help.
git.command('bugreport', [['--type-git-unknown-prefix'], ['-h']]);
// @ts-expect-error Help never bypasses argv NUL boundaries.
git.command('diagnose', [['-h'], ['--mode', '\0']]);
// @ts-expect-error A missing declared value remains an invalid public tuple shape.
git.command('diagnose', [['-h'], ['--mode']]);

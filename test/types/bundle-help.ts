import type { Git } from '../../src/index.js';
declare const git: Git;

git.command('bundle create', [['-h'], ['--version', 'invalid']]);
git.command('bundle verify', [['-h'], ['--type-git-ignored-tail']]);
git.command('bundle list-heads', [['--help-all'], ['--type-git-ignored-tail']]);
git.command('bundle unbundle', [['--help'], ['--type-git-ignored-tail']]);
git.command('bundle create', [['--git-completion-helper']]);
git.command('bundle verify', [['--git-completion-helper-all']]);
git.command('bundle list-heads', [['--git-completion-helper']]);
git.command('bundle unbundle', [['--git-completion-helper-all']]);
git.command('bundle create', [['--version', 4], ['--help-all']]);
git.command('bundle create', [{ operand: 'missing.bundle' }, { operand: '-h' }]);
// @ts-expect-error A callback reached before help remains invalid.
git.command('bundle create', [['--version', 'invalid'], ['-h']]);
// @ts-expect-error A valid later value cannot repair an earlier invalid callback.
git.command('bundle create', [['--version', 'invalid'], ['--version', 3], ['-h']]);
// @ts-expect-error The first file operand ends option parsing before help.
git.command('bundle create', [{ operand: 'missing.bundle' }, ['-h'], ['--version', 'invalid']]);
// @ts-expect-error Unknown options before help are still reached.
git.command('bundle verify', [['--type-git-unknown-prefix'], ['-h']]);
// @ts-expect-error Completion is recognized only as a sole parser word.
git.command('bundle list-heads', [['--git-completion-helper'], ['-h']]);
// @ts-expect-error A separator ends parsing before later help.
git.command('bundle unbundle', [['--'], ['-h'], ['--type-git-tail']]);
// @ts-expect-error Ignored tails still require well-formed declared option tuples.
git.command('bundle create', [['-h'], ['--version']]);
// @ts-expect-error Usage exits do not bypass argv NUL boundaries.
git.command('bundle verify', [['-h'], ['--type-git-tail', '\0']]);

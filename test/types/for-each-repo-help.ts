import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('for-each-repo', [['--help-all']]);
git.command('for-each-repo', [['--git-completion-helper']]);
git.command('for-each-repo', [['--git-completion-helper-all']]);
git.command('for-each-repo', [['--keep-going'], ['--help']]);
git.command('for-each-repo', [['--config', '--help-all']]);
git.command('for-each-repo', [['--config', '--help-all'], ['--help-all']]);
git.command('for-each-repo', [['--help-all'], ['--git-completion-helper']]);
git.command('for-each-repo', [['--config', 'typegit.missing'], { operand: 'unused' }, { operand: '--help-all' }]);
// @ts-expect-error Option tuples cannot resume after the first operand.
git.command('for-each-repo', [['--config', 'typegit.missing'], { operand: 'unused' }, ['--help-all']]);
// @ts-expect-error A reached multiword completion helper fails before help.
git.command('for-each-repo', [['--git-completion-helper'], ['--help-all']]);
// @ts-expect-error End markers preserve literal operand representation.
git.command('for-each-repo', [['--config', 'typegit.missing'], ['--'], ['--help-all']]);
// @ts-expect-error Flag shape survives help.
git.command('for-each-repo', [['--help-all'], ['--keep-going', true]]);
// @ts-expect-error NUL is never an argv byte.
git.command('for-each-repo', [['--help-all'], { operand: '\0' }]);
declare const forEachRepoMaybeHelp: '--help-all' | '--git-completion-helper';
// @ts-expect-error A failed completion arm must remain in the whole union check.
git.command('for-each-repo', [[forEachRepoMaybeHelp], ['--help-all']]);

import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('commit-tree', [['--help-all']]);
git.command('commit-tree', [['--git-completion-helper']]);
git.command('commit-tree', [['--git-completion-helper-all']]);
git.command('commit-tree', [['-m', 'message'], ['--help']]);
git.command('commit-tree', [['-p', 'missing'], ['--help-all']]);
git.command('commit-tree', [['--help-all'], ['-F', 'missing']]);
git.command('commit-tree', [['--help-all'], ['--git-completion-helper']]);
git.command('commit-tree', [['--'], { operand: '--help-all' }]);
// @ts-expect-error A required message value is not help and still needs a tree.
git.command('commit-tree', [['-m', '--help-all']]);
// @ts-expect-error A reached multiword completion helper fails before help.
git.command('commit-tree', [['--git-completion-helper'], ['--help-all']]);
// @ts-expect-error Options cannot resume after the end marker.
git.command('commit-tree', [['--'], ['--help-all']]);
// @ts-expect-error Flag shape survives help.
git.command('commit-tree', [['--help-all'], ['--help-all', true]]);
// @ts-expect-error NUL is never an argv byte.
git.command('commit-tree', [['--help-all'], { operand: '\0' }]);
declare const commitTreeMaybeHelp: '--help-all' | '--git-completion-helper';
// @ts-expect-error The failed completion branch cannot disappear from the union.
git.command('commit-tree', [[commitTreeMaybeHelp], ['--help-all']]);

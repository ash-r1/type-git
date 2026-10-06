import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('gui', []);
git.command('gui', [{ operand: 'citool' }, ['--amend'], ['--nocommit'], ['--commitmsg']]);
git.command('citool', [['--amend']]);
// @ts-expect-error No positional words remain in the commit UI.
git.command('citool', [{ operand: 'extra' }]);
git.command('gui browser', [{ operand: 'HEAD' }, ['--'], { operand: 'src' }]);
// @ts-expect-error The separator must immediately precede the required path.
git.command('gui browser', [['--'], { operand: 'HEAD' }, { operand: 'src' }]);
git.command('gui blame', [['--line', 2], { operand: 'HEAD' }, ['--'], { operand: 'file' }]);
// @ts-expect-error The line selector must be first after the global trace selector is removed.
git.command('gui blame', [{ operand: 'HEAD' }, ['--line', 2], { operand: 'file' }]);
// @ts-expect-error A line selector still needs a path.
git.command('gui blame', [['--line', 2]]);
git.command('gui blame', [{ operand: '--line=2' }]);

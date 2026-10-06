import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('p4', [{ operand: 'submit' }, ['--conflict', 'ask'], ['--update-shelve', 1]]);
git.command('p4 commit', [['--conflict', 'skip']]);
// @ts-expect-error Choice validation precedes help.
git.command('p4 submit', [['--conflict', 'invalid'], ['--help']]);
// @ts-expect-error Submit takes at most one branch.
git.command('p4 submit', [{ operand: 'one' }, { operand: 'two' }]);
// @ts-expect-error Unshelve needs one changelist.
git.command('p4 unshelve', []);
git.command('p4 unshelve', [{ operand: '123' }]);
// @ts-expect-error Clone needs at least one depot path.
git.command('p4 clone', []);
// @ts-expect-error A positional destination does not satisfy keep-path.
git.command('p4 clone', [['--keep-path'], { operand: '//depot' }, { operand: 'target' }]);
git.command('p4 clone', [['--keep-path'], ['--destination', 'target'], { operand: '//depot' }]);
git.command('p4 clone', [['--changes-block-size', -2], ['--max-changes', 'text'], ['--help']]);
git.command('p4 branches', [{ operand: 'ignored' }]);
git.command('p4 rebase', [{ operand: 'ignored' }]);
git.command('p4 sync', [['--branch', 'refs/remotes/p4/main']]);

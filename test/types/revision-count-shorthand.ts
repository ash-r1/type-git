import type { Git } from '../../src/index.js';
declare const git: Git;

git.command('log', [['-3'], { operand: 'HEAD' }]);
git.command('show', [['-3'], { operand: 'HEAD' }]);
git.command('rev-list', [['-3'], { operand: 'HEAD' }]);
git.command('whatchanged', [['-3'], ['--i-still-use-this'], { operand: 'HEAD' }]);
git.command('shortlog', [['-3'], { operand: 'HEAD' }]);
git.command('reflog', [['-3'], { operand: 'HEAD' }]);
git.command('reflog show', [['-3'], { operand: 'HEAD' }]);
git.command('format-patch', [['-3'], ['--stdout'], { operand: 'HEAD' }]);
git.command('diff', [['-3']]);
git.command('diff-files', [['-3']]);
git.command('diff-tree', [['-3'], { operand: 'HEAD' }]);
git.command('blame', [['-3'], { operand: 'HEAD' }, ['--'], { operand: 'file' }]);
git.command('annotate', [['-3'], { operand: 'HEAD' }, ['--'], { operand: 'file' }]);
git.command('fast-export', [['-3'], { operand: 'HEAD' }]);
git.command('stash show', [['-3']]);
git.command('last-modified', [['-3'], { operand: 'HEAD' }, ['--'], { operand: 'file' }]);
git.command('pickaxe', [['-3'], { operand: 'HEAD' }, ['--'], { operand: 'file' }]);

// Shorthand is checked decimal on every selected Git, including legacy atoi families.
git.command('log', [['-0'], { operand: 'HEAD' }]);
git.command('log', [['-01'], { operand: 'HEAD' }]);
git.command('log', [['-2147483647'], { operand: 'HEAD' }]);
// @ts-expect-error Invalid count shorthand or signed-int overflow.
git.command('log', [['-2147483648'], { operand: 'HEAD' }]);
// @ts-expect-error Invalid count shorthand or signed-int overflow.
git.command('log', [['-999999999999999999999'], { operand: 'HEAD' }]);
// @ts-expect-error Invalid count shorthand or signed-int overflow.
git.command('log', [['-3.5'], { operand: 'HEAD' }]);
// @ts-expect-error Invalid count shorthand or signed-int overflow.
git.command('log', [['-1e2'], { operand: 'HEAD' }]);
// @ts-expect-error Invalid count shorthand or signed-int overflow.
git.command('log', [['-0x10'], { operand: 'HEAD' }]);
// @ts-expect-error Invalid count shorthand or signed-int overflow.
git.command('log', [['-1x'], { operand: 'HEAD' }]);
// @ts-expect-error Shorthand has no separate value word.
git.command('log', [['-3', '4'], { operand: 'HEAD' }]);

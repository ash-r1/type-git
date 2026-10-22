import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('diff-index', [{ operand: 'HEAD' }]);
git.command('diff-index', [['--max-count', '-1'], { operand: 'HEAD' }]);
git.command('diff-index', [['--max-count', '1'], ['--max-count', '-1'], { operand: 'HEAD' }]);
git.command('diff-index', [['-n', '0'], ['--max-count', '-1'], { operand: 'HEAD' }]);
// Legacy atoi can wrap this to the default sentinel; actual Git owns its parser profile.
git.command('diff-index', [['--max-count', '4294967295'], { operand: 'HEAD' }]);
git.command('diff-index', [['-h'], ['--max-count', '1'], { operand: 'HEAD' }]);
git.command('diff-index', [['--max-count', '1'], ['-h'], { operand: 'HEAD' }]);
// @ts-expect-error A final zero is a revision filtering parameter.
git.command('diff-index', [['--max-count', '0'], { operand: 'HEAD' }]);
// @ts-expect-error A final positive count is a revision filtering parameter.
git.command('diff-index', [['--max-count', '1'], { operand: 'HEAD' }]);
// @ts-expect-error Negative values other than the default sentinel are rejected too.
git.command('diff-index', [['--max-count', '-2'], { operand: 'HEAD' }]);
// @ts-expect-error A later short count replaces the earlier default sentinel.
git.command('diff-index', [['--max-count', '-1'], ['-n', '1'], { operand: 'HEAD' }]);
declare const uncertainCount: '-1' | '1';
// @ts-expect-error A known input union includes a final non-sentinel alternative.
git.command('diff-index', [['--max-count', uncertainCount], { operand: 'HEAD' }]);

import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('describe', [['--abbrev', '+010'], ['--long']]);
git.command('describe', [['--abbrev', '2147483648'], ['--long']]);
git.command('describe', [['--abbrev'], ['--long']]);
git.command('cherry-pick', [['--mainline', '-4294967295'], { operand: 'HEAD' }]);
git.command('grep', [['-9223372036854775808'], { operand: 'needle' }]);
git.command('diff-files', [['-U', '']]);
git.command('diff-files', [['--unified', '4294967295'], ['-U']]);
git.command('rev-list', [['--max-count', '+001'], ['--all']]);
// @ts-expect-error Cast-to-int produces zero, which conflicts with --long.
git.command('describe', [['--abbrev', '4294967296'], ['--long']]);
// @ts-expect-error Negative long overflow saturates, then narrows to zero.
git.command('describe', [['--abbrev', '-9223372036854775809'], ['--long']]);
// @ts-expect-error Mainline positivity is checked after narrowing.
git.command('cherry-pick', [['--mainline', '2147483648'], ['-h']]);
// @ts-expect-error Decimal callbacks do not accept k/m/g suffixes.
git.command('rev-list', [['--max-count', '1k'], ['--all']]);
// @ts-expect-error Tab width rejects negatives in addition to checked 32-bit bounds.
git.command('log', [['--expand-tabs', '-1']]);
// @ts-expect-error Diff rejects the negative long before converting to unsigned context.
git.command('diff-files', [['-U', '-4294967295']]);
// @ts-expect-error Checked revision counts reject overflow instead of narrowing.
git.command('rev-list', [['--max-count', 2147483648], ['--all']]);
// @ts-expect-error Explicit booleans cannot supply a numeric callback argument.
git.command('describe', [['--abbrev', true]]);

declare const dynamicCount: number;
declare const dynamicBigCount: bigint;
git.command('grep', [[`-${dynamicCount}`], { operand: 'needle' }]);
git.command('grep', [[`-${dynamicBigCount}`], { operand: 'needle' }]);

git.command('apply', [['-p', '+001'], ['-h']]);
// @ts-expect-error Strip count is checked before later options, including help.
git.command('apply', [['-p', '-1'], ['-h']]);

import type { Git } from '../../src/index.js';
import type { CheckedCommandArguments } from '../../src/commands/types.js';
declare const git: Git;
git.command('diff-index', [{ operand: 'HEAD' }]);
git.command('diff-index', [['--min-age', '-1'], ['--max-age', '18446744073709551615'], { operand: 'HEAD' }]);
git.command('diff-index', [['--min-age', '1'], ['--min-age', '-1'], { operand: 'HEAD' }]);
git.command('diff-index', [['--since', '1970-01-01 00:00:01 +0000'], ['--max-age', '-1'], { operand: 'HEAD' }]);
git.command('diff-index', [['--before', '1970-01-01 00:00:01 +0000'], ['--min-age', '-1'], { operand: 'HEAD' }]);
// Approxidate strings are native-owned, including native nonzero results.
git.command('diff-index', [['--max-age', '1'], ['--after', 'yesterday'], { operand: 'HEAD' }]);
git.command('diff-index', [['--since-as-filter', 'yesterday'], { operand: 'HEAD' }]);
// Legacy atoi on LP64 can turn these into the timestamp sentinel.
git.command('diff-index', [['--max-age', '4294967295'], { operand: 'HEAD' }]);
git.command('diff-index', [['--max-age', '18446744073709551616'], { operand: 'HEAD' }]);
// @ts-expect-error A final numeric age1 is a revision filtering parameter on every Git profile.
git.command('diff-index', [['--max-age', '1'], { operand: 'HEAD' }]);
// @ts-expect-error Final numeric min-age0 is not the default sentinel.
git.command('diff-index', [['--min-age', '0'], { operand: 'HEAD' }]);
// @ts-expect-error A later non-sentinel value replaces the earlier sentinel.
git.command('diff-index', [['--min-age', '-1'], ['--min-age', '1'], { operand: 'HEAD' }]);
declare const uncertain: '-1' | '1';
// @ts-expect-error Every known numeric alternative must satisfy the final state rule.
git.command('diff-index', [['--max-age', uncertain], { operand: 'HEAD' }]);
git.command('diff-index', [['--max-age', '1'], ['-h'], { operand: 'HEAD' }]);
type Check<T extends true> = T;
type Accepted<A extends readonly unknown[], F extends 'modern' | 'legacy'> = [CheckedCommandArguments<'diff-index', A, {decimalCallbacks:{'revision-age':F};firstPassEmpty:true}>] extends [never] ? false : true;
export type FinalAgeChecks = readonly [
  Check<Accepted<readonly [readonly ['--max-age','4294967295'],{readonly operand:'HEAD'}], 'modern'> extends false ? true : false>,
  Check<Accepted<readonly [readonly ['--max-age','4294967295'],{readonly operand:'HEAD'}], 'legacy'>>,
  Check<Accepted<readonly [readonly ['--max-age','18446744073709551616'],readonly ['--max-age','-1'],{readonly operand:'HEAD'}], 'modern'> extends false ? true : false>,
];

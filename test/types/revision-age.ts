import type { Git } from '../../src/index.js';
import type { CheckedCommandArguments } from '../../src/commands/types.js';
declare const git: Git;
// Unpinned clients preserve valid old-family atoi inputs; selected runtime Git owns validation.
git.command('log', [['--max-age', '1x'], { operand: 'HEAD' }]);
git.command('log', [['--min-age', '18446744073709551616'], { operand: 'HEAD' }]);
git.command('log', [['--min-age', '-18446744073709551615'], { operand: 'HEAD' }]);
git.command('log', [['--max-age', '18446744073709551615'], { operand: 'HEAD' }]);
// @ts-expect-error NUL is invalid on every executable family.
git.command('log', [['--max-age', '1\0'], { operand: 'HEAD' }]);
type Check<T extends true> = T;
type Accepted<C extends 'log' | 'rev-list', A extends readonly unknown[], F extends 'modern' | 'legacy'> = [CheckedCommandArguments<C, A, {decimalCallbacks:{'revision-age':F};firstPassEmpty:true}>] extends [never] ? false : true;
export type RevisionAgeChecks = readonly [
  Check<Accepted<'log', readonly [readonly ['--max-age', '1x'], {readonly operand:'HEAD'}], 'modern'> extends false ? true : false>,
  Check<Accepted<'log', readonly [readonly ['--max-age', '1x'], {readonly operand:'HEAD'}], 'legacy'>>,
  Check<Accepted<'log', readonly [readonly ['--min-age', '18446744073709551616'], {readonly operand:'HEAD'}], 'modern'> extends false ? true : false>,
  Check<Accepted<'log', readonly [readonly ['--min-age', '-18446744073709551615'], {readonly operand:'HEAD'}], 'modern'>>,
  Check<Accepted<'log', readonly [readonly ['--max-age', '1' | '1x'], {readonly operand:'HEAD'}], 'modern'> extends false ? true : false>,
  Check<Accepted<'log', readonly [readonly ['--max-age', 'invalid'], readonly ['-h']], 'modern'>>,
  Check<Accepted<'rev-list', readonly [readonly ['--max-age', 'invalid'], readonly ['-h']], 'modern'> extends false ? true : false>,
];

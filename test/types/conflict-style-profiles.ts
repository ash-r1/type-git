import type { CheckedCommandArguments, GitCommandArgument, GitCommandName } from '../../src/commands/types.js';
type Check<T extends true> = T;
type Accepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[], P extends 'immediate' | 'deferred' | undefined = undefined> =
  [CheckedCommandArguments<C, A, P extends undefined ? {} : { conflictStyle: P }>] extends [never] ? false : true;
export type ConflictStyleProfileCases = readonly [
  Check<Accepted<'branch', [['-h']], 'deferred'>>,
  Check<Accepted<'switch', [['--help'], ['--conflict', 'bad']]> extends false ? true : false>,
  Check<Accepted<'switch', [['--help'], ['--conflict', 'merge']]> extends false ? true : false>,
  Check<Accepted<'switch', [['--help'], ['-h'], ['--conflict', 'bad']]>>,
  Check<Accepted<'switch', [['--conflict', 'bad'], ['-h']]>>,
  Check<Accepted<'switch', [['--conflict', 'bad'], ['-h']], 'immediate'> extends false ? true : false>,
  Check<Accepted<'switch', [['--conflict', 'bad'], ['-h']], 'deferred'>>,
  Check<Accepted<'checkout', [['--conflict', 'bad'], ['--unified', '-1'], ['-h']]>>,
  Check<Accepted<'restore', [['--conflict', 'bad'], ['--conflict', 'merge'], ['-h']]>>,
  Check<Accepted<'restore', [['--conflict', 'bad'], ['--conflict', 'merge'], ['-h']], 'immediate'> extends false ? true : false>,
  Check<Accepted<'switch', [['-h'], ['--conflict', 'bad']], 'immediate'>>,
  Check<Accepted<'switch', [['--conflict', 'bad']]> extends false ? true : false>,
  Check<Accepted<'switch', [['--conflict', 'bad' | 'merge']]> extends false ? true : false>,
  Check<Accepted<'switch', [['--conflict', 'bad' | 'merge'], ['-h']]>>,
  Check<Accepted<'switch', [['--conflict', 'bad' | 'merge'], ['-h']], 'immediate'> extends false ? true : false>,
  Check<Accepted<'switch', [['--conflict', 'bad'], ['-h'], { operand: 'bad\0word' }]> extends false ? true : false>
];

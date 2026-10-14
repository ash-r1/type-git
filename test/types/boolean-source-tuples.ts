import type { CheckedCommandArguments, GitCommandArgument, GitCommandName } from '../../src/commands/types.js';
import type { GitBooleanLiteral, GitBooleanValue, GitBooleanCallbackValue } from '../../src/constraints/git-boolean-types.js';
type Check<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
type Accepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[], P extends 'modern' | 'symmetric' | 'legacy-units' | undefined = undefined> =
  [CheckedCommandArguments<C, A, P extends undefined ? {} : { booleanSource: P }>] extends [never] ? false : true;
export type BooleanSourceTupleCases = readonly [
  Check<Equal<GitBooleanLiteral<'m', 'legacy-units'>, true>>,
  Check<Equal<GitBooleanValue<'m', 'legacy-units'>, false>>,
  Check<Equal<GitBooleanLiteral<'-2147483648', 'symmetric'>, false>>,
  Check<Equal<GitBooleanLiteral<'-2147483648', 'modern'>, true>>,
  Check<Equal<GitBooleanCallbackValue<'m', 'pull-rebase', undefined, 'legacy-units'>, false>>,
  Check<Equal<GitBooleanCallbackValue<'m', 'pull-rebase', undefined, 'modern'>, 'merges'>>,
  Check<Accepted<'checkout', [['--recurse-submodules', 'm'], ['-h']]>>,
  Check<Equal<Accepted<'checkout', [['--recurse-submodules', 'm'], ['-h']], 'modern'>, false>>,
  Check<Equal<Accepted<'checkout', [['--recurse-submodules', '-2147483648'], ['-h']], 'symmetric'>, false>>,
  Check<Equal<Accepted<'push', [['--recurse-submodules', 'm'], ['--recurse-submodules', 'only-is-on-demand'], ['-h']]>, false>>,
  Check<Equal<Accepted<'push', [['--recurse-submodules', 'only-is-on-demand'], ['--recurse-submodules', 'm'], ['-h']]>, false>>,
  Check<Accepted<'push', [['-h'], ['--recurse-submodules', 'm'], ['--recurse-submodules', 'only-is-on-demand']]>>,
  Check<Equal<Accepted<'checkout', [['--recurse-submodules', 'm' | 'bad'], ['-h']]>, false>>,
  Check<Equal<Accepted<'checkout', [['--recurse-submodules', 'm'], ['-h'], { operand: 'bad\0word' }]>, false>>
];

// A conflict context must retain independently selected boolean-source alternatives.
type DeferredAccepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[]> =
  [CheckedCommandArguments<C, A, { conflictStyle: 'deferred' }>] extends [never] ? false : true;
export type DeferredBooleanSourceCases = readonly [
  Check<DeferredAccepted<'fetch', [['--recurse-submodules', 'm'], ['-h']]>>,
  Check<DeferredAccepted<'push', [['--recurse-submodules', 'm'], ['-h']]>>,
  Check<DeferredAccepted<'checkout', [['--recurse-submodules', 'm'], ['-h']]>>,
  Check<DeferredAccepted<'switch', [['--recurse-submodules', 'm'], ['-h']]>>,
  Check<DeferredAccepted<'restore', [['--recurse-submodules', 'm'], ['-h']]>>,
  Check<DeferredAccepted<'checkout', [['--recurse-submodules', 'm'], ['--conflict', 'bad'], ['-h']]>>,
  Check<Equal<DeferredAccepted<'checkout', [['--recurse-submodules', 'm'], ['--conflict', 'bad']]>, false>>,
  Check<Equal<DeferredAccepted<'checkout', [['--recurse-submodules', 'm' | 'bad'], ['-h']]>, false>>,
  Check<Equal<[CheckedCommandArguments<'checkout', [['--recurse-submodules', 'm'], ['-h']], { conflictStyle: 'deferred'; booleanSource: 'modern' }>] extends [never] ? false : true, false>>
];

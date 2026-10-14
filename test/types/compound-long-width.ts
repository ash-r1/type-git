import type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';
import type { CompoundDecimalLiteral } from '../../src/constraints/compound-decimal-types.js';
type Check<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
type Accepted<A extends readonly GitCommandArgument<'shortlog'>[]> = [CheckedCommandArguments<'shortlog', A>] extends [never] ? false : true;
export type CompoundLongWidthCases = readonly [
  Check<Equal<CompoundDecimalLiteral<'-4294967220,-18446744073709551610,9', 'shortlog-wrap', 32, false>, false>>,
  Check<Equal<CompoundDecimalLiteral<'-4294967220,-18446744073709551610,9', 'shortlog-wrap', 32, true>, true>>,
  Check<Equal<CompoundDecimalLiteral<'2,-18446744073709551616,0', 'shortlog-wrap', 64, true>, true>>,
  Check<Equal<CompoundDecimalLiteral<'2,18446744073709551616,0', 'shortlog-wrap', 64, true>, false>>,
  Check<Equal<CompoundDecimalLiteral<'-4294967220', 'shortlog-wrap', 32>, true>>,
  Check<Equal<CompoundDecimalLiteral<'-4294967220', 'shortlog-wrap', 64>, false>>,
  Check<Equal<CompoundDecimalLiteral<'-18446744073709551540', 'shortlog-wrap', 32>, false>>,
  Check<Equal<CompoundDecimalLiteral<'-18446744073709551540', 'shortlog-wrap', 64>, true>>,
  Check<Accepted<[['-w', '-4294967220'], ['-h']]>>,
  Check<Accepted<[['-w', '-18446744073709551540'], ['-h']]>>,
  Check<Equal<Accepted<[['-w', '-4294967220'], ['-w', '-18446744073709551540'], ['-h']]>, false>>,
  Check<Equal<Accepted<[['-w', '-18446744073709551540'], ['-w', '-4294967220'], ['-h']]>, false>>,
  Check<Accepted<[['-w', '-4294967220,-18446744073709551610,9'], ['-h']]>>,
  Check<Equal<Accepted<[['-w', '-4294967220' | 'invalid'], ['-h']]>, false>>,
  Check<Equal<Accepted<[['-w', '-4294967220'], ['-h'], { operand: 'bad\0word' }]>, false>>,
  Check<Accepted<[['-h'], ['-w', '-4294967220'], ['-w', '-18446744073709551540']]>>
];

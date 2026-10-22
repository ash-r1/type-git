import type { GitTimestampLiteral, GitTimestampValue } from '../../src/constraints/git-timestamp-types.js';
type Modern = { kind: 'timestamp'; conversion: 'checked'; longBits: 64 };
type Legacy = { kind: 'timestamp'; conversion: 'atoi'; longBits: 64 };
type Check<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
export type TimestampChecks = readonly [
  Check<GitTimestampLiteral<'18446744073709551615', Modern>>,
  Check<GitTimestampLiteral<'-18446744073709551615', Modern>>,
  Check<Equal<GitTimestampValue<'-1', Modern>, 18446744073709551615n>>,
  Check<Equal<GitTimestampValue<'-18446744073709551615', Modern>, 1>>,
  Check<Equal<GitTimestampValue<' \t+0001', Modern>, 1>>,
  Check<Equal<GitTimestampValue<'-0', Modern>, 0>>,
  Check<Equal<GitTimestampLiteral<'1\n', Modern>, false>>,
  Check<Equal<GitTimestampLiteral<'18446744073709551616', Modern>, false>>,
  Check<Equal<GitTimestampLiteral<'-18446744073709551616', Modern>, false>>,
  Check<Equal<GitTimestampLiteral<'1' | '1x', Modern>, false>>,
  Check<Equal<GitTimestampLiteral<'', Modern>, false>>,
  Check<Equal<GitTimestampLiteral<'0x10', Modern>, false>>,
  Check<Equal<GitTimestampLiteral<'1\0', Legacy>, false>>,
  Check<Equal<GitTimestampValue<'4294967295', Legacy>, 18446744073709551615n>>,
  Check<Equal<GitTimestampValue<'18446744073709551616', Legacy>, 18446744073709551615n>>,
  Check<Equal<GitTimestampValue<'-2147483648', Legacy>, 18446744071562067968n>>,
  Check<Equal<GitTimestampValue<'nonsense', Legacy>, 0>>,
  Check<Equal<GitTimestampValue<'1x', Legacy>, 1>>,
  Check<Equal<GitTimestampValue<'4294967295', Omit<Legacy, 'longBits'> & {longBits: 32}>, 2147483647>>,
  Check<Equal<GitTimestampValue<1e19, Modern>, 10000000000000000000n>>,
  Check<Equal<GitTimestampLiteral<1e21, Modern>, false>>,
  Check<Equal<GitTimestampValue<1e21, Legacy>, 1>>,
  Check<GitTimestampLiteral<string, Modern>>,
  Check<GitTimestampLiteral<`1${string}`, Modern>>,
];

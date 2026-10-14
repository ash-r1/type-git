import type { GitIntegerLiteral as Valid, GitIntegerValue as Value } from '../../src/constraints/git-integer-types.js';
import type { Constrained } from '../../src/constraints/types.js';
type I32 = { kind: 'integer'; signed: true; bits: 32 };
type U64 = { kind: 'integer'; signed: false; bits: 64 };
type Yes<T extends true> = T;
type No<T extends false> = T;
export type Boundaries = [
  Yes<Valid<'2147483647', I32>>,
  No<Valid<'2147483648', I32>>,
  No<Valid<1 | 2147483648, I32>>,
  Yes<Valid<1 | 2, I32>>,
  Yes<Valid<'-2147483648', I32>>,
  No<Valid<'-2147483649', I32>>,
  Yes<Valid<'18446744073709551615', U64>>,
  No<Valid<'18446744073709551616', U64>>,
  Yes<Valid<'0xffffffffffffffff', U64>>,
  No<Valid<'0x10000000000000000', U64>>,
  No<Valid<'08', I32>>,
  No<Valid<'-0', U64>>,
  No<Valid<'1 ', I32>>,
  No<Valid<'1K', I32>>,
  Yes<Valid<'0XffK', I32>>,
  No<Valid<'1.5', I32>>,
  No<Valid<9007199254740992, U64>>,
  Yes<Valid<9007199254740992n, U64>>,
  No<Valid<'2g', I32>>,
  Yes<Valid<'-2g', I32>>,
  Yes<Valid<string, I32>>,
  Yes<Valid<number, I32>>,
  Yes<Valid<bigint, U64>>,
];
export const decimal: Value<'0b11k', I32> = 3072;
export const negative: Value<'-020', I32> = -16;
export const huge: Value<'0xffffffffffffffff', U64> = 18446744073709551615n;
type IntegerRule = { id: 'integer'; kind: 'scalar'; key: 'value'; parser: U64; origin: 'git'; reason: 'fixture'; source: 'fixture' };
export const accepted: Constrained<{ value: '0xffffffffffffffff' }, readonly [IntegerRule]> = { value: '0xffffffffffffffff' };
// @ts-expect-error Shared scalar rules reject values outside the recorded width too.
export const rejected: Constrained<{ value: '18446744073709551616' }, readonly [IntegerRule]> = { value: '18446744073709551616' };

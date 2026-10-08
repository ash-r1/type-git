import type { GitIntegerLiteral, GitIntegerValue } from '../../src/constraints/git-integer-types.js';
import type { GitDecimalLiteral } from '../../src/constraints/git-decimal-types.js';
type Integer = { kind:'integer'; signed:false; bits:64 };
type Decimal = { kind:'decimal'; longBits:64; bits:32; signed:true; conversion:'checked' };
type Yes<T extends true> = T;
type No<T extends false> = T;
export type Templates = [
  Yes<GitIntegerLiteral<`${number}`, Integer>>,
  Yes<GitIntegerLiteral<`${bigint}`, Integer>>,
  Yes<GitIntegerLiteral<`1${number}`, Integer>>,
  Yes<GitIntegerLiteral<`${number}k`, Integer>>,
  Yes<GitIntegerLiteral<`0x${number}`, Integer>>,
  No<GitIntegerLiteral<`bad${number}`, Integer>>,
  No<GitIntegerLiteral<'1e2', Integer>>,
  No<GitIntegerLiteral<'18446744073709551616', Integer>>,
  Yes<GitDecimalLiteral<`1${number}`, Decimal>>,
  Yes<GitDecimalLiteral<`1${bigint}`, Decimal>>,
  No<GitDecimalLiteral<`bad${number}`, Decimal>>,
  No<GitDecimalLiteral<'1e2', Decimal>>,
];
export const unknownValue: GitIntegerValue<`${number}`, Integer> = 1;

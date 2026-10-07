import type {
  GitDecimalLiteral as Valid,
  GitDecimalValue as Value,
} from '../../src/constraints/git-decimal-types.js';
type Cast = { kind: 'decimal'; longBits: 64; bits: 32; signed: true; conversion: 'cast' };
type Mainline = Cast & { positive: true };
type Abbrev = Cast & { nonzeroMinimum: 4; default: 'unknown' };
type Count = Omit<Cast, 'conversion'> & { conversion: 'checked' };
type Unified = Omit<Cast, 'signed'> & {
  signed: false;
  empty: true;
  beforeNonnegative: true;
  default: 'previous';
};
type Yes<T extends true> = T;
type No<T extends false> = T;
export type Cases = [
  Yes<Valid<`${number}`, Count>>,
  Yes<Valid<`${bigint}`, Count>>,
  Yes<Valid<'010', Count>>,
  No<Valid<'0x10', Count>>,
  No<Valid<'1k', Count>>,
  No<Valid<'1\n', Count>>,
  No<Valid<'', Count>>,
  No<Valid<' ', Abbrev>>,
  No<Valid<'2147483648', Count>>,
  Yes<Valid<'4294967297', Mainline>>,
  No<Valid<'2147483648', Mainline>>,
  No<Valid<'9223372036854775808', Mainline>>,
  Yes<Valid<'', Unified>>,
  Yes<Valid<'4294967295', Unified>>,
  No<Valid<'-4294967295', Unified>>,
  No<Valid<'1' | 'bad', Count>>,
];
export const decimal: Value<'010', Count> = 10;
export const wrapped: Value<'4294967297', Mainline> = 1;
export const wrappedNegative: Value<'-4294967295', Mainline> = 1;
export const abbreviated: Value<'2147483648', Abbrev> = 4;
export const abbreviatedZero: Value<'-9223372036854775809', Abbrev> = 0;
export const upperLong: Value<'9223372036854775808', Cast> = -1;
export const unsigned: Value<'4294967295', Unified> = 4294967295;
export const configured: Value<true, Abbrev> = true;

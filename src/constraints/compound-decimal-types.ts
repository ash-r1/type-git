import type { CompoundDecimalParser } from './compound-decimal.js';
import type { COMPOUND_DECIMALS } from './compound-decimals.generated.js';
import type { GitDecimalParser } from './git-decimal.js';
import type { GitDecimalLiteral, GitDecimalValue } from './git-decimal-types.js';
import type { AtMost } from './git-integer-types.js';

type Profile<P extends CompoundDecimalParser> = (typeof COMPOUND_DECIMALS)[P];
type DecimalProfile<
  P extends CompoundDecimalParser,
  Bits extends 32 | 64,
  NegateOverflow extends boolean,
> = Omit<Profile<P>['decimal'], 'longBits'> & { longBits: Bits } & (NegateOverflow extends true
    ? { negateUnsignedOverflow: true }
    : {}) &
  GitDecimalParser;
type Parts<
  S extends string,
  Limit extends number,
  Acc extends string[] = [],
> = Acc['length'] extends Limit
  ? 'invalid'
  : S extends `${infer H},${infer Rest}`
    ? Parts<Rest, Limit, [...Acc, H]>
    : [...Acc, S];
type Values<
  Fields extends readonly string[],
  Defaults extends readonly number[],
  P extends GitDecimalParser,
> = Defaults extends readonly [infer D extends number, ...infer RestD extends number[]]
  ? Fields extends readonly [infer H extends string, ...infer Rest extends string[]]
    ? GitDecimalLiteral<H extends '' ? `${D}` : H, P> extends true
      ? Values<Rest, RestD, P> extends infer Tail
        ? Tail extends readonly (number | bigint)[]
          ? readonly [GitDecimalValue<H extends '' ? `${D}` : H, P>, ...Tail]
          : 'invalid'
        : never
      : 'invalid'
    : Defaults
  : readonly [];
type Greater<
  Pivot extends number | bigint,
  Others extends readonly number[],
  V extends readonly (number | bigint)[],
> = Pivot extends 0
  ? true
  : Others extends readonly [infer H extends number, ...infer Rest extends number[]]
    ? number extends Pivot | V[H]
      ? Greater<Pivot, Rest, V>
      : AtMost<`${Pivot}`, `${V[H]}`> extends true
        ? false
        : Greater<Pivot, Rest, V>
    : true;
type TupleLiteral<
  S extends string,
  P extends CompoundDecimalParser,
  Bits extends 32 | 64,
  NegateOverflow extends boolean,
> = Profile<P> extends {
  defaults: infer D extends readonly number[];
  nonzeroGreaterThan: {
    index: infer I extends number;
    others: infer Other extends readonly number[];
  };
}
  ? Parts<S, D['length']> extends infer Split
    ? Split extends readonly string[]
      ? Values<Split, D, DecimalProfile<P, Bits, NegateOverflow>> extends infer V
        ? V extends readonly (number | bigint)[]
          ? Greater<V[I], Other, V>
          : false
        : false
      : false
    : false
  : false;
type Parsed<
  V,
  P extends CompoundDecimalParser,
  Bits extends 32 | 64,
  NegateOverflow extends boolean,
> = V extends true
  ? true
  : V extends string
    ? string extends V
      ? true
      : Profile<P> extends { kind: 'prefix' }
        ? GitDecimalLiteral<
            V extends `${infer Head},${string}` ? Head : V,
            DecimalProfile<P, Bits, NegateOverflow>
          >
        : TupleLiteral<V, P, Bits, NegateOverflow>
    : false;
export type CompoundDecimalLiteral<
  V,
  P extends CompoundDecimalParser,
  Bits extends 32 | 64 = 64,
  NegateOverflow extends boolean = false,
> = false extends Parsed<V, P, Bits, NegateOverflow> ? false : true;

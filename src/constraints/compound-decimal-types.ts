import type { CompoundDecimalParser } from './compound-decimal.js';
import type { COMPOUND_DECIMALS } from './compound-decimals.generated.js';
import type { GitDecimalParser } from './git-decimal.js';
import type { GitDecimalLiteral, GitDecimalValue } from './git-decimal-types.js';
import type { AddDigit, AtMost, Digit } from './git-integer-types.js';

type Profile<P extends CompoundDecimalParser> = (typeof COMPOUND_DECIMALS)[P];
type DecimalProfile<
  P extends CompoundDecimalParser,
  Bits extends 32 | 64,
  NegateOverflow extends boolean,
> = Omit<Profile<P>['decimal'], 'longBits'> & { longBits: Bits } & (NegateOverflow extends true
    ? { negateUnsignedOverflow: true }
    : {}) &
  GitDecimalParser;
type Radix = 2 | 8 | 10 | 16;
type BaseDigits<B extends Radix> = B extends 2
  ? '0' | '1'
  : B extends 8
    ? Exclude<Digit, '8' | '9'>
    : B extends 10
      ? Digit
      : Digit | 'a' | 'b' | 'c' | 'd' | 'e' | 'f';
type RadixDigits<
  S extends string,
  B extends Radix,
  A extends string = '0',
  Seen extends boolean = false,
  N extends unknown[] = [],
> = string extends S
  ? string
  : N['length'] extends 128
    ? string
    : S extends ''
      ? Seen extends true
        ? A
        : 'invalid'
      : S extends `${infer H}${infer Rest}`
        ? Lowercase<H> extends BaseDigits<B>
          ? RadixDigits<Rest, B, AddDigit<A, B, Lowercase<H>>, true, [...N, 0]>
          : {} extends Record<H, unknown>
            ? string
            : 'invalid'
        : string;
type LeadingSpace<S extends string> =
  S extends `${' ' | '\t' | '\r' | '\n' | '\v' | '\f'}${infer R}` ? LeadingSpace<R> : S;
type BaseZero<S extends string> = S extends `0${'x' | 'X'}${infer R}`
  ? RadixDigits<R, 16>
  : S extends `0${'b' | 'B'}${infer R}`
    ? RadixDigits<R, 2>
    : S extends `0${string}`
      ? RadixDigits<S, 8>
      : RadixDigits<S, 10>;
type OffsetText<
  S extends string,
  T extends string = LeadingSpace<S>,
> = T extends `${infer Sign extends '+' | '-'}${infer Rest}`
  ? BaseZero<Rest> extends infer D extends string
    ? D extends 'invalid'
      ? D
      : `${Sign}${D}`
    : never
  : BaseZero<T>;
type AtMostValue<
  S extends string,
  P extends GitDecimalParser,
  Max extends string,
> = string extends S
  ? true
  : GitDecimalLiteral<S, P> extends true
    ? GitDecimalValue<S, P> extends infer V extends number | bigint
      ? number extends V
        ? true
        : bigint extends V
          ? true
          : AtMost<`${V}`, Max>
      : false
    : false;
type IndexVersion<
  S extends string,
  P extends CompoundDecimalParser,
  Bits extends 32 | 64,
  NegateOverflow extends boolean,
> = S extends `${infer Version},${infer Offset}`
  ? AtMostValue<Version, DecimalProfile<P, Bits, NegateOverflow>, '2'> extends true
    ? Offset extends ''
      ? Profile<P> extends { emptyOffset: true }
        ? true
        : false
      : OffsetText<Offset> extends infer D extends string
        ? D extends 'invalid'
          ? false
          : AtMostValue<D, DecimalProfile<P, Bits, NegateOverflow>, '2147483647'>
        : false
    : false
  : AtMostValue<S, DecimalProfile<P, Bits, NegateOverflow>, '2'>;
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
      : Profile<P> extends { kind: 'index-version' }
        ? IndexVersion<V, P, Bits, NegateOverflow>
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

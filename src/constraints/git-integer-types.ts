import type { GitIntegerParser } from './git-integer.js';
import type { IntegerLimits, IntegerProducts } from './integer-type-tables.js';
import type { UrlBytes } from './url-byte-types.js';

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type HexDigit = Digit | 'a' | 'b' | 'c' | 'd' | 'e' | 'f';
type DigitIndex = {
  '0': 0;
  '1': 1;
  '2': 2;
  '3': 3;
  '4': 4;
  '5': 5;
  '6': 6;
  '7': 7;
  '8': 8;
  '9': 9;
  a: 10;
  b: 11;
  c: 12;
  d: 13;
  e: 14;
  f: 15;
};
type Base = 2 | 8 | 10 | 16;
export type Strip<S extends string> = S extends `0${infer R}` ? Strip<R> : S extends '' ? '0' : S;
export type Reverse<S extends string, R extends string = ''> = S extends `${infer H}${infer T}`
  ? Reverse<T, `${H}${R}`>
  : R;
type Multiply<
  S extends string,
  B extends Base,
  C extends string,
  R extends string = '',
> = S extends `${infer H extends Digit}${infer T}`
  ? IntegerProducts[`${B}`][H][C extends `${infer N extends number}` ? N : never] extends readonly [
      infer Carry extends string,
      infer D extends string,
    ]
    ? Multiply<T, B, Carry, `${D}${R}`>
    : never
  : Strip<`${C}${R}`>;
export type AddDigit<S extends string, B extends Base, D extends HexDigit> = Multiply<
  Reverse<S>,
  B,
  `${DigitIndex[D]}`
>;
type Permitted<B extends Base> = B extends 2
  ? '0' | '1'
  : B extends 8
    ? Exclude<Digit, '8' | '9'>
    : B extends 10
      ? Digit
      : HexDigit;
type Unit<S extends string> = S extends 'k'
  ? '0000000000'
  : S extends 'm'
    ? '00000000000000000000'
    : S extends 'g'
      ? '000000000000000000000000000000'
      : '';
type Scale<S extends string, U extends string> = U extends `0${infer R}`
  ? Scale<AddDigit<S, 2, '0'>, R>
  : S;
// Extremely long or non-literal strings are deferred to runtime, not rejected by a compiler recursion limit.
type Ascii = UrlBytes[Extract<
  keyof UrlBytes,
  `${'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'}${HexDigit}`
>];
// Any 65 significant base digits overflow even the widest supported destination.
type SignificantOverflow<S extends string> = SignificantTailOverflow<ZeroNormalized<S>, []>;
type SignificantTailOverflow<
  S extends string,
  Steps extends unknown[],
> = S extends `${infer H}${infer R}`
  ? H extends HexDigit | Uppercase<HexDigit>
    ? Steps['length'] extends 64
      ? true
      : SignificantTailOverflow<R, [...Steps, 0]>
    : false
  : false;
type Digits<
  S extends string,
  B extends Base,
> = S extends `${infer R}${'k' | 'K' | 'm' | 'M' | 'g' | 'G'}`
  ? CheckedDigits<R, B> extends 'invalid'
    ? 'invalid'
    : ConvertDigits<ZeroNormalized<S>, B>
  : CheckedDigits<S, B> extends 'invalid'
    ? 'invalid'
    : ConvertDigits<ZeroNormalized<S>, B>;
type ZeroNormalized<S extends string, Steps extends unknown[] = []> = Steps['length'] extends 128
  ? string
  : S extends `0000000000000000${infer R}`
    ? R extends '' | 'k' | 'K' | 'm' | 'M' | 'g' | 'G'
      ? `0${R}`
      : ZeroNormalized<R, [...Steps, 0]>
    : S extends `0${infer R}`
      ? R extends '' | 'k' | 'K' | 'm' | 'M' | 'g' | 'G'
        ? S
        : ZeroNormalized<R, [...Steps, 0]>
      : S;
type CheckedDigits<S extends string, B extends Base> = S extends `${infer H}${string}`
  ? {} extends Record<H, unknown>
    ? 'valid'
    : KnownDigits<S, B>
  : KnownDigits<S, B>;
type KnownDigits<
  S extends string,
  B extends Base,
> = S extends `${string}${Exclude<Ascii, Permitted<B> | Uppercase<Permitted<B>>>}${string}`
  ? 'invalid'
  : SignificantOverflow<S> extends true
    ? 'invalid'
    : 'valid';
type ConvertDigits<
  S extends string,
  B extends Base,
  A extends string = '0',
  Seen extends boolean = false,
  Steps extends unknown[] = [],
> = string extends S
  ? 'dynamic'
  : Steps['length'] extends 128
    ? 'dynamic'
    : S extends ''
      ? Seen extends true
        ? A
        : 'invalid'
      : S extends 'k' | 'K' | 'm' | 'M' | 'g' | 'G'
        ? Seen extends true
          ? Scale<A, Unit<Lowercase<S>>>
          : 'invalid'
        : S extends `${infer H}${infer R}`
          ? Lowercase<H> extends Permitted<B>
            ? ConvertDigits<R, B, AddDigit<A, B, Lowercase<H>>, true, [...Steps, 0]>
            : `${number}` extends H
              ? 'dynamic'
              : `${bigint}` extends H
                ? 'dynamic'
                : 'invalid'
          : 'dynamic';
type Magnitude<S extends string> = S extends `0${'x' | 'X'}${infer R}`
  ? Digits<R, 16>
  : S extends `0${'b' | 'B'}${infer R}`
    ? Digits<R, 2>
    : S extends `0${string}`
      ? Digits<S, 8>
      : Digits<S, 10>;
type CWhitespace = ' ' | '\t' | '\r' | '\n' | '\v' | '\f';
// Consume known C whitespace in short blocks without forming a Cartesian character union.
type TrimBlock<S extends string, Steps extends unknown[] = []> = Steps['length'] extends 16
  ? S
  : S extends `${CWhitespace}${infer R}`
    ? TrimBlock<R, [...Steps, 0]>
    : S;
export type Trim<S extends string, Steps extends unknown[] = []> = Steps['length'] extends 128
  ? string
  : TrimBlock<S> extends infer R extends string
    ? R extends S
      ? R
      : Trim<R, [...Steps, 0]>
    : S;
type Shorter<A extends string, B extends string> = A extends `${string}${infer LeftRest}`
  ? B extends `${string}${infer RightRest}`
    ? Shorter<LeftRest, RightRest>
    : false
  : B extends ''
    ? 'equal'
    : true;
type SmallerDigit<
  A extends Digit,
  B extends Digit,
> = '0123456789' extends `${string}${A}${string}${B}${string}` ? true : false;
type Lexical<A extends string, B extends string> = A extends `${infer H extends Digit}${infer R}`
  ? B extends `${infer J extends Digit}${infer T}`
    ? H extends J
      ? Lexical<R, T>
      : SmallerDigit<H, J>
    : false
  : true;
export type AtMost<A extends string, B extends string> = Shorter<A, B> extends 'equal'
  ? Lexical<A, B>
  : Shorter<A, B>;
type Bounded<S extends string, Negative extends boolean, P extends GitIntegerParser> = S extends
  | 'invalid'
  | 'dynamic'
  ? S
  : AtMost<
        S,
        IntegerLimits[`${P['bits']}`][P['signed'] extends true
          ? Negative extends true
            ? 'negative'
            : 'signed'
          : 'unsigned']
      > extends true
    ? Negative extends true
      ? S extends '0'
        ? '0'
        : `-${S}`
      : S
    : 'invalid';
type Signed<S extends string, P extends GitIntegerParser> = string extends S
  ? 'dynamic'
  : S extends `-${infer R}`
    ? P['signed'] extends false
      ? 'invalid'
      : Bounded<Magnitude<R>, true, P>
    : Bounded<Magnitude<S extends `+${infer R}` ? R : S>, false, P>;
type ModernParsed<V, P extends GitIntegerParser> = V extends string | number | bigint
  ? string extends V
    ? 'dynamic'
    : number extends V
      ? 'dynamic'
      : bigint extends V
        ? 'dynamic'
        : V extends number
          ? P extends { numberRepresentation: 'argv' }
            ? Signed<Trim<`${V}`>, P>
            : AtMost<`${V}` extends `-${infer R}` ? R : `${V}`, '9007199254740991'> extends true
              ? Signed<Trim<`${V}`>, P>
              : 'invalid'
          : Signed<Trim<`${V}`>, P>
  : V extends undefined
    ? 'dynamic'
    : 'invalid';
// Decimal legacy input can wrap or saturate before int assignment. Prove its
// lexical language and exact small values; defer overflow normalization.
type LegacyDigits<
  S extends string,
  A extends string = '',
  Steps extends unknown[] = [],
> = string extends S
  ? 'dynamic'
  : S extends object
    ? 'dynamic'
    : {} extends Record<S, unknown>
      ? 'dynamic'
      : Steps['length'] extends 128
        ? 'dynamic'
        : S extends ''
          ? A extends ''
            ? 'invalid'
            : Strip<A>
          : S extends `${infer H extends Digit}${infer Rest}`
            ? LegacyDigits<Rest, `${A}${H}`, [...Steps, 0]>
            : 'invalid';
type LegacyNormalized<
  S extends string,
  Negative extends boolean,
  P extends GitIntegerParser,
> = S extends 'invalid' | 'dynamic'
  ? S
  : Negative extends true
    ? S extends '0'
      ? '0'
      : P['signed'] extends false
        ? 'dynamic'
        : Bounded<S, true, P> extends infer V
          ? V extends 'invalid'
            ? 'dynamic'
            : V
          : never
    : Bounded<S, false, P> extends infer V
      ? V extends 'invalid'
        ? 'dynamic'
        : V
      : never;
type LegacySigned<S extends string, P extends GitIntegerParser> = string extends S
  ? 'dynamic'
  : S extends `-${infer R}`
    ? LegacyNormalized<LegacyDigits<R>, true, P>
    : LegacyNormalized<LegacyDigits<S extends `+${infer R}` ? R : S>, false, P>;
type LegacyParsed<V, P extends GitIntegerParser> = V extends string | number | bigint
  ? string extends V
    ? 'dynamic'
    : number extends V
      ? 'dynamic'
      : bigint extends V
        ? 'dynamic'
        : V extends object
          ? 'dynamic'
          : V extends number
            ? AtMost<`${V}` extends `-${infer R}` ? R : `${V}`, '9007199254740991'> extends true
              ? LegacySigned<Trim<`${V}`>, P>
              : 'invalid'
            : LegacySigned<Trim<`${V}`>, P>
  : V extends undefined
    ? 'dynamic'
    : 'invalid';
// uintmax conversion precedes unit multiplication in the older unsigned parser.
// Decimal subtraction uses only digit-sized tuples, never value-sized tuples.
type DigitTuple<N extends number, A extends unknown[] = []> = A['length'] extends N
  ? A
  : DigitTuple<N, [...A, 0]>;
type SubDigit<
  A extends Digit,
  B extends Digit,
  Borrow extends 0 | 1,
  Right extends unknown[] = [...DigitTuple<DigitIndex[B]>, ...DigitTuple<Borrow>],
> = DigitTuple<DigitIndex[A]> extends [...Right, ...infer Rest]
  ? [`${Rest['length']}` & Digit, 0]
  : [...DigitTuple<10>, ...DigitTuple<DigitIndex[A]>] extends [...Right, ...infer Rest]
    ? [`${Rest['length']}` & Digit, 1]
    : never;
type SubDigits<
  A extends string,
  B extends string,
  Borrow extends 0 | 1 = 0,
  Out extends string = '',
> = A extends `${infer H extends Digit}${infer Rest}`
  ? B extends `${infer J extends Digit}${infer Tail}`
    ? SubDigit<H, J, Borrow> extends [infer D extends Digit, infer Next extends 0 | 1]
      ? SubDigits<Rest, Tail, Next, `${D}${Out}`>
      : never
    : SubDigit<H, '0', Borrow> extends [infer D extends Digit, infer Next extends 0 | 1]
      ? SubDigits<Rest, '', Next, `${D}${Out}`>
      : never
  : Strip<Out>;
type NegateUintmax<S extends string> = S extends '0'
  ? '0'
  : S extends '1'
    ? '18446744073709551615'
    : SubDigits<'61615590737044764481', Reverse<S>>;
// Git accepts at most one unit suffix, so the magnitude left after stripping one must have none.
type NegativeMagnitude<
  B extends string,
  U extends string,
  P extends GitIntegerParser,
  M = B extends `${string}${'k' | 'K' | 'm' | 'M' | 'g' | 'G'}` ? 'invalid' : Magnitude<B>,
> = M extends 'invalid' | 'dynamic'
  ? M
  : M extends string
    ? AtMost<M, '18446744073709551615'> extends true
      ? Bounded<Scale<NegateUintmax<M>, U>, false, P>
      : 'invalid'
    : 'invalid';
type SignedMagnitude<S extends string, P extends GitIntegerParser> = Trim<S> extends infer T extends
  string
  ? string extends T
    ? 'dynamic'
    : T extends `-${infer R}`
      ? R extends `${infer B}${'k' | 'K'}`
        ? NegativeMagnitude<B, Unit<'k'>, P>
        : R extends `${infer B}${'m' | 'M'}`
          ? NegativeMagnitude<B, Unit<'m'>, P>
          : R extends `${infer B}${'g' | 'G'}`
            ? NegativeMagnitude<B, Unit<'g'>, P>
            : NegativeMagnitude<R, '', P>
      : ModernParsed<S, P>
  : 'invalid';
type MagnitudeParsed<V, P extends GitIntegerParser> = V extends string | number | bigint
  ? string extends V
    ? 'dynamic'
    : number extends V
      ? 'dynamic'
      : bigint extends V
        ? 'dynamic'
        : V extends object
          ? 'dynamic'
          : V extends number
            ? P extends { numberRepresentation: 'argv' }
              ? SignedMagnitude<`${V}`, P>
              : AtMost<`${V}` extends `-${infer R}` ? R : `${V}`, '9007199254740991'> extends true
                ? SignedMagnitude<`${V}`, P>
                : 'invalid'
            : SignedMagnitude<`${V}`, P>
  : V extends undefined
    ? 'dynamic'
    : 'invalid';
type NonDecimalParsed<V, P extends GitIntegerParser> = P extends {
  negativeMagnitudes: true;
  signed: false;
}
  ? MagnitudeParsed<V, P>
  : ModernParsed<V, P>;
type Parsed<V, P extends GitIntegerParser> = P extends { integerProfile: 'decimal-cast'; bits: 32 }
  ? P extends { nativeWidth: string }
    ? NonDecimalParsed<V, P>
    : LegacyParsed<V, P>
  : NonDecimalParsed<V, P>;
export type GitIntegerLiteral<V, P extends GitIntegerParser> = Extract<
  Parsed<V, P>,
  'invalid'
> extends never
  ? true
  : false;
export type State<S extends string> = S extends 'dynamic'
  ? number | bigint
  : S extends 'invalid'
    ? never
    : AtMost<S extends `-${infer R}` ? R : S, '9007199254740991'> extends true
      ? S extends `${infer N extends number}`
        ? N
        : never
      : S extends `${infer N extends bigint}`
        ? N
        : never;
export type GitIntegerValue<V, P extends GitIntegerParser> = State<Parsed<V, P>>;

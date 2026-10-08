import type { GitIntegerParser } from './git-integer.js';
import type { IntegerLimits, IntegerProducts } from './integer-type-tables.js';

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
type Digits<
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
            ? Digits<R, B, AddDigit<A, B, Lowercase<H>>, true, [...Steps, 0]>
            : 'invalid'
          : 'dynamic';
type Magnitude<S extends string> = S extends `0${'x' | 'X'}${infer R}`
  ? Digits<R, 16>
  : S extends `0${'b' | 'B'}${infer R}`
    ? Digits<R, 2>
    : S extends `0${string}`
      ? Digits<S, 8>
      : Digits<S, 10>;
export type Trim<S extends string, Steps extends unknown[] = []> = Steps['length'] extends 128
  ? string
  : S extends `${' ' | '\t' | '\r' | '\n' | '\v' | '\f'}${infer R}`
    ? Trim<R, [...Steps, 0]>
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
type Parsed<V, P extends GitIntegerParser> = V extends string | number | bigint
  ? string extends V
    ? 'dynamic'
    : number extends V
      ? 'dynamic'
      : bigint extends V
        ? 'dynamic'
        : V extends number
          ? AtMost<`${V}` extends `-${infer R}` ? R : `${V}`, '9007199254740991'> extends true
            ? Signed<Trim<`${V}`>, P>
            : 'invalid'
          : Signed<Trim<`${V}`>, P>
  : V extends undefined
    ? 'dynamic'
    : 'invalid';
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

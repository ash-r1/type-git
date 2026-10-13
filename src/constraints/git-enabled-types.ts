// Git 2.55 parse.c: base-0 signed 32-bit integers with k/m/g multipliers.
// Compare magnitudes in their native radix, avoiding unbounded tuple arithmetic.
type Limits = {
  '2': {
    '': ['1111111111111111111111111111111', '10000000000000000000000000000000'];
    k: ['111111111111111111111', '1000000000000000000000'];
    m: ['11111111111', '100000000000'];
    g: ['1', '10'];
  };
  '8': {
    '': ['17777777777', '20000000000'];
    k: ['7777777', '10000000'];
    m: ['3777', '4000'];
    g: ['1', '2'];
  };
  '10': {
    '': ['2147483647', '2147483648'];
    k: ['2097151', '2097152'];
    m: ['2047', '2048'];
    g: ['1', '2'];
  };
  '16': {
    '': ['7fffffff', '80000000'];
    k: ['1fffff', '200000'];
    m: ['7ff', '800'];
    g: ['1', '2'];
  };
};
type Radix = keyof Limits;
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type Hex = Digit | 'a' | 'b' | 'c' | 'd' | 'e' | 'f';
type Allowed<B extends Radix> = B extends '2'
  ? '0' | '1'
  : B extends '8'
    ? Exclude<Digit, '8' | '9'>
    : B extends '10'
      ? Digit
      : Hex | Uppercase<Hex>;
type Trim<S extends string, N extends unknown[] = []> = N['length'] extends 128
  ? string
  : S extends `${' ' | '\t' | '\r' | '\n' | '\v' | '\f'}${infer R}`
    ? Trim<R, [...N, 0]>
    : S;
type Digits<
  S extends string,
  B extends Radix,
  A extends string = '',
  N extends unknown[] = [],
> = string extends S
  ? 'dynamic'
  : N['length'] extends 128
    ? 'dynamic'
    : S extends ''
      ? A extends ''
        ? 'invalid'
        : A
      : S extends `${infer H}${infer R}`
        ? `${number}` extends H
          ? 'dynamic'
          : `${bigint}` extends H
            ? 'dynamic'
            : H extends Allowed<B>
              ? Digits<R, B, `${A}${Lowercase<H>}`, [...N, 0]>
              : 'invalid'
        : 'dynamic';
type Strip<S extends string> = S extends `0${infer R}` ? Strip<R> : S extends '' ? '0' : S;
type LengthCompare<A extends string, B extends string> = A extends `${infer _H}${infer R}`
  ? B extends `${infer _J}${infer T}`
    ? LengthCompare<R, T>
    : false
  : B extends ''
    ? 'equal'
    : true;
type Lexical<A extends string, B extends string> = A extends `${infer H}${infer R}`
  ? B extends `${infer J}${infer T}`
    ? H extends J
      ? Lexical<R, T>
      : '0123456789abcdef' extends `${string}${H}${string}${J}${string}`
        ? true
        : false
    : false
  : true;
type AtMost<A extends string, B extends string> = LengthCompare<A, B> extends 'equal'
  ? Lexical<A, B>
  : LengthCompare<A, B>;
type Bounded<
  S extends string,
  B extends Radix,
  U extends keyof Limits[B],
  Negative extends boolean,
> = Digits<S, B> extends infer D extends string
  ? D extends 'invalid' | 'dynamic'
    ? D
    : Strip<D> extends infer M extends string
      ? AtMost<
          M,
          Limits[B][U] extends readonly string[]
            ? Limits[B][U][Negative extends true ? 1 : 0]
            : never
        > extends true
        ? M extends '0'
          ? false
          : true
        : 'invalid'
      : never
  : never;
type Magnitude<
  S extends string,
  U extends keyof Limits['10'],
  Negative extends boolean,
> = S extends `0${'x' | 'X'}${infer R}`
  ? Bounded<R, '16', U, Negative>
  : S extends `0${'b' | 'B'}${infer R}`
    ? Bounded<R, '2', U, Negative>
    : S extends `0${string}`
      ? Bounded<S, '8', U, Negative>
      : Bounded<S, '10', U, Negative>;
type Unit<S extends string, Negative extends boolean> = S extends `${infer R}${'k' | 'K'}`
  ? Magnitude<R, 'k', Negative>
  : S extends `${infer R}${'m' | 'M'}`
    ? Magnitude<R, 'm', Negative>
    : S extends `${infer R}${'g' | 'G'}`
      ? Magnitude<R, 'g', Negative>
      : Magnitude<S, '', Negative>;
type Integer<S extends string> = string extends S
  ? 'dynamic'
  : S extends `-${infer R}`
    ? Unit<R, true>
    : Unit<S extends `+${infer R}` ? R : S, false>;
/** Known literals mirror matches(gitEnabled); unknown strings defer to runtime. */
export type GitEnabledLiteral<V> = V extends true
  ? true
  : V extends string
    ? string extends V
      ? 'dynamic'
      : V extends 'on-demand'
        ? true
        : Lowercase<V> extends 'true' | 'yes' | 'on'
          ? true
          : Lowercase<V> extends '' | 'false' | 'no' | 'off'
            ? false
            : Integer<Trim<V>> extends infer B
              ? B extends 'invalid'
                ? false
                : B
              : never
    : false;

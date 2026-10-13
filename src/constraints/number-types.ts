// Compare finite number literals without allocating tuples proportional to their values.
// Finite IEEE-754 scientific notation needs at most 324 places; unknown numbers defer to runtime.
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type Reverse<S extends string, A extends string = ''> = S extends `${infer H}${infer R}`
  ? Reverse<R, `${H}${A}`>
  : A;
type Strip<S extends string> = S extends `0${infer R}` ? Strip<R> : S extends '' ? '0' : S;
type Parts<S extends string> = S extends `${infer W}.${infer F}`
  ? { whole: W; fraction: F }
  : { whole: S; fraction: '' };
type Right<
  W extends string,
  F extends string,
  E extends number,
  N extends unknown[] = [],
> = N['length'] extends E
  ? { whole: Strip<W>; fraction: F }
  : N['length'] extends 324
    ? 'dynamic'
    : F extends `${infer H}${infer R}`
      ? Right<`${W}${H}`, R, E, [...N, 0]>
      : Right<`${W}0`, '', E, [...N, 0]>;
type Left<
  W extends string,
  F extends string,
  E extends number,
  N extends unknown[] = [],
> = N['length'] extends E
  ? { whole: Strip<Reverse<W>>; fraction: F }
  : N['length'] extends 324
    ? 'dynamic'
    : W extends `${infer H}${infer R}`
      ? Left<R, `${H}${F}`, E, [...N, 0]>
      : Left<'', `0${F}`, E, [...N, 0]>;
type Expand<S extends string> = S extends `${infer C}e${infer E}`
  ? Parts<C> extends { whole: infer W extends string; fraction: infer F extends string }
    ? E extends `-${infer N extends number}`
      ? Left<Reverse<W>, F, N>
      : E extends `+${infer N extends number}`
        ? Right<W, F, N>
        : E extends `${infer N extends number}`
          ? Right<W, F, N>
          : 'dynamic'
    : 'dynamic'
  : Parts<S> extends { whole: infer W extends string; fraction: infer F extends string }
    ? { whole: Strip<W>; fraction: F }
    : 'dynamic';
type LengthOrder<A extends string, B extends string> = A extends `${infer _H}${infer R}`
  ? B extends `${infer _J}${infer T}`
    ? LengthOrder<R, T>
    : 1
  : B extends ''
    ? 0
    : -1;
type DigitOrder<A extends Digit, B extends Digit> = A extends B
  ? 0
  : '0123456789' extends `${string}${A}${string}${B}${string}`
    ? -1
    : 1;
type Lexical<A extends string, B extends string> = A extends `${infer H extends Digit}${infer R}`
  ? B extends `${infer J extends Digit}${infer T}`
    ? DigitOrder<H, J> extends infer O
      ? O extends 0
        ? Lexical<R, T>
        : O
      : never
    : Lexical<A, '0'>
  : B extends ''
    ? 0
    : Lexical<'0', B>;
type Magnitude<A extends string, B extends string> = Expand<A> extends infer X
  ? Expand<B> extends infer Y
    ? X extends { whole: infer W extends string; fraction: infer F extends string }
      ? Y extends { whole: infer V extends string; fraction: infer G extends string }
        ? LengthOrder<W, V> extends infer L
          ? L extends 0
            ? Lexical<W, V> extends infer O
              ? O extends 0
                ? Lexical<F, G>
                : O
              : never
            : L
          : never
        : 'dynamic'
      : 'dynamic'
    : never
  : never;
type KnownNumberText<S extends string, N extends unknown[] = []> = S extends
  | 'Infinity'
  | '-Infinity'
  ? true
  : N['length'] extends 64
    ? false
    : S extends ''
      ? true
      : S extends `${infer H}${infer R}`
        ? H extends Digit | '.' | 'e' | '+' | '-'
          ? KnownNumberText<R, [...N, 0]>
          : false
        : false;
type KnownNumber<V extends number> = number extends V ? false : KnownNumberText<`${V}`>;
type Opposite<O> = O extends -1 ? 1 : O extends 1 ? -1 : O;
export type NumberLiteralOrder<A extends number, B extends number> = KnownNumber<A> extends false
  ? 'dynamic'
  : KnownNumber<B> extends false
    ? 'dynamic'
    : `${A}` extends 'Infinity'
      ? `${B}` extends 'Infinity'
        ? 0
        : 1
      : `${A}` extends '-Infinity'
        ? `${B}` extends '-Infinity'
          ? 0
          : -1
        : `${B}` extends 'Infinity'
          ? -1
          : `${B}` extends '-Infinity'
            ? 1
            : A extends B
              ? 0
              : A extends 0
                ? `${B}` extends `-${string}`
                  ? 1
                  : -1
                : B extends 0
                  ? `${A}` extends `-${string}`
                    ? -1
                    : 1
                  : `${A}` extends `-${infer X}`
                    ? `${B}` extends `-${infer Y}`
                      ? Opposite<Magnitude<X, Y>>
                      : -1
                    : `${B}` extends `-${string}`
                      ? 1
                      : Magnitude<`${A}`, `${B}`>;
/** Keep exactly known matches; nonliteral numbers may satisfy either branch. */
export type PositiveNumberMatch<V, Included extends boolean> = V extends unknown
  ? V extends number
    ? number extends V
      ? V
      : NumberLiteralOrder<V, 0> extends infer O
        ? O extends 'dynamic'
          ? V
          : O extends 1
            ? Included extends true
              ? V
              : never
            : Included extends true
              ? never
              : V
        : never
    : Included extends true
      ? never
      : V
  : never;
/** Range constraints only reject numeric values below their declared minimum. */
export type NumberAtLeast<V, M extends number> = V extends number
  ? NumberLiteralOrder<V, M> extends -1
    ? never
    : V
  : V;
/** Mirrors Number.isSafeInteger, preserving absent values and optional booleans. */
export type SafeIntegerAtLeast<
  V,
  M extends number,
  AllowBoolean extends boolean,
> = V extends undefined
  ? V
  : V extends boolean
    ? AllowBoolean extends true
      ? V
      : never
    : V extends number
      ? KnownNumber<V> extends false
        ? V
        : `${V}` extends `${bigint}`
          ? NumberLiteralOrder<V, -9007199254740991> extends -1
            ? never
            : NumberLiteralOrder<V, 9007199254740991> extends 1
              ? never
              : NumberAtLeast<V, M>
          : never
      : never;

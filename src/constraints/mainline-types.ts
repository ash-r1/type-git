import type { NumberLiteralOrder, SafeIntegerAtLeast } from './number-types.js';

// builtin/revert.c: strtol -> int narrowing -> positive check. Declarations
// admit a literal when either supported C ABI accepts it; runtime binds the ABI.
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type Digits = {
  '0': [];
  '1': [0];
  '2': [0, 0];
  '3': [0, 0, 0];
  '4': [0, 0, 0, 0];
  '5': [0, 0, 0, 0, 0];
  '6': [0, 0, 0, 0, 0, 0];
  '7': [0, 0, 0, 0, 0, 0, 0];
  '8': [0, 0, 0, 0, 0, 0, 0, 0];
  '9': [0, 0, 0, 0, 0, 0, 0, 0, 0];
};
type Ten = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
type Strip<S extends string> = S extends `0${infer R}` ? Strip<R> : S extends '' ? '0' : S;
type Reverse<S extends string, R extends string = ''> = S extends `${infer H}${infer T}`
  ? Reverse<T, `${H}${R}`>
  : R;
type Difference<A extends Digit, B extends Digit, Borrow extends boolean> = Digits[A] extends [
  ...Digits[B],
  ...(Borrow extends true ? [0] : []),
  ...infer R,
]
  ? [false, `${R['length']}`]
  : [...Ten, ...Digits[A]] extends [...Digits[B], ...(Borrow extends true ? [0] : []), ...infer R]
    ? [true, `${R['length']}`]
    : never;
type SubtractDigits<
  A extends string,
  B extends string,
  Borrow extends boolean = false,
  Out extends string = '',
> = A extends `${infer H extends Digit}${infer R}`
  ? B extends `${infer J extends Digit}${infer T}`
    ? Difference<H, J, Borrow> extends [infer Carry extends boolean, infer D extends string]
      ? SubtractDigits<R, T, Carry, `${D}${Out}`>
      : never
    : SubtractDigits<A, '0', Borrow, Out>
  : Strip<Out>;
type Subtract<A extends string, B extends string> = SubtractDigits<Reverse<A>, Reverse<B>>;
type AtMost<A extends string, B extends string> = A extends `${infer N extends number}`
  ? B extends `${infer M extends number}`
    ? NumberLiteralOrder<N, M> extends 1
      ? false
      : true
    : false
  : false;
// The decimal accumulator stays below ten times 2^32, so a digit requires at
// most nine bounded subtractions rather than a value-sized tuple.
type Reduce<S extends string> =
  AtMost<S, '4294967295'> extends true ? S : Reduce<Subtract<S, '4294967296'>>;
type Modulo<
  S extends string,
  A extends string = '0',
> = S extends `${infer H extends Digit}${infer R}` ? Modulo<R, Reduce<Strip<`${A}${H}`>>> : A;
type Narrow<M extends string, Negative extends boolean> = Modulo<M> extends infer U extends string
  ? (
      Negative extends true
        ? U extends '0'
          ? '0'
          : Subtract<'4294967296', U>
        : U
    ) extends infer W extends string
    ? AtMost<W, '2147483647'> extends true
      ? W
      : `-${Subtract<'4294967296', W>}`
    : never
  : never;
type Positive<S extends string> = S extends '0' | `-${string}` ? 'invalid' : S;
type Convert<M extends string, Negative extends boolean, Bits extends 32 | 64> = Bits extends 32
  ? AtMost<M, Negative extends true ? '2147483648' : '2147483647'> extends true
    ? Positive<Narrow<M, Negative>>
    : Negative extends true
      ? 'invalid'
      : '2147483647'
  : Positive<Narrow<M, Negative>>;
type Parsed<V, Bits extends 32 | 64> = V extends number
  ? NumberLiteralOrder<V, V> extends 0
    ? [SafeIntegerAtLeast<V, -9007199254740991, false>] extends [never]
      ? 'invalid'
      : NumberLiteralOrder<V, 9007199254740991> extends 1
        ? 'invalid'
        : `${V}` extends `-${infer M}`
          ? Convert<M, true, Bits>
          : Convert<`${V}`, false, Bits>
    : 'dynamic'
  : 'invalid';
type Accepted<V> = V extends unknown
  ? Exclude<Parsed<V, 32> | Parsed<V, 64>, 'invalid'> extends never
    ? false
    : true
  : never;
export type MainlineLiteral<V> = Extract<Accepted<V>, false> extends never ? true : false;
export type MainlineValue<V> =
  Exclude<Parsed<V, 32> | Parsed<V, 64>, 'invalid'> extends infer P
    ? P extends 'dynamic'
      ? number
      : P extends `${infer N extends number}`
        ? N
        : never
    : never;

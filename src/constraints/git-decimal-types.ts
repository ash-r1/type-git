import type { GitDecimalParser } from './git-decimal.js';
import type { AddDigit, AtMost, Digit, Reverse, State, Strip, Trim } from './git-integer-types.js';
import type { IntegerDifferences } from './integer-type-tables.js';

type SubtractDigits<
  A extends string,
  B extends string,
  Borrow extends '0' | '1' = '0',
  Result extends string = '',
> = A extends `${infer H extends Digit}${infer R}`
  ? B extends `${infer J extends Digit}${infer T}`
    ? IntegerDifferences[H][J][Borrow extends '0' ? 0 : 1] extends [
        infer Carry extends '0' | '1',
        infer D extends string,
      ]
      ? SubtractDigits<R, T, Carry, `${D}${Result}`>
      : never
    : SubtractDigits<A, '0', Borrow, Result>
  : Strip<Result>;
type Subtract<A extends string, B extends string> = SubtractDigits<Reverse<A>, Reverse<B>>;
// A decimal accumulator is at most ten times the modulus; each step needs at most nine subtractions.
type Reduce<S extends string> =
  AtMost<S, '4294967295'> extends true ? S : Reduce<Subtract<S, '4294967296'>>;
type Modulo<
  S extends string,
  Acc extends string = '0',
> = S extends `${infer H extends Digit}${infer R}` ? Modulo<R, Reduce<AddDigit<Acc, 10, H>>> : Acc;
type Unsigned<M extends string, Negative extends boolean> = Modulo<M> extends infer U extends string
  ? Negative extends true
    ? U extends '0'
      ? '0'
      : Subtract<'4294967296', U>
    : U
  : never;
type Narrow<M extends string, Negative extends boolean, IsSigned extends boolean> = Unsigned<
  M,
  Negative
> extends infer U extends string
  ? IsSigned extends true
    ? AtMost<U, '2147483647'> extends true
      ? U
      : `-${Subtract<'4294967296', U>}`
    : U
  : never;
type Clamp<M extends string, Negative extends boolean> = AtMost<
  M,
  Negative extends true ? '9223372036854775808' : '9223372036854775807'
> extends true
  ? M
  : Negative extends true
    ? '9223372036854775808'
    : '9223372036854775807';
type Decimal<S extends string, Steps extends unknown[] = []> = string extends S
  ? 'dynamic'
  : Steps['length'] extends 128
    ? 'dynamic'
    : S extends ''
      ? true
      : S extends `${infer H}${infer R}`
        ? H extends Digit
          ? Decimal<R, [...Steps, 0]>
          : false
        : 'dynamic';
type After<S extends string, P extends GitDecimalParser> = P extends { positive: true }
  ? S extends '0' | `-${string}`
    ? 'invalid'
    : S
  : P extends { nonzeroMinimum: 4 }
    ? S extends '1' | '2' | '3' | `-${string}`
      ? '4'
      : S
    : S;
type Convert<M extends string, Negative extends boolean, P extends GitDecimalParser> = P extends {
  beforeNonnegative: true;
}
  ? Negative extends true
    ? M extends '0'
      ? Converted<M, Negative, P>
      : 'invalid'
    : Converted<M, Negative, P>
  : Converted<M, Negative, P>;
type Converted<
  M extends string,
  Negative extends boolean,
  P extends GitDecimalParser,
> = P['conversion'] extends 'checked'
  ? AtMost<
      M,
      P['signed'] extends true
        ? Negative extends true
          ? '2147483648'
          : '2147483647'
        : '4294967295'
    > extends true
    ? P['signed'] extends false
      ? Negative extends true
        ? M extends '0'
          ? After<'0', P>
          : 'invalid'
        : After<M, P>
      : After<Negative extends true ? (M extends '0' ? '0' : `-${M}`) : M, P>
    : 'invalid'
  : After<Narrow<Clamp<M, Negative>, Negative, P['signed']>, P>;
type Magnitude<
  S extends string,
  Negative extends boolean,
  P extends GitDecimalParser,
> = S extends ''
  ? 'invalid'
  : Decimal<S> extends true
    ? Convert<Strip<S>, Negative, P>
    : Decimal<S> extends false
      ? 'invalid'
      : 'dynamic';
type Signed<S extends string, P extends GitDecimalParser> = string extends S
  ? 'dynamic'
  : S extends `-${infer R}`
    ? Magnitude<R, true, P>
    : Magnitude<S extends `+${infer R}` ? R : S, false, P>;
type Parsed<V, P extends GitDecimalParser> = V extends true
  ? P extends { default: string }
    ? 'default'
    : 'invalid'
  : V extends undefined
    ? 'dynamic'
    : V extends string | number | bigint
      ? string extends V
        ? 'dynamic'
        : `${number}` extends V
          ? 'dynamic'
          : `${bigint}` extends V
            ? 'dynamic'
            : number extends V
              ? 'dynamic'
              : bigint extends V
                ? 'dynamic'
                : V extends ''
                  ? P extends { empty: true }
                    ? After<'0', P>
                    : 'invalid'
                  : V extends number
                    ? AtMost<
                        `${V}` extends `-${infer R}` ? R : `${V}`,
                        '9007199254740991'
                      > extends true
                      ? Signed<Trim<`${V}`>, P>
                      : 'invalid'
                    : Signed<Trim<`${V}`>, P>
      : 'invalid';
export type GitDecimalLiteral<V, P extends GitDecimalParser> = Extract<
  Parsed<V, P>,
  'invalid'
> extends never
  ? true
  : false;
export type GitDecimalValue<V, P extends GitDecimalParser> = Parsed<V, P> extends infer S extends
  string
  ? S extends 'default'
    ? P extends { default: 'previous' }
      ? undefined
      : true
    : State<S>
  : never;

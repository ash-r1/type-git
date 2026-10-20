import type { NumberLiteralOrder } from './number-types.js';
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
type Clamp<M extends string, Negative extends boolean, Bits extends 32 | 64> = AtMost<
  M,
  Bits extends 32
    ? Negative extends true
      ? '2147483648'
      : '2147483647'
    : Negative extends true
      ? '9223372036854775808'
      : '9223372036854775807'
> extends true
  ? M
  : Negative extends true
    ? Bits extends 32
      ? '2147483648'
      : '9223372036854775808'
    : Bits extends 32
      ? '2147483647'
      : '9223372036854775807';
/** Selected C unsigned long conversion, including overflow saturation before negation. */
type UnsignedLong<
  M extends string,
  Negative extends boolean,
  Bits extends 32 | 64,
  NegateOverflow extends boolean,
> = AtMost<M, Bits extends 32 ? '4294967295' : '18446744073709551615'> extends true
  ? Negative extends true
    ? M extends '0'
      ? '0'
      : Subtract<Bits extends 32 ? '4294967296' : '18446744073709551616', M>
    : M
  : Negative extends true
    ? NegateOverflow extends true
      ? '1'
      : Bits extends 32
        ? '4294967295'
        : '18446744073709551615'
    : Bits extends 32
      ? '4294967295'
      : '18446744073709551615';
type Decimal<S extends string, Steps extends unknown[] = []> = string extends S
  ? 'dynamic'
  : Steps['length'] extends 128
    ? 'dynamic'
    : S extends ''
      ? true
      : S extends `${infer H}${infer R}`
        ? H extends Digit
          ? Decimal<R, [...Steps, 0]>
          : `${number}` extends H
            ? 'dynamic'
            : `${bigint}` extends H
              ? 'dynamic'
              : false
        : 'dynamic';
type After<S extends string, P extends GitDecimalParser> = P extends { clampNegativeToZero: true }
  ? S extends `-${string}`
    ? '0'
    : S
  : P extends { positive: true }
    ? S extends '0' | `-${string}`
      ? 'invalid'
      : S
    : P extends { nonzeroMinimum: 4 }
      ? S extends '1' | '2' | '3' | `-${string}`
        ? '4'
        : S
      : S;
type Convert<M extends string, Negative extends boolean, P extends GitDecimalParser> = P extends {
  unsignedLong: true;
}
  ? UnsignedLong<
      M,
      Negative,
      P['longBits'],
      P extends { negateUnsignedOverflow: true } ? true : false
    > extends infer U extends string
    ? P['conversion'] extends 'checked'
      ? AtMost<U, P['signed'] extends true ? '2147483647' : '4294967295'> extends true
        ? After<U, P>
        : 'invalid'
      : After<Narrow<U, false, P['signed']>, P>
    : never
  : P extends { beforeNonnegative: true }
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
  : After<Narrow<Clamp<M, Negative, P['longBits']>, Negative, P['signed']>, P>;
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
/** atoi accepts a decimal prefix and returns zero when there is no conversion. */
type DecimalPrefix<
  S extends string,
  Result extends string = '',
  Steps extends unknown[] = [],
> = string extends S
  ? 'dynamic'
  : Steps['length'] extends 128
    ? 'dynamic'
    : S extends `${infer H}${infer R}`
      ? H extends Digit
        ? DecimalPrefix<R, `${Result}${H}`, [...Steps, 0]>
        : Result extends ''
          ? '0'
          : Result
      : Result extends ''
        ? '0'
        : Result;
/** Stop as soon as a decimal prefix certainly saturates strtol; skip long zero runs. */
type PrefixCast<
  S extends string,
  Negative extends boolean,
  P extends GitDecimalParser,
  Acc extends string = '0',
  Steps extends unknown[] = [],
> = AtMost<
  Acc,
  P['longBits'] extends 32
    ? Negative extends true
      ? '2147483648'
      : '2147483647'
    : Negative extends true
      ? '9223372036854775808'
      : '9223372036854775807'
> extends false
  ? Converted<Acc, Negative, P>
  : string extends S
    ? 'dynamic'
    : Steps['length'] extends 128
      ? 'dynamic'
      : Acc extends '0'
        ? S extends `0000000000000000${infer Rest}`
          ? PrefixCast<Rest, Negative, P, Acc, [...Steps, 0]>
          : PrefixCastDigit<S, Negative, P, Acc, Steps>
        : PrefixCastDigit<S, Negative, P, Acc, Steps>;
type PrefixCastDigit<
  S extends string,
  Negative extends boolean,
  P extends GitDecimalParser,
  Acc extends string,
  Steps extends unknown[],
> = S extends `${infer H}${infer R}`
  ? H extends Digit
    ? PrefixCast<R, Negative, P, Strip<`${Acc}${H}`>, [...Steps, 0]>
    : `${number}` extends H
      ? 'dynamic'
      : `${bigint}` extends H
        ? 'dynamic'
        : Converted<Acc, Negative, P>
  : Converted<Acc, Negative, P>;
type SignedDigits<
  S extends string,
  Negative extends boolean,
  P extends GitDecimalParser,
> = P['conversion'] extends 'prefix-cast'
  ? PrefixCast<S, Negative, P>
  : P['conversion'] extends 'atoi'
    ? DecimalPrefix<S> extends infer M extends string
      ? M extends 'dynamic'
        ? 'dynamic'
        : Converted<Strip<M>, Negative, P>
      : never
    : Magnitude<S, Negative, P>;
type Signed<S extends string, P extends GitDecimalParser> = string extends S
  ? 'dynamic'
  : S extends `-${infer R}`
    ? P extends { rejectMinus: true }
      ? 'invalid'
      : SignedDigits<R, true, P>
    : SignedDigits<S extends `+${infer R}` ? R : S, false, P>;
type Parsed<V, P extends GitDecimalParser> = V extends true
  ? P extends { default: string }
    ? 'default'
    : 'invalid'
  : V extends undefined
    ? 'dynamic'
    : V extends string | number | bigint
      ? V extends `${string}\0${string}`
        ? 'invalid'
        : V extends object
          ? 'dynamic'
          : string extends V
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
                        ? P extends { conversion: 'prefix-cast' }
                          ? Signed<Trim<`${V}`>, P>
                          : NumberLiteralOrder<V, 9007199254740991> extends 1
                            ? 'invalid'
                            : NumberLiteralOrder<V, -9007199254740991> extends -1
                              ? 'invalid'
                              : Signed<Trim<`${V}`>, P>
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

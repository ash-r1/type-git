import type { GitDecimalLiteral, GitDecimalValue } from './git-decimal-types.js';
import type { AtMost, Digit, Reverse, State, Strip, Trim } from './git-integer-types.js';
import type { GitTimestampParser } from './git-timestamp.js';
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
type Unsigned<M extends string, Negative extends boolean> = Negative extends true
  ? M extends '0'
    ? '0'
    : Subtract<'18446744073709551616', M>
  : M;
type Decimal<
  S extends string,
  Acc extends string = '',
  Steps extends unknown[] = [],
> = string extends S
  ? 'dynamic'
  : Steps['length'] extends 128
    ? 'dynamic'
    : S extends `${infer H}${infer R}`
      ? H extends Digit
        ? Decimal<R, `${Acc}${H}`, [...Steps, 0]>
        : 'invalid'
      : Acc extends ''
        ? 'invalid'
        : Strip<Acc>;
type Checked<S extends string, Negative extends boolean> = Decimal<S> extends infer M extends string
  ? M extends 'invalid' | 'dynamic'
    ? M
    : AtMost<M, '18446744073709551615'> extends true
      ? Unsigned<M, Negative>
      : 'invalid'
  : never;
type Signed<S extends string> = S extends `-${infer R}`
  ? Checked<R, true>
  : Checked<S extends `+${infer R}` ? R : S, false>;
type LegacyParser<P extends GitTimestampParser> = {
  kind: 'decimal';
  conversion: 'atoi';
  empty: true;
  signed: true;
  bits: 32;
  longBits: P['longBits'];
};
type Legacy<V extends string, P extends GitTimestampParser> = GitDecimalLiteral<
  V,
  LegacyParser<P>
> extends true
  ? GitDecimalValue<V, LegacyParser<P>> extends infer N extends number | bigint
    ? number extends N
      ? 'dynamic'
      : bigint extends N
        ? 'dynamic'
        : `${N}` extends `-${infer M}`
          ? Unsigned<M, true>
          : `${N}`
    : never
  : 'invalid';
type Parsed<V, P extends GitTimestampParser> = V extends undefined
  ? 'dynamic'
  : V extends string | number | bigint
    ? V extends `${string}\0${string}`
      ? 'invalid'
      : string extends V
        ? 'dynamic'
        : number extends V
          ? 'dynamic'
          : bigint extends V
            ? 'dynamic'
            : P['conversion'] extends 'atoi'
              ? Legacy<`${V}`, P>
              : Signed<Trim<`${V}`>>
    : 'invalid';

/** Known invalid input-union arms remain invalid; budget-exceeding literals defer to runtime. */
export type GitTimestampLiteral<V, P extends GitTimestampParser> = Extract<
  Parsed<V, P>,
  'invalid'
> extends never
  ? true
  : false;
/** Timestamp states keep exact uintmax values instead of rounding through JavaScript numbers. */
export type GitTimestampValue<V, P extends GitTimestampParser> = Parsed<
  V,
  P
> extends infer S extends string
  ? State<S>
  : never;

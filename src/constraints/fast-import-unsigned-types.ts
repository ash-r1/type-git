import type { FastImportUnsignedParser } from './fast-import-unsigned.js';
import type { Digit, GitIntegerValue, Trim } from './git-integer-types.js';
import type { NumberLiteralOrder } from './number-types.js';
import type { UrlBytes } from './url-byte-types.js';

type Hex = Digit | 'a' | 'b' | 'c' | 'd' | 'e' | 'f';
type Ascii = UrlBytes[Extract<
  keyof UrlBytes,
  `${'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'}${Hex}`
>];
/** Check known forbidden characters before deferring a long or symbolic digit sequence. */
type Digits<
  S extends string,
  Allowed extends string,
  Seen extends boolean = false,
  Steps extends unknown[] = [],
> = S extends `${string}${Exclude<Ascii, Allowed>}${string}`
  ? false
  : string extends S
    ? true
    : Steps['length'] extends 128
      ? true
      : S extends ''
        ? Seen
        : S extends `${infer H}${infer R}`
          ? H extends Allowed
            ? Digits<R, Allowed, true, [...Steps, 0]>
            : `${number}` extends H
              ? true
              : `${bigint}` extends H
                ? true
                : false
          : true;
type Whitespace = ' ' | '\t' | '\r' | '\n' | '\v' | '\f';
// A symbolic prefix can still select hexadecimal or binary parsing. Only reject
// characters which cannot occur in any base-zero spelling before runtime lookup.
type UncertainBody<S extends string> = S extends `${string}${Whitespace}`
  ? false
  : S extends `${string}${Exclude<Ascii, Hex | Uppercase<Hex> | 'x' | 'X' | '+' | Whitespace>}${string}`
    ? false
    : true;
type Body<S extends string> = string extends S
  ? true
  : S extends `0${'x' | 'X'}${infer R}`
    ? Digits<R, Hex | Uppercase<Hex>>
    : S extends `0${'b' | 'B'}${infer R}`
      ? Digits<R, '0' | '1'>
      : S extends `0${infer R}`
        ? R extends `${infer H}${string}`
          ? {} extends Record<H, unknown>
            ? UncertainBody<S>
            : Digits<S, Exclude<Digit, '8' | '9'>>
          : Digits<S, Exclude<Digit, '8' | '9'>>
        : S extends `${infer H}${string}`
          ? {} extends Record<H, unknown>
            ? UncertainBody<S>
            : Digits<S, Digit>
          : false;
type UnsignedText<S extends string> =
  Trim<S> extends infer T extends string ? (T extends `+${infer R}` ? R : T) : never;
// Detect certain overflow before the shared converter reaches its recursion budget.
// Saturating either 32-bit or 64-bit unsigned long stays above these callback limits.
type Significant<S extends string, Steps extends unknown[] = []> = Steps['length'] extends 128
  ? string
  : S extends `0${infer R}`
    ? Significant<R, [...Steps, 0]>
    : S;
type TooLong<
  S extends string,
  Allowed extends string,
  Limit extends number,
  Steps extends unknown[] = [],
> = S extends `${infer H}${infer R}`
  ? H extends Allowed
    ? Steps['length'] extends Limit
      ? true
      : TooLong<R, Allowed, Limit, [...Steps, 0]>
    : false
  : false;
type CertainOverflow<S extends string> = S extends `0${'x' | 'X'}${infer R}`
  ? TooLong<Significant<R>, Hex | Uppercase<Hex>, 8>
  : S extends `0${'b' | 'B'}${infer R}`
    ? TooLong<Significant<R>, '0' | '1', 32>
    : S extends `0${infer R}`
      ? R extends `${infer H}${string}`
        ? H extends Digit
          ? TooLong<Significant<S>, Exclude<Digit, '8' | '9'>, 11>
          : false
        : false
      : S extends `${infer H}${string}`
        ? H extends Digit
          ? TooLong<S, Digit, 10>
          : false
        : false;
type BoundedValue<
  S extends string,
  Max extends number,
  N = GitIntegerValue<S, { kind: 'integer'; signed: false; bits: 32 }>,
> = [N] extends [never]
  ? false
  : N extends number
    ? NumberLiteralOrder<N, Max> extends 1
      ? false
      : true
    : bigint extends N
      ? true
      : false;
type Bounded<S extends string, Max extends number> = CertainOverflow<S> extends true
  ? false
  : BoundedValue<S, Max>;
type TextLiteral<
  S extends string,
  P extends FastImportUnsignedParser,
  T extends string = UnsignedText<S>,
> = Body<T> extends true
  ? P extends 'fast-import-active-branches'
    ? true
    : Bounded<T, P extends 'fast-import-depth' ? 8191 : 2147483647>
  : false;
/** Literal unions keep every invalid arm; opaque and nonliteral values retain runtime checks. */
export type FastImportUnsignedLiteral<V, P extends FastImportUnsignedParser> = V extends
  | string
  | number
  | bigint
  ? V extends object
    ? true
    : string extends V
      ? true
      : number extends V
        ? true
        : bigint extends V
          ? true
          : TextLiteral<`${V}`, P>
  : false;

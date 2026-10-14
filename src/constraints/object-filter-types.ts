import type { GitIntegerLiteral } from './git-integer-types.js';
/** Literal grammar; unsigned-long bounds and percent-decoded components are checked at runtime. */
type White = ' ' | '\t' | '\r' | '\n' | '\v' | '\f';
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type Hex = Digit | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
type Trim<
  S extends string,
  Seen extends readonly unknown[] = readonly [],
> = Seen['length'] extends 192
  ? string
  : S extends `${White}${infer R}`
    ? Trim<R, readonly [...Seen, unknown]>
    : S;
type Digits<
  S extends string,
  D extends string,
  Seen extends readonly unknown[] = readonly [],
> = Seen['length'] extends 192
  ? true // Longer input receives native-width and lexical validation at runtime.
  : string extends S
    ? true
    : `${number}` extends S
      ? true
      : S extends ''
        ? true
        : S extends `${D}${infer R}`
          ? Digits<R, D, readonly [...Seen, unknown]>
          : false;
type NonemptyDigits<S extends string, D extends string> = S extends '' ? false : Digits<S, D>;
type Unsigned<S extends string> = string extends S
  ? true
  : `${number}` extends S
    ? true
    : S extends `0${'x' | 'X'}${infer R}`
      ? NonemptyDigits<R, Hex>
      : S extends `0${'b' | 'B'}${infer R}`
        ? NonemptyDigits<R, '0' | '1'>
        : S extends `0${infer R}`
          ? Digits<R, Exclude<Digit, '8' | '9'>>
          : NonemptyDigits<S, Digit>;
type Unit<S extends string> = S extends `${infer R}${'k' | 'K' | 'm' | 'M' | 'g' | 'G'}`
  ? Unsigned<R>
  : Unsigned<S>;
type Positive<S extends string, Negative extends boolean> = Negative extends true
  ? GitIntegerLiteral<
      Trim<S>,
      { kind: 'integer'; signed: false; bits: 64; negativeMagnitudes: true }
    >
  : Trim<S> extends `+${infer R}`
    ? Unit<R>
    : Unit<Trim<S>>;
type Reserved =
  | White
  | '~'
  | '`'
  | '!'
  | '@'
  | '#'
  | '$'
  | '^'
  | '&'
  | '*'
  | '('
  | ')'
  | '['
  | ']'
  | '{'
  | '}'
  | '\\'
  | ';'
  | "'"
  | '"'
  | ','
  | '<'
  | '>'
  | '?';
type Child<S extends string, Negative extends boolean> = S extends ''
  ? true
  : S extends `${string}${Reserved}${string}`
    ? false
    : S extends `${string}%${string}`
      ? true
      : ObjectFilterLiteral<S, false, Negative>;
type Combined<S extends string, Negative extends boolean> = S extends `${infer L}+${infer R}`
  ? Child<L, Negative> extends true
    ? Combined<R, Negative>
    : false
  : Child<S, Negative>;
export type ObjectFilterLiteral<
  S extends string,
  Auto extends boolean = false,
  Negative extends boolean = false,
> = S extends object
  ? true
  : string extends S
    ? true
    : S extends
          | 'blob:none'
          | `sparse:oid=${string}`
          | `object:type=${'commit' | 'tree' | 'blob' | 'tag'}`
      ? true
      : S extends 'auto'
        ? Auto
        : S extends `blob:limit=${infer N}` | `tree:${infer N}`
          ? Positive<N, Negative>
          : S extends `combine:${infer R}`
            ? R extends ''
              ? false
              : Combined<R, Negative>
            : false;

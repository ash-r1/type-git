import type { GitIntegerLiteral } from './git-integer-types.js';
import type { ReservedControl, UrlBytes } from './url-byte-types.js';

type Reserved =
  | ReservedControl
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
type Hex =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f';
type Ascii = UrlBytes[Extract<
  keyof UrlBytes,
  `${'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'}${Hex}`
>];
/** Signed C char rejects high bytes before percent decoding; large/opaque words defer. */
type AsciiWord<S extends string, Steps extends unknown[] = []> = S extends object
  ? true
  : string extends S
    ? true
    : Steps['length'] extends 128
      ? true
      : S extends ''
        ? true
        : S extends `${infer H}${infer R}`
          ? H extends Ascii
            ? AsciiWord<R, [...Steps, 0]>
            : false
          : true;
// A bounded compiler walk defers large/dynamic inputs to the iterative runtime parser.
type Decode<
  S extends string,
  Out extends string = '',
  Steps extends unknown[] = [],
> = string extends S
  ? string
  : Steps['length'] extends 128
    ? string
    : S extends ''
      ? Out
      : S extends `%${infer A}${infer B}${infer R}`
        ? Lowercase<`${A}${B}`> extends keyof UrlBytes
          ? Decode<R, `${Out}${UrlBytes[Lowercase<`${A}${B}`>]}`, [...Steps, 0]>
          : Decode<S extends `%${infer Rest}` ? Rest : never, `${Out}%`, [...Steps, 0]>
        : S extends `${infer H}${infer R}`
          ? Decode<R, `${Out}${H}`, [...Steps, 0]>
          : string;
type Child<
  S extends string,
  Depth extends unknown[],
  Negative extends boolean,
  UnsignedChar extends boolean,
> = S extends ''
  ? true
  : S extends `${string}${Reserved}${string}`
    ? false
    : UnsignedChar extends false
      ? AsciiWord<S> extends false
        ? false
        : Parsed<
            S extends `${string}%${string}` ? Decode<S> : S,
            false,
            Negative,
            UnsignedChar,
            [...Depth, 0]
          >
      : Parsed<
          S extends `${string}%${string}` ? Decode<S> : S,
          false,
          Negative,
          UnsignedChar,
          [...Depth, 0]
        >;
type Combined<
  S extends string,
  Depth extends unknown[],
  Negative extends boolean,
  UnsignedChar extends boolean,
  Steps extends unknown[] = [],
> = string extends S
  ? true
  : Steps['length'] extends 128
    ? true
    : S extends `${infer L}+${infer R}`
      ? Child<L, Depth, Negative, UnsignedChar> extends true
        ? Combined<R, Depth, Negative, UnsignedChar, [...Steps, 0]>
        : false
      : Child<S, Depth, Negative, UnsignedChar>;
type Parsed<
  S extends string,
  Auto extends boolean,
  Negative extends boolean,
  UnsignedChar extends boolean,
  Depth extends unknown[] = [],
> = S extends object
  ? true
  : string extends S
    ? true
    : Depth['length'] extends 32
      ? true
      : S extends
            | 'blob:none'
            | `sparse:oid=${string}`
            | `object:type=${'commit' | 'tree' | 'blob' | 'tag'}`
        ? true
        : S extends 'auto'
          ? Auto
          : S extends `blob:limit=${infer N}` | `tree:${infer N}`
            ? GitIntegerLiteral<
                N,
                { kind: 'integer'; signed: false; bits: 64; negativeMagnitudes: Negative }
              >
            : S extends `combine:${infer R}`
              ? R extends ''
                ? false
                : Combined<R, Depth, Negative, UnsignedChar>
              : false;
export type ObjectFilterLiteral<
  S extends string,
  Auto extends boolean = false,
  Negative extends boolean = false,
  UnsignedChar extends boolean = true,
> = false extends (
  S extends `${string}\0${string}`
    ? false
    : Parsed<S, Auto, Negative, UnsignedChar>
)
  ? false
  : true;

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
type Child<S extends string, Depth extends unknown[]> = S extends ''
  ? true
  : S extends `${string}${Reserved}${string}`
    ? false
    : Parsed<S extends `${string}%${string}` ? Decode<S> : S, false, [...Depth, 0]>;
type Combined<
  S extends string,
  Depth extends unknown[],
  Steps extends unknown[] = [],
> = string extends S
  ? true
  : Steps['length'] extends 128
    ? true
    : S extends `${infer L}+${infer R}`
      ? Child<L, Depth> extends true
        ? Combined<R, Depth, [...Steps, 0]>
        : false
      : Child<S, Depth>;
type Parsed<S extends string, Auto extends boolean, Depth extends unknown[] = []> = string extends S
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
          ? GitIntegerLiteral<N, { kind: 'integer'; signed: false; bits: 64 }>
          : S extends `combine:${infer R}`
            ? R extends ''
              ? false
              : Combined<R, Depth>
            : false;
export type ObjectFilterLiteral<
  S extends string,
  Auto extends boolean = false,
> = false extends Parsed<S, Auto> ? false : true;

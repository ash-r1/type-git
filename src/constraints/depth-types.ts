/** Prove only a nonzero decimal prefix; overflow/atoi profiles remain runtime checks. */
type White = ' ' | '\t' | '\r' | '\n' | '\v' | '\f';
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type Prefix<
  S extends string,
  Nonzero extends boolean = false,
  Seen extends readonly unknown[] = readonly [],
> = Seen['length'] extends 192
  ? true
  : S extends ''
    ? Nonzero
    : S extends `${infer H}${infer R}`
      ? string extends H
        ? true
        : {} extends Record<H, unknown>
          ? true
          : H extends Digit
            ? Prefix<R, H extends '0' ? Nonzero : true, readonly [...Seen, unknown]>
            : Nonzero
      : {} extends Record<S, unknown>
        ? true
        : Nonzero;
type Trim<
  S extends string,
  Seen extends readonly unknown[] = readonly [],
> = Seen['length'] extends 192
  ? string
  : S extends `${White}${infer R}`
    ? Trim<R, readonly [...Seen, unknown]>
    : S;
type Text<S extends string> = S extends object
  ? true
  : string extends S
    ? true
    : Trim<S> extends `${'+' | '-'}${infer R}`
      ? Prefix<R>
      : Prefix<Trim<S>>;
export type DepthInitialLiteral<V> = V extends string
  ? Text<V>
  : V extends number
    ? number extends V
      ? true
      : V extends 0
        ? false
        : true
    : true;

/** Check only repository-independent numeric failures in Git's deferred line-range parser. */
export function validBlameLineRange(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const prefix = /^[ \t\r\n\v\f]*([+-]?)([0-9]+)/;
  const start = prefix.exec(value);
  if (start && (start[1] === '-' || !/[1-9]/.test(start[2]!))) {
    return false;
  }
  const rest = start ? value.slice(start[0].length) : value;
  if (!rest.startsWith(',')) {
    return true;
  }
  const end = rest.slice(1);
  const relative = end.startsWith('+') || end.startsWith('-');
  const parsed = prefix.exec(relative ? end.slice(1) : end);
  // Regex/function-name syntax and unrecognized suffixes remain native-owned.
  return !parsed || (/[1-9]/.test(parsed[2]!) && (relative || parsed[1] !== '-'));
}

type White = ' ' | '\t' | '\r' | '\n' | '\v' | '\f';
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type Deferred = { deferred: true };
type Digits<
  S extends string,
  Negative extends boolean,
  Zero extends boolean = true,
  Seen extends boolean = false,
  N extends readonly unknown[] = [],
> = string extends S
  ? Deferred
  : N['length'] extends 128
    ? Deferred
    : S extends `${infer C}${infer R}`
      ? C extends Digit
        ? Digits<R, Negative, C extends '0' ? Zero : false, true, readonly [...N, 0]>
        : Seen extends true
          ? { negative: Negative; zero: Zero; rest: S }
          : { none: true }
      : Seen extends true
        ? { negative: Negative; zero: Zero; rest: '' }
        : { none: true };
type Prefix<S extends string, N extends readonly unknown[] = []> = string extends S
  ? Deferred
  : N['length'] extends 128
    ? Deferred
    : S extends `${White}${infer R}`
      ? Prefix<R, readonly [...N, 0]>
      : S extends `-${infer R}`
        ? Digits<R, true>
        : S extends `+${infer R}`
          ? Digits<R, false>
          : Digits<S, false>;
type End<P, Relative extends boolean> = P extends { zero: true }
  ? false
  : Relative extends false
    ? P extends { negative: true }
      ? false
      : true
    : true;
type Tail<S extends string> = S extends `,${infer E}`
  ? E extends `+${infer R}` | `-${infer R}`
    ? End<Prefix<R>, true>
    : End<Prefix<E>, false>
  : true;
type Parsed<S extends string> = string extends S
  ? true
  : `${number}` extends S
    ? true
    : `${bigint}` extends S
      ? true
      : Prefix<S> extends infer P
        ? P extends { deferred: true }
          ? true
          : P extends { negative: true } | { zero: true }
            ? false
            : P extends { rest: infer R extends string }
              ? Tail<R>
              : Tail<S>
        : true;
/** Reject every known invalid alternative; dynamic or compiler-budget-exceeding text defers to Git. */
export type BlameLineRangeLiteral<V> = [V] extends [string]
  ? false extends (V extends string ? Parsed<V> : false)
    ? false
    : true
  : false;

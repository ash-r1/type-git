/**
 * The repository-independent part of `git log -L <range>:<file>` (and `git show -L`).
 *
 * Git 2.55.0 line-log.c:parse_lines first scans the range with line-range.c:skip_range_arg and
 * requires a ':' followed by a nonempty file name after it. It then resolves the file in the
 * commit and parses the range again with parse_range_arg, which refuses a nonpositive absolute
 * line number and a zero relative length. Regular expressions (`/regex/`, `:funcname`), ranges
 * past the end of the file and the file itself are checked against the repository and stay with
 * Git. A backslash that ends a `/regex/` scan makes Git read past the end of the argument, so it
 * is refused here. Numbers follow the pinned LP64 profile (64-bit long).
 */

const WHITE = ' \t\n\v\f\r';

/** LONG_MAX of the pinned LP64 profile; strtol saturates there. */
const LONG_MAX = 9223372036854775807n;

/** strtol over ASCII text: the end of the conversion and its sign, or undefined when none. */
function strtol(
  text: string,
  start: number,
): { end: number; positive: boolean; saturated: boolean } | undefined {
  let index = start;
  while (index < text.length && WHITE.includes(text[index]!)) {
    index++;
  }
  let negative = false;
  if (text[index] === '+' || text[index] === '-') {
    negative = text[index] === '-';
    index++;
  }
  const digits = index;
  let nonzero = false;
  while (index < text.length && text[index]! >= '0' && text[index]! <= '9') {
    nonzero ||= text[index] !== '0';
    index++;
  }
  if (index === digits) {
    return undefined;
  }
  const saturated = !negative && BigInt(text.slice(digits, index)) >= LONG_MAX;
  return { end: index, positive: nonzero && !negative, saturated };
}

/** line-range.c:parse_loc in scan-only mode; undefined when the scan reads past the argument. */
function scanLocation(text: string, start: number, first: boolean): number | undefined {
  if (strtol(text, start)) {
    return strtol(text, start)!.end;
  }
  let spec = start;
  if (first && text[spec] === '^') {
    spec++;
  }
  if (text[spec] !== '/') {
    return spec;
  }
  let term = spec + 1;
  while (term < text.length && text[term] !== '/') {
    if (text[term] === '\\') {
      term++;
      if (term >= text.length) {
        return undefined;
      }
    }
    term++;
  }
  return text[term] === '/' ? term + 1 : spec;
}

/** line-range.c:skip_range_arg; null for an empty function name, undefined past the end. */
function skipRange(text: string): number | null | undefined {
  if (text[0] === ':' || (text[0] === '^' && text[1] === ':')) {
    const colon = text[0] === '^' ? 1 : 0;
    let term = colon + 1;
    while (term < text.length && text[term] !== ':') {
      if (text[term] === '\\' && term + 1 < text.length) {
        term++;
      }
      term++;
    }
    return term === colon + 1 ? null : term;
  }
  const first = scanLocation(text, 0, true);
  if (first === undefined || text[first] !== ',') {
    return first;
  }
  return scanLocation(text, first + 1, false);
}

/** parse_range_arg's argv-determined refusals for a numeric range that skip_range_arg accepted. */
function validNumbers(range: string): boolean {
  if (range.startsWith(':') || range.startsWith('^:')) {
    return true;
  }
  const first = strtol(range, 0);
  if (first && !first.positive) {
    return false;
  }
  const comma = first ? first.end : (scanLocation(range, 0, true) ?? range.length);
  if (range[comma] !== ',') {
    return true;
  }
  const second = range.slice(comma + 1);
  // A relative end is anchored at the start plus one; at LONG_MAX that sum overflows to a
  // negative anchor, so Git reads a relative end as an absolute line number.
  if ((second.startsWith('+') || second.startsWith('-')) && !first?.saturated) {
    const length = strtol(second, 1);
    return !length || /[1-9]/.test(second.slice(1, length.end));
  }
  const end = strtol(second, 0);
  return !end || end.positive;
}

/** Whether Git 2.55.0 accepts one -L argument before reading the repository. */
export function validLogLineRange(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const name = skipRange(value);
  if (name === null || name === undefined || value[name] !== ':' || name + 1 >= value.length) {
    return false;
  }
  return validNumbers(value.slice(0, name));
}

type White = ' ' | '\t' | '\n' | '\v' | '\f' | '\r';
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type None = { none: true };
type Past = { past: true };
type SkipWhite<S extends string> = S extends `${White}${infer R}` ? SkipWhite<R> : S;
type Digits<
  S extends string,
  Negative extends boolean,
  Nonzero extends boolean = false,
  Text extends string = '',
> = S extends `${infer C}${infer R}`
  ? C extends Digit
    ? Digits<R, Negative, C extends '0' ? Nonzero : true, `${Text}${C}`>
    : Text extends ''
      ? None
      : {
          rest: S;
          positive: Negative extends true ? false : Nonzero;
          digits: Text;
          negative: Negative;
        }
  : Text extends ''
    ? None
    : {
        rest: '';
        positive: Negative extends true ? false : Nonzero;
        digits: Text;
        negative: Negative;
      };
type StripZeros<S extends string> = S extends `0${infer R}` ? StripZeros<R> : S;
type Length<S extends string, N extends readonly unknown[] = []> = S extends `${string}${infer R}`
  ? Length<R, readonly [...N, 0]>
  : N['length'];
type DigitOrder = '0123456789';
/** Whether digit A is at least digit B. */
type DigitAtLeast<
  A extends string,
  B extends string,
> = DigitOrder extends `${string}${B}${string}${A}${string}` ? true : A extends B ? true : false;
/** Whether equal-length digit strings compare A >= B. */
type AtLeast<A extends string, B extends string> = A extends `${infer X}${infer RestA}`
  ? B extends `${infer Y}${infer RestB}`
    ? X extends Y
      ? AtLeast<RestA, RestB>
      : DigitAtLeast<X, Y>
    : true
  : true;
/** strtol saturates a nonnegative value at LONG_MAX of the pinned LP64 profile. */
type Saturated<D extends string> =
  Length<StripZeros<D>> extends infer L extends number
    ? L extends 19
      ? AtLeast<StripZeros<D>, '9223372036854775807'>
      : `${L}` extends
            | `${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
            | `1${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`
        ? false
        : true
    : true;
type Strtol<S extends string> =
  SkipWhite<S> extends `-${infer R}`
    ? Digits<R, true>
    : SkipWhite<S> extends `+${infer R}`
      ? Digits<R, false>
      : Digits<SkipWhite<S>, false>;
type ScanRegex<S extends string> = S extends `/${infer R}`
  ? { rest: R }
  : S extends `\\${infer _}${infer R}`
    ? ScanRegex<R>
    : S extends '\\'
      ? Past
      : S extends `${infer _}${infer R}`
        ? ScanRegex<R>
        : None;
type ScanSlash<S extends string> = S extends `/${infer T}`
  ? ScanRegex<T> extends infer Scanned
    ? Scanned extends { rest: string } | Past
      ? Scanned
      : { rest: S }
    : never
  : { rest: S };
type ScanLocation<S extends string, First extends boolean> = Strtol<S> extends {
  rest: infer R extends string;
}
  ? { rest: R }
  : First extends true
    ? S extends `^${infer R}`
      ? ScanSlash<R>
      : ScanSlash<S>
    : ScanSlash<S>;
type ScanName<S extends string, Seen extends boolean = false> = S extends `:${string}`
  ? Seen extends true
    ? { rest: S }
    : None
  : S extends `\\${infer _}${infer R}`
    ? ScanName<R, true>
    : S extends `${infer _}${infer R}`
      ? ScanName<R, true>
      : Seen extends true
        ? { rest: '' }
        : None;
type FileFollows<R> = R extends { rest: `:${infer F}` } ? (F extends '' ? false : true) : false;
type FirstNumber<S extends string> = Strtol<S> extends { positive: false } ? false : true;
type FirstSaturated<S extends string> =
  Strtol<S> extends { negative: false; digits: infer D extends string } ? Saturated<D> : false;
type SecondNumber<S extends string, Absolute extends boolean> = Absolute extends true
  ? FirstNumber<S>
  : S extends `${'+' | '-'}${infer D}`
    ? Digits<D, false> extends { positive: false }
      ? false
      : true
    : FirstNumber<S>;
type Numeric<S extends string> =
  ScanLocation<S, true> extends { rest: infer R extends string }
    ? R extends `,${infer Second}`
      ? FirstNumber<S> extends true
        ? SecondNumber<Second, FirstSaturated<S>> extends true
          ? FileFollows<ScanLocation<Second, false>>
          : false
        : false
      : FirstNumber<S> extends true
        ? FileFollows<{ rest: R }>
        : false
    : false;
type Parsed<S extends string> = string extends S
  ? true
  : // biome-ignore lint/complexity/noBannedTypes: '{}' detects template patterns, which are not singleton keys.
    {} extends Record<S, unknown>
    ? true // A template pattern such as `${number},2:a` is checked at runtime.
    : S extends `:${infer P}` | `^:${infer P}`
      ? FileFollows<ScanName<P>>
      : Numeric<S>;
/** Reject every known invalid -L literal; dynamic text is checked at runtime. */
export type LogLineRangeLiteral<V> = [V] extends [string]
  ? false extends (V extends string ? Parsed<V> : false)
    ? false
    : true
  : false;

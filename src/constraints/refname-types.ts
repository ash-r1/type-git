/** Type-level mirror of refname.ts:branchNameSyntax for literal branch names. */
type ControlCharacter =
  | '\x00'
  | '\x01'
  | '\x02'
  | '\x03'
  | '\x04'
  | '\x05'
  | '\x06'
  | '\x07'
  | '\x08'
  | '\x09'
  | '\x0a'
  | '\x0b'
  | '\x0c'
  | '\x0d'
  | '\x0e'
  | '\x0f'
  | '\x10'
  | '\x11'
  | '\x12'
  | '\x13'
  | '\x14'
  | '\x15'
  | '\x16'
  | '\x17'
  | '\x18'
  | '\x19'
  | '\x1a'
  | '\x1b'
  | '\x1c'
  | '\x1d'
  | '\x1e'
  | '\x1f'
  | '\x7f';
type ForbiddenRefnameText =
  | ControlCharacter
  | ' '
  | '*'
  | ':'
  | '?'
  | '['
  | '\\'
  | '^'
  | '~'
  | '..'
  | '/.'
  | '//'
  | '.lock/';
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type Digits<S extends string> = S extends ''
  ? true
  : S extends `${Digit}${infer R}`
    ? Digits<R>
    : false;
/** strtol text that is a positive decimal: leading spaces, an optional '+', then digits. */
type PositiveDecimal<S extends string> =
  S extends `${' ' | '\t' | '\n' | '\v' | '\f' | '\r'}${infer R}`
    ? PositiveDecimal<R>
    : S extends `+${infer R}`
      ? PositiveDigits<R>
      : PositiveDigits<S>;
type PositiveDigits<S extends string> = S extends `0${infer R}`
  ? PositiveDigits<R>
  : S extends `${Exclude<Digit, '0'>}${infer R}`
    ? Digits<R>
    : false;
/** The original text after the first @{upstream}, @{u} or @{push} mark, matched case-insensitively. */
type AfterMark<S extends string> = S extends `@{${infer Body}}${infer R}`
  ? Lowercase<Body> extends 'u' | 'upstream' | 'push'
    ? R
    : S extends `${infer _C}${infer Rest}`
      ? AfterMark<Rest>
      : never
  : S extends `${infer _C}${infer Rest}`
    ? AfterMark<Rest>
    : never;
/** The literal text after the last rewritable mark. */
type LastTail<S extends string> = [AfterMark<S>] extends [never] ? S : LastTail<AfterMark<S>>;
/** The literal tail after the rewritable parts, or never when nothing can be rewritten. */
type InterpretedTail<V extends string> = V extends `@{-${infer N}}${infer R}`
  ? PositiveDecimal<N> extends true
    ? LastTail<R>
    : [AfterMark<V>] extends [never]
      ? never
      : LastTail<V>
  : [AfterMark<V>] extends [never]
    ? never
    : LastTail<V>;
type RefnameFormat<R extends string> = R extends `${string}${ForbiddenRefnameText}${string}`
  ? false
  : R extends `${string}${'/' | '.' | '.lock'}`
    ? false
    : R extends `${string}@{${string}`
      ? false
      : true;

/** `true` unless a literal name is refused by check_branch_ref in every repository. */
export type BranchNameLiteral<V> = V extends string
  ? string extends V
    ? true
    : V extends `-${string}` | 'HEAD'
      ? false
      : V extends `${string}@{${string}`
        ? [InterpretedTail<V>] extends [never]
          ? false
          : V extends `${string}:${string}`
            ? false
            : RefnameFormat<`refs/heads/x${InterpretedTail<V>}`>
        : RefnameFormat<`refs/heads/${V}`>
  : false;

/** check_refname_format(REFNAME_ALLOW_ONELEVEL) for literal refs; no interpretation. */
export type RefnameOnelevelLiteral<V> = V extends string
  ? string extends V
    ? true
    : V extends '' | '@' | `${'.' | '/'}${string}`
      ? false
      : RefnameFormat<V>
  : false;

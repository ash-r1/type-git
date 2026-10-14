export type AsciiUpper =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z';
// Validate the supplied literal instead of enumerating 2^N enum spellings.
export type AsciiLower<S extends string, Result extends string = ''> = string extends S
  ? string
  : S extends object
    ? string // Opaque branded strings are nonliteral inputs, like ordinary string.
    : S extends `${infer H}${infer R}`
      ? AsciiLower<R, `${Result}${H extends AsciiUpper ? Lowercase<H> : H}`>
      : `${Result}${S}`;

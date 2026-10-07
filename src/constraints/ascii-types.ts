type AsciiUpper =
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
export type AsciiLower<S extends string> = string extends S
  ? string
  : S extends `${infer H}${infer R}`
    ? `${H extends AsciiUpper ? Lowercase<H> : H}${AsciiLower<R>}`
    : S;

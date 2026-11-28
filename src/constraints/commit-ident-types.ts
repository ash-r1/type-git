/** Type-level mirror of commit-ident.ts:validCommitAuthor for literal --author values. */
type Crud =
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
  | ' '
  | ','
  | ':'
  | ';'
  | '<'
  | '>'
  | '"'
  | '\\'
  | "'";
/** Whether the name text before '<' has a character that ident.c does not strip as crud. */
type HasNonCrud<S extends string> = S extends `${infer C}${infer R}`
  ? C extends Crud
    ? HasNonCrud<R>
    : true
  : false;

/** `true` unless a literal --author value is refused by split_ident_line or fmt_ident. */
export type CommitAuthorLiteral<V> = V extends string
  ? string extends V
    ? true
    : V extends `${string}>${string}`
      ? V extends `${infer Name}<${infer Rest}`
        ? Rest extends `${string}>${string}`
          ? HasNonCrud<Name>
          : false
        : false
      : true
  : false;

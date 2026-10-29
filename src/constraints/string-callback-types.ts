import type { StringCallbackParser } from './string-callback.js';
import type { UrlBytes } from './url-byte-types.js';
import type { STRING_CALLBACKS } from './string-callbacks.generated.js';

type HexDigit =
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
type AsciiByte = UrlBytes[Extract<
  keyof UrlBytes,
  `${'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'}${HexDigit}`
>];
type Profile<P extends StringCallbackParser> = (typeof STRING_CALLBACKS)[P];
type Dynamic<S extends string, N extends readonly unknown[] = []> = {} extends Record<S, unknown>
  ? true
  : `${number}` extends S
    ? true
    : `${bigint}` extends S
      ? true
      : N['length'] extends 128
        ? true
        : S extends `${infer _C}${infer R}`
          ? Dynamic<R, readonly [...N, 0]>
          : S extends ''
            ? false
            : true;
// Walk to the FIRST separator. A symbolic prefix may itself contain separators,
// so a template such as `${string}:` must not be rejected as an empty right side.
type Pair<
  S extends string,
  Sep extends string,
  Optional extends boolean,
  Seen extends boolean = false,
  N extends readonly unknown[] = [],
> = string extends S
  ? true
  : N['length'] extends 128
    ? true
    : S extends `${Sep}${infer Rest}`
      ? Seen extends false
        ? false
        : Rest extends ''
          ? false
          : true
      : S extends ''
        ? Optional extends true
          ? Seen
          : false
        : S extends `${infer C}${infer Rest}`
          ? string extends C
            ? true
            : Pair<Rest, Sep, Optional, true, readonly [...N, 0]>
          : true;
type TokenProjection<P, T extends string, Value> = P extends { projection: { values: infer M } }
  ? T extends keyof M
    ? M[T]
    : Value
  : Value;
type TokenList<
  S extends string,
  P,
  Value,
  Token extends string = '',
  N extends readonly unknown[] = [],
> = N['length'] extends 128
  ? { valid: true; value: string }
  : P extends { separators: readonly (infer Sep)[]; exact: readonly (infer E)[] }
    ? S extends `${infer C}${infer Rest}`
      ? C extends Sep
        ? Token extends ''
          ? TokenList<Rest, P, Value, '', readonly [...N, 0]>
          : Token extends E
            ? TokenList<Rest, P, TokenProjection<P, Token, Value>, '', readonly [...N, 0]>
            : { valid: false }
        : TokenList<Rest, P, Value, `${Token}${C}`, readonly [...N, 0]>
      : Token extends ''
        ? { valid: true; value: Value }
        : Token extends E
          ? { valid: true; value: TokenProjection<P, Token, Value> }
          : { valid: false }
    : { valid: false };
type Projected<V, P extends StringCallbackParser> = Profile<P> extends {
  kind: 'token-list';
  projection: { initial: infer Initial };
}
  ? V extends string
    ? V extends object
      ? { valid: true; value: string }
      : Dynamic<V> extends true
        ? { valid: true; value: string }
        : TokenList<V, Profile<P>, Initial>
    : { valid: false }
  : { valid: true; value: V };
export type StringCallbackValue<V, P extends StringCallbackParser> = Projected<V, P> extends {
  value: infer Value;
}
  ? Value
  : V;
// Inspect at most two concrete code units; long literals cannot become budget fallbacks.
type ByteCharacter<S extends string> = S extends `${infer First}${infer Rest}`
  ? Dynamic<First> extends true
    ? true
    : First extends AsciiByte
      ? Rest extends ''
        ? true
        : Rest extends `${infer Second}${infer _Tail}`
          ? Dynamic<Second>
          : true
      : false
  : true;
type AsciiWhitespace = ' ' | '\t' | '\n' | '\r' | '\v' | '\f';
type TrimAsciiLeft<S extends string> = S extends `${AsciiWhitespace}${infer Rest}`
  ? TrimAsciiLeft<Rest>
  : S;
type TrimAsciiRight<S extends string> = S extends `${infer Rest}${AsciiWhitespace}`
  ? TrimAsciiRight<Rest>
  : S;
type ResetState = { ordinary: boolean; exclusive: boolean; invalid: boolean };
type ResetToken<P, Token extends string, State extends ResetState> = P extends {
  reset: infer Reset;
  ordinary: readonly (infer Ordinary)[];
  exclusive: readonly (infer Exclusive)[];
}
  ? TrimAsciiRight<TrimAsciiLeft<Token>> extends infer Text
    ? Text extends Reset
      ? { ordinary: false; exclusive: false; invalid: false }
      : Text extends Ordinary
        ? { ordinary: true; exclusive: State['exclusive']; invalid: State['invalid'] }
        : Text extends Exclusive
          ? { ordinary: State['ordinary']; exclusive: true; invalid: State['invalid'] }
          : { ordinary: State['ordinary']; exclusive: State['exclusive']; invalid: true }
    : never
  : { ordinary: false; exclusive: false; invalid: true };
type ResetStateValid<State extends ResetState> = State['invalid'] extends true
  ? false
  : State['ordinary'] extends true
    ? State['exclusive'] extends true
      ? false
      : true
    : true;
type ResetTokenList<
  S extends string,
  P,
  Token extends string = '',
  State extends ResetState = { ordinary: false; exclusive: false; invalid: false },
  N extends readonly unknown[] = [],
> = N['length'] extends 128
  ? true
  : P extends { separator: infer Separator }
    ? S extends `${infer C}${infer Rest}`
      ? C extends Separator
        ? ResetTokenList<Rest, P, '', ResetToken<P, Token, State>, readonly [...N, 0]>
        : ResetTokenList<Rest, P, `${Token}${C}`, State, readonly [...N, 0]>
      : ResetStateValid<ResetToken<P, Token, State>>
    : false;
type TrailingTokenList<
  S extends string,
  Separator extends string,
  Exact extends string,
  N extends readonly unknown[] = [],
> = N['length'] extends 128
  ? true
  : S extends `${infer Token}${Separator}${infer Rest}`
    ? Token extends Exact
      ? TrailingTokenList<Rest, Separator, Exact, readonly [...N, 0]>
      : false
    : S extends '' | Exact
      ? true
      : false;
type DirstatDigits<S extends string> = S extends ''
  ? true
  : S extends `${ScoreDigit}${infer Rest}`
    ? DirstatDigits<Rest>
    : false;
type DirstatToken<S extends string, Exact extends string> = S extends Exact
  ? true
  : S extends `${ScoreDigit}${string}`
    ? S extends `${infer Whole}.${infer Fraction}`
      ? false extends DirstatDigits<Whole> | DirstatDigits<Fraction>
        ? false
        : true
      : DirstatDigits<S>
    : false;
type DirstatTokens<
  S extends string,
  Separator extends string,
  Exact extends string,
> = S extends `${infer Token}${Separator}${infer Rest}`
  ? DirstatToken<Token, Exact> extends true
    ? DirstatTokens<Rest, Separator, Exact>
    : false
  : DirstatToken<S, Exact>;
type CharacterMembers<S extends string> = S extends `${infer C}${infer Rest}`
  ? C | CharacterMembers<Rest>
  : never;
type CharacterSetLoop<
  S extends string,
  Allowed extends string,
  N extends readonly unknown[] = [],
> = N['length'] extends 128
  ? true
  : S extends `${infer C}${infer Rest}`
    ? C extends Allowed
      ? CharacterSetLoop<Rest, Allowed, readonly [...N, 0]>
      : false
    : true;
// Reject known forbidden ASCII even beyond the finite literal-analysis budget.
type CharacterSetText<
  S extends string,
  Characters extends string,
> = S extends `${string}${Exclude<AsciiByte, CharacterMembers<Characters>>}${string}`
  ? false
  : Dynamic<S> extends true
    ? true
    : CharacterSetLoop<S, CharacterMembers<Characters>>;
type ScoreDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type ScoreForbiddenAscii = Exclude<AsciiByte, ScoreDigit | '.' | '%'>;
type ScoreLoop<
  S extends string,
  Dot extends boolean = false,
  N extends readonly unknown[] = [],
> = N['length'] extends 128
  ? true
  : S extends '' | '%'
    ? true
    : S extends `.${infer Rest}`
      ? Dot extends true
        ? false
        : ScoreLoop<Rest, true, readonly [...N, 0]>
      : S extends `${infer C}${infer Rest}`
        ? C extends ScoreDigit
          ? ScoreLoop<Rest, Dot, readonly [...N, 0]>
          : false
        : true;
// Reject guaranteed malformed ASCII and punctuation before the shared dynamic/budget escape hatch.
type ScoreHasFollowingPercentText<S extends string> = S extends `${string}%${infer After}`
  ? After extends ''
    ? false
    : After extends `${infer First}${infer _Rest}`
      ? Dynamic<First> extends false
        ? true
        : false
      : false
  : false;
type ScorePart<S extends string> = S extends `${string}${ScoreForbiddenAscii}${string}`
  ? false
  : S extends `${string}.${string}.${string}` | `${string}%${string}%${string}`
    ? false
    : ScoreHasFollowingPercentText<S> extends true
      ? false
      : Dynamic<S> extends true
        ? true
        : ScoreLoop<S>;
type ScoreText<S extends string, Parts extends 1 | 2> = Parts extends 2
  ? S extends `${infer Left}/${infer Right}`
    ? false extends ScorePart<Left> | ScorePart<Right>
      ? false
      : true
    : ScorePart<S>
  : ScorePart<S>;
type Parsed<V, P extends StringCallbackParser> = V extends string
  ? V extends object
    ? true
    : Profile<P> extends { kind: 'byte-character' }
      ? ByteCharacter<V>
      : Profile<P> extends { kind: 'token-list' }
        ? Projected<V, P> extends { valid: infer Valid }
          ? Valid
          : false
        : Profile<P> extends {
              kind: 'choice';
              exact: readonly (infer E)[];
              prefixes: readonly (infer Prefix extends string)[];
            }
          ? V extends E | `${Prefix}${string}`
            ? true
            : Dynamic<V>
          : Profile<P> extends {
                kind: 'first-separator';
                separator: infer Sep extends string;
                allowUnseparated: infer Optional extends boolean;
              }
            ? Pair<V, Sep, Optional>
            : Profile<P> extends { kind: 'rename-score'; parts: infer Parts extends 1 | 2 }
              ? ScoreText<V, Parts>
              : Profile<P> extends {
                    kind: 'character-set';
                    characters: infer Characters extends string;
                  }
                ? CharacterSetText<V, Characters>
                : Profile<P> extends { kind: 'resetting-token-list' }
                  ? Dynamic<V> extends true
                    ? true
                    : ResetTokenList<V, Profile<P>>
                  : Profile<P> extends {
                        kind: 'trailing-token-list';
                        separator: infer Separator extends string;
                        exact: readonly (infer Exact extends string)[];
                      }
                    ? Dynamic<V> extends true
                      ? true
                      : TrailingTokenList<V, Separator, Exact>
                    : Profile<P> extends {
                          kind: 'dirstat-params';
                          separator: infer Separator extends string;
                          exact: readonly (infer Exact extends string)[];
                        }
                      ? Dynamic<V> extends true
                        ? true
                        : V extends ''
                          ? true
                          : DirstatTokens<V, Separator, Exact>
                      : false
  : V extends true
    ? Profile<P> extends { kind: 'rename-score' | 'dirstat-params' }
      ? true
      : false
    : false;
export type StringCallbackLiteral<V, P extends StringCallbackParser> = false extends Parsed<V, P>
  ? false
  : true;

import type { PushRefspecParser } from './push-refspecs.js';

/** Characters check_refname_format always refuses; ':' and '*' depend on the refspec shape. */
type RefnameCharacter = ' ' | '~' | '^' | '?' | '[' | '\\' | '\t' | '\n' | '\x7f';
/** Certain refusals of check_refname_format for the text after `refs/<x>/`; others stay runtime. */
type RefnameTailInvalid<V extends string> = V extends
  | ''
  | `.${string}`
  | `/${string}`
  | `${string}/`
  | `${string}.`
  | `${string}//${string}`
  | `${string}/.${string}`
  | `${string}..${string}`
  | `${string}@{${string}`
  | `${string}.lock`
  | `${string}.lock/${string}`
  | `${string}${RefnameCharacter}${string}`
  ? true
  : false;
/**
 * A literal tag name whose expanded refspec parse_refspec refuses. A name with ':' splits the
 * refspec differently per command and stays runtime, as do wide strings.
 */
type TagNameInvalid<W> = W extends string
  ? string extends W
    ? false
    : W extends `${string}:${string}`
      ? false
      : RefnameTailInvalid<W>
  : false;
/** A word that set_refspecs cannot accept under --delete; wide strings stay unknown. */
type DeleteWordInvalid<W> = W extends string
  ? string extends W
    ? false
    : W extends '' | '@' | `${string}:${string}` | `${string}*${string}`
      ? true
      : RefnameTailInvalid<W>
  : false;
/**
 * Walk refspec words: `tag` consumes the next word. A word that may be `tag` (a wide string or
 * a union that includes it) and unknown lengths stay accepted for the runtime check.
 */
type Words<W extends readonly unknown[], D extends boolean> = W extends readonly [
  infer H,
  ...infer R,
]
  ? [H] extends ['tag']
    ? R extends readonly [infer T, ...infer Rest]
      ? TagNameInvalid<T> extends true
        ? false
        : Words<Rest, D>
      : R extends readonly []
        ? false
        : true
    : 'tag' extends H
      ? true
      : D extends true
        ? DeleteWordInvalid<H> extends true
          ? false
          : Words<R, D>
        : Words<R, D>
  : true;
type Skip<W extends readonly unknown[], N extends number> = N extends 1
  ? W extends readonly [unknown, ...infer R]
    ? R
    : W extends readonly []
      ? W
      : readonly unknown[]
  : W;
type AsWords<V> = V extends string ? readonly [V] : V extends readonly unknown[] ? V : never;
type HasNewline<V> = V extends string
  ? string extends V
    ? false
    : V extends `${string}\n${string}`
      ? true
      : false
  : V extends readonly (infer E)[]
    ? true extends HasNewline<E>
      ? true
      : false
    : false;

type RemoteNameCharacter = ' ' | '~' | '^' | ':' | '?' | '[' | '\\' | '*' | '\t' | '\n' | '\x7f';
/** Certain refusals of valid_remote_name for a literal name; other control bytes stay runtime. */
type RemoteNameInvalid<V> = V extends string
  ? string extends V
    ? false
    : V extends
          | ''
          | `.${string}`
          | `/${string}`
          | `${string}/`
          | `${string}//${string}`
          | `${string}/.${string}`
          | `${string}..${string}`
          | `${string}@{${string}`
          | `${string}.lock`
          | `${string}.lock/${string}`
          | `${string}${RemoteNameCharacter}${string}`
      ? true
      : false
  : false;

/** Whether a literal value passes the selected push parser. */
export type PushRefspecLiteral<V, P extends PushRefspecParser> = P extends 'remote-name'
  ? RemoteNameInvalid<V> extends true
    ? false
    : true
  : P extends 'push-option-text'
    ? HasNewline<V> extends true
      ? false
      : true
    : [AsWords<V>] extends [never]
      ? true
      : Words<
            Skip<
              AsWords<V>,
              P extends 'refspec-operands' | 'push-delete-operands' | 'fetch-refspec-operands'
                ? 1
                : 0
            >,
            P extends 'push-delete-operands' | 'push-delete-refspecs' ? true : false
          > extends true
        ? true
        : false;

import type { PushRefspecParser } from './push-refspecs.js';

/** A word that set_refspecs cannot accept under --delete; wide strings stay unknown. */
type DeleteWordInvalid<W> = string extends W
  ? false
  : W extends ''
    ? true
    : W extends `${string}:${string}`
      ? true
      : false;
/** Walk refspec words: `tag` consumes the next word; unknown lengths stay accepted. */
type Words<W extends readonly unknown[], D extends boolean> = W extends readonly [
  infer H,
  ...infer R,
]
  ? H extends 'tag'
    ? string extends H
      ? true
      : R extends readonly [unknown, ...infer Rest]
        ? Words<Rest, D>
        : R extends readonly []
          ? false
          : true
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
            Skip<AsWords<V>, P extends 'refspec-operands' | 'push-delete-operands' ? 1 : 0>,
            P extends 'push-delete-operands' | 'push-delete-refspecs' ? true : false
          > extends true
        ? true
        : false;

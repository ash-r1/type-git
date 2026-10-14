import type { StringCallbackParser } from './string-callback.js';
import type { STRING_CALLBACKS } from './string-callbacks.generated.js';

type Profile<P extends StringCallbackParser> = (typeof STRING_CALLBACKS)[P];
type Dynamic<S extends string, N extends readonly unknown[] = []> = string extends S
  ? true
  : `${number}` extends S
    ? true
    : `${bigint}` extends S
      ? true
      : N['length'] extends 128
        ? true
        : S extends `${infer _C}${infer R}`
          ? Dynamic<R, readonly [...N, 0]>
          : false;
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
type Parsed<V, P extends StringCallbackParser> = V extends string
  ? Profile<P> extends {
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
      : false
  : false;
export type StringCallbackLiteral<V, P extends StringCallbackParser> = false extends Parsed<V, P>
  ? false
  : true;

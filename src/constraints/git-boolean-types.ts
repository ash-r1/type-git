import type { AsciiLower } from './ascii-types.js';
import type { BOOLEAN_CALLBACKS, BOOLEAN_GRAMMAR } from './boolean-callbacks.generated.js';
import type { GitBooleanCallback } from './git-boolean.js';
import type { GitIntegerLiteral, GitIntegerValue } from './git-integer-types.js';

type DynamicText<S extends string, Steps extends unknown[] = []> = string extends S
  ? true
  : Steps['length'] extends 128
    ? true
    : S extends ''
      ? false
      : S extends `${infer H}${infer Rest}`
        ? string extends H
          ? true
          : `${number}` extends H
            ? true
            : `${bigint}` extends H
              ? true
              : DynamicText<Rest, [...Steps, 0]>
        : true;
type ParsedInteger<V> =
  GitIntegerLiteral<V, typeof BOOLEAN_GRAMMAR.integer> extends false
    ? 'invalid'
    : GitIntegerValue<V, typeof BOOLEAN_GRAMMAR.integer> extends infer N
      ? number extends N
        ? 'dynamic'
        : N extends 0
          ? false
          : true
      : 'invalid';
type ParsedBoolean<V> = V extends boolean
  ? V
  : V extends string
    ? DynamicText<V> extends true
      ? 'dynamic'
      : AsciiLower<V> extends (typeof BOOLEAN_GRAMMAR.true)[number]
        ? true
        : AsciiLower<V> extends (typeof BOOLEAN_GRAMMAR.false)[number]
          ? false
          : ParsedInteger<V>
    : 'invalid';
export type GitBooleanLiteral<V> =
  Extract<ParsedBoolean<V>, 'invalid'> extends never ? true : false;
export type GitBooleanValue<V> =
  ParsedBoolean<V> extends infer B
    ? B extends 'dynamic'
      ? boolean
      : B extends boolean
        ? B
        : never
    : never;
type Profile<P extends GitBooleanCallback> = (typeof BOOLEAN_CALLBACKS)[P];
type Names<P extends GitBooleanCallback> = Profile<P>['names'];
type Transition<Previous, From, To> = Previous extends From ? To : Previous;
type ParsedName<V, P extends GitBooleanCallback> = V extends string
  ? (Profile<P> extends { caseInsensitive: true } ? AsciiLower<V> : V) extends infer Name
    ? Name extends keyof Names<P>
      ? Names<P>[Name]
      : 'invalid'
    : 'invalid'
  : 'invalid';
type ParsedCallback<V, P extends GitBooleanCallback, Previous> = V extends unknown
  ? Profile<P> extends { transitions: infer T }
    ? V extends keyof T
      ? T[V] extends { from: infer From; to: infer To }
        ? Transition<Previous, From, To>
        : never
      : ParsedCallbackValue<V, P>
    : ParsedCallbackValue<V, P>
  : never;
type ParsedCallbackValue<V, P extends GitBooleanCallback> = ParsedBoolean<V> extends infer B
  ? B extends 'dynamic'
    ? V // Preserve an unknown string state so final constraints defer to runtime.
    : B extends boolean
      ? B extends true
        ? Profile<P>['allowTrue'] extends true
          ? true
          : 'invalid'
        : false
      : ParsedName<V, P>
  : never;
export type GitBooleanCallbackLiteral<V, P extends GitBooleanCallback> = Extract<
  ParsedCallback<V, P, undefined>,
  'invalid'
> extends never
  ? true
  : false;
export type GitBooleanCallbackValue<
  V,
  P extends GitBooleanCallback,
  Previous = undefined,
> = Exclude<ParsedCallback<V, P, Previous>, 'invalid'>;

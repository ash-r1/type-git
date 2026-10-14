import type { AsciiLower } from './ascii-types.js';
import type { BOOLEAN_CALLBACKS, BOOLEAN_GRAMMAR } from './boolean-callbacks.generated.js';
import type { GitBooleanCallback, GitBooleanSource } from './git-boolean.js';
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
type ParsedInteger<V, Source extends GitBooleanSource> = GitIntegerLiteral<
  V,
  typeof BOOLEAN_GRAMMAR.integer
> extends false
  ? 'invalid'
  : GitIntegerValue<V, typeof BOOLEAN_GRAMMAR.integer> extends infer N
    ? Source extends 'modern'
      ? number extends N
        ? 'dynamic'
        : N extends 0
          ? false
          : true
      : N extends -2147483648
        ? 'invalid'
        : number extends N
          ? 'dynamic'
          : N extends 0
            ? false
            : true
    : 'invalid';
type ParsedBoolean<V, Source extends GitBooleanSource> = V extends boolean
  ? V
  : V extends string
    ? DynamicText<V> extends true
      ? 'dynamic'
      : AsciiLower<V> extends (typeof BOOLEAN_GRAMMAR.true)[number]
        ? true
        : AsciiLower<V> extends (typeof BOOLEAN_GRAMMAR.false)[number]
          ? false
          : Source extends 'legacy-units'
            ? AsciiLower<V> extends 'k' | 'm' | 'g'
              ? false
              : ParsedInteger<V, Source>
            : ParsedInteger<V, Source>
    : 'invalid';
export type GitBooleanLiteral<V, Source extends GitBooleanSource = 'modern'> = Extract<
  ParsedBoolean<V, Source>,
  'invalid'
> extends never
  ? true
  : false;
export type GitBooleanValue<V, Source extends GitBooleanSource = 'modern'> = ParsedBoolean<
  V,
  Source
> extends infer B
  ? B extends 'dynamic'
    ? boolean
    : B extends boolean
      ? B
      : never
  : never;
type Profile<P extends GitBooleanCallback> = (typeof BOOLEAN_CALLBACKS)[P];
type Names<P extends GitBooleanCallback> = Profile<P>['names'];
type Transition<Previous, From, To> = Previous extends From ? To : Previous;
type ParsedName<V, P extends GitBooleanCallback, Source extends GitBooleanSource> = V extends string
  ? Source extends 'legacy-units'
    ? P extends 'pull-rebase'
      ? V extends 'preserve' | 'p'
        ? 'preserve'
        : ParsedName<V, P, 'symmetric'>
      : ParsedName<V, P, 'symmetric'>
    : (Profile<P> extends { caseInsensitive: true } ? AsciiLower<V> : V) extends infer Name
      ? Name extends keyof Names<P>
        ? Names<P>[Name]
        : 'invalid'
      : 'invalid'
  : 'invalid';
type ParsedCallback<
  V,
  P extends GitBooleanCallback,
  Previous,
  Source extends GitBooleanSource,
> = V extends unknown
  ? Profile<P> extends { transitions: infer T }
    ? V extends keyof T
      ? Source extends 'legacy-units'
        ? 'invalid'
        : T[V] extends { from: infer From; to: infer To }
          ? Transition<Previous, From, To>
          : never
      : ParsedCallbackValue<V, P, Source>
    : ParsedCallbackValue<V, P, Source>
  : never;
type ParsedCallbackValue<
  V,
  P extends GitBooleanCallback,
  Source extends GitBooleanSource,
> = ParsedBoolean<V, Source> extends infer B
  ? B extends 'dynamic'
    ? V // Preserve an unknown string state so final constraints defer to runtime.
    : B extends boolean
      ? B extends true
        ? Profile<P>['allowTrue'] extends true
          ? true
          : 'invalid'
        : false
      : ParsedName<V, P, Source>
  : never;
export type GitBooleanCallbackLiteral<
  V,
  P extends GitBooleanCallback,
  Source extends GitBooleanSource = 'modern',
> = Extract<ParsedCallback<V, P, undefined, Source>, 'invalid'> extends never ? true : false;
export type GitBooleanCallbackValue<
  V,
  P extends GitBooleanCallback,
  Previous = undefined,
  Source extends GitBooleanSource = 'modern',
> = Exclude<ParsedCallback<V, P, Previous, Source>, 'invalid'>;

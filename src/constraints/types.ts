import type { Constraint, Predicate } from './model.js';

type MaybeGitDisabled<V> = V extends string
  ? Lowercase<V> extends 'true' | 'yes' | 'on' | 'on-demand' | '1'
    ? never
    : V
  : Extract<V, false | undefined>;
type Inactive<T, K extends keyof T> = { [P in K]?: Extract<T[P], false | undefined> };
type Active<T, K extends keyof T> = { [P in K]-?: Exclude<T[P], false | undefined> };
type Nonempty<V> = V extends readonly unknown[] | string ? Exclude<V, readonly [] | ''> : never;
type Elements<V> = V extends readonly (infer E)[] ? E : never;
type Membership<
  T,
  K extends keyof T,
  V extends string,
  Included extends boolean,
> = V extends keyof T
  ? Included extends true
    ? { [P in V]-?: Extract<T[P], Elements<T[K]>> }
    : string extends Elements<T[K]>
      ? unknown // Unknown prior values are checked at runtime.
      : { [P in V]?: Exclude<T[P], Elements<T[K]>> }
  : Included extends true
    ? never
    : unknown;
type LengthMatch<V, N extends number, Included extends boolean> = V extends readonly unknown[]
  ? number extends V['length']
    ? V
    : V['length'] extends N
      ? Included extends true
        ? V
        : never
      : Included extends true
        ? never
        : V
  : Included extends true
    ? never
    : V;
type Satisfy<T, P extends Predicate> = P['key'] extends keyof T
  ? P extends { test: 'lengthEquals'; value: infer N extends number }
    ? { [K in P['key']]-?: LengthMatch<T[K], N, true> }
    : P extends { test: 'includes'; valueKey: infer V extends string }
      ? Membership<T, P['key'], V, true>
      : P extends { test: 'equals'; value: infer V }
        ? { [K in P['key']]-?: Extract<V, T[K]> }
        : P extends { test: 'startsWith'; value: infer V extends string }
          ? { [K in P['key']]-?: Extract<`${V}${string}`, T[K]> | Extract<T[K], `${V}${string}`> }
          : P extends { test: 'notEquals'; value: infer V }
            ? { [K in P['key']]?: Exclude<T[K], V> }
            : P['test'] extends 'inactive'
              ? Inactive<T, P['key']>
              : P['test'] extends 'nonempty'
                ? { [K in P['key']]-?: Nonempty<T[K]> }
                : P['test'] extends 'present'
                  ? { [K in P['key']]-?: Exclude<T[K], undefined> }
                  : Active<T, P['key']>
  : never;
type Reject<T, P extends Predicate> = P['key'] extends keyof T
  ? P extends { test: 'lengthEquals'; value: infer N extends number }
    ? { [K in P['key']]?: LengthMatch<T[K], N, false> }
    : P extends { test: 'includes'; valueKey: infer V extends string }
      ? Membership<T, P['key'], V, false>
      : P extends { test: 'equals'; value: infer V }
        ? { [K in P['key']]?: Exclude<T[K], V> }
        : P extends { test: 'startsWith'; value: infer V extends string }
          ? { [K in P['key']]?: Exclude<T[K], `${V}${string}`> }
          : P extends { test: 'notEquals'; value: infer V }
            ? { [K in P['key']]-?: Extract<V, T[K]> }
            : P['test'] extends 'gitEnabled'
              ? { [K in P['key']]?: MaybeGitDisabled<T[K]> }
              : P['test'] extends 'inactive'
                ? Active<T, P['key']>
                : P['test'] extends 'present'
                  ? { [K in P['key']]?: never }
                  : P['test'] extends 'nonzero'
                    ? { [K in P['key']]?: Extract<0 | false | undefined, T[K]> }
                    : P['test'] extends 'nonempty'
                      ? { [K in P['key']]?: Extract<'' | [] | readonly [] | undefined, T[K]> }
                      : P['test'] extends 'positive' | 'bytesPositive'
                        ? unknown // Arbitrary numeric inequalities remain runtime checks.
                        : Inactive<T, P['key']>
  : unknown;
type Every<T, P extends readonly Predicate[]> = P extends readonly [
  infer H extends Predicate,
  ...infer R extends readonly Predicate[],
]
  ? Satisfy<T, H> & Every<T, R>
  : unknown;
type None<T, P extends readonly Predicate[]> = P extends readonly [
  infer H extends Predicate,
  ...infer R extends readonly Predicate[],
]
  ? Reject<T, H> & None<T, R>
  : unknown;
type NotEvery<T, P extends readonly Predicate[]> = P extends readonly [
  infer H extends Predicate,
  ...infer R extends readonly Predicate[],
]
  ? Reject<T, H> | NotEvery<T, R>
  : never;
type Exclusive<T, K extends keyof T> = {
  [P in K]: Pick<T, P> & Inactive<T, Exclude<K, P>>;
}[K];
// Select a group that may be active; all other groups must be inactive.
// A group's predicates are alternatives, so its members may coexist.
type ExclusiveGroups<
  T,
  G extends readonly (readonly Predicate[])[],
  Before = unknown,
> = G extends readonly [
  infer H extends readonly Predicate[],
  ...infer Rest extends readonly (readonly Predicate[])[],
]
  ? (Before & NoGroups<T, Rest>) | ExclusiveGroups<T, Rest, Before & None<T, H>>
  : never;
type NoGroups<T, G extends readonly (readonly Predicate[])[]> = G extends readonly [
  infer H extends readonly Predicate[],
  ...infer Rest extends readonly (readonly Predicate[])[],
]
  ? None<T, H> & NoGroups<T, Rest>
  : unknown;
type Tuple<E, N extends number, A extends readonly E[] = readonly []> = number extends N
  ? readonly E[]
  : A['length'] extends N
    ? A
    : Tuple<E, N, readonly [...A, E]>;
type UpTo<E, N extends number, A extends readonly E[] = readonly []> = number extends N
  ? readonly E[]
  : A['length'] extends N
    ? A
    : A | UpTo<E, N, readonly [...A, E]>;
type BoundedArray<V, R extends { min: number; max?: number }> = V extends readonly (infer E)[]
  ? readonly [...Tuple<E, R['min']>, ...E[]] &
      (R extends { max: infer M extends number } ? UpTo<E, M> : readonly E[])
  : V; // Scalar operand representations are checked at runtime.
type Arity<T, R extends { key: string; min: number; max?: number }> = R['key'] extends keyof T
  ? R['min'] extends 0
    ? { [K in R['key']]?: BoundedArray<Exclude<T[K], undefined>, R> }
    : { [K in R['key']]-?: BoundedArray<Exclude<T[K], undefined>, R> }
  : never;
type Unless<T, W> = W extends Predicate
  ? Reject<T, W>
  : W extends readonly Predicate[]
    ? NotEvery<T, W>
    : never;
type Apply<T, R extends Constraint> = R extends { guard: infer G extends readonly Predicate[] }
  ? NotEvery<T, G> | ApplyBody<T, R>
  : ApplyBody<T, R>;
type ApplyBody<T, R extends Constraint> = R extends {
  kind: 'arity';
  key: string;
  min: number;
  max?: number;
}
  ? Arity<T, R> | (R extends { when: infer W } ? Unless<T, W> : never)
  : R extends {
        kind: 'required';
        required: infer P extends readonly Predicate[];
      }
    ? Every<T, P>
    : R extends {
          kind: 'exclusiveGroups';
          groups: infer G extends readonly (readonly Predicate[])[];
        }
      ? G extends readonly []
        ? unknown
        : ExclusiveGroups<T, G>
      : R extends {
            kind: 'exclusive';
            keys: infer K extends readonly string[];
          }
        ? Exclusive<T, Extract<K[number], keyof T>>
        : R extends {
              kind: 'requiresAny';
              when: infer P extends Predicate;
              choices: infer Q extends readonly Predicate[];
            }
          ?
              | Reject<T, P>
              | (Q[number] extends infer C extends Predicate
                  ? C extends unknown
                    ? Satisfy<T, C>
                    : never
                  : never)
          : R extends {
                kind: 'requires';
                when: infer P extends Predicate;
                required: infer Q extends readonly Predicate[];
              }
            ? Reject<T, P> | Every<T, Q>
            : R extends {
                  kind: 'conflicts';
                  when: infer P extends Predicate;
                  others: infer Q extends readonly Predicate[];
                }
              ? Reject<T, P> | None<T, Q>
              : R extends { kind: 'forbid'; when: infer P extends readonly Predicate[] }
                ? NotEvery<T, P>
                : R extends { kind: 'unsupported'; keys: infer K extends readonly string[] }
                  ? { [P in K[number]]?: never }
                  : R extends {
                        kind: 'value';
                        key: infer K extends keyof T;
                        allowed: infer V extends readonly unknown[];
                      }
                    ? { [P in K]?: Extract<V[number], T[P]> }
                    : unknown; // Numeric ranges require runtime validation; TypeScript's number is not an integer type.

type Rules<T, R extends readonly Constraint[]> = R extends readonly [
  infer H extends Constraint,
  ...infer Rest extends readonly Constraint[],
]
  ? Apply<T, H> & Rules<T, Rest>
  : unknown;
export type Constrained<T, R extends readonly Constraint[]> = T & Rules<T, R>;

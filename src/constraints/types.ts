import type { Constraint, Predicate } from './model.js';

type Inactive<T, K extends keyof T> = { [P in K]?: Extract<T[P], false | undefined> };
type Active<T, K extends keyof T> = { [P in K]-?: Exclude<T[P], false | undefined> };
type Satisfy<T, P extends Predicate> = P['key'] extends keyof T
  ? P extends { test: 'equals'; value: infer V }
    ? { [K in P['key']]-?: Extract<T[K], V> }
    : P['test'] extends 'inactive'
      ? Inactive<T, P['key']>
      : P['test'] extends 'present'
        ? { [K in P['key']]-?: Exclude<T[K], undefined> }
        : Active<T, P['key']>
  : never;
type Reject<T, P extends Predicate> = P['key'] extends keyof T
  ? P extends { test: 'equals'; value: infer V }
    ? { [K in P['key']]?: Exclude<T[K], V> }
    : P['test'] extends 'inactive'
      ? Active<T, P['key']>
      : P['test'] extends 'present'
        ? { [K in P['key']]?: never }
        : P['test'] extends 'nonzero'
          ? { [K in P['key']]?: Extract<0 | false | undefined, T[K]> }
          : P['test'] extends 'nonempty'
            ? { [K in P['key']]?: Extract<'' | [] | undefined, T[K]> }
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
type Apply<T, R extends Constraint> = R extends {
  kind: 'required';
  required: infer P extends readonly Predicate[];
}
  ? Every<T, P>
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
                ? { [P in K]?: Extract<T[P], V[number]> }
                : unknown; // Numeric ranges require runtime validation; TypeScript's number is not an integer type.

type Rules<T, R extends readonly Constraint[]> = R extends readonly [
  infer H extends Constraint,
  ...infer Rest extends readonly Constraint[],
]
  ? Apply<T, H> & Rules<T, Rest>
  : unknown;
export type Constrained<T, R extends readonly Constraint[]> = T & Rules<T, R>;

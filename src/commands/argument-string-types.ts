import type { ARGV_STRING_CONSTRAINT } from './spec.js';

/** Detect a known unrepresentable NUL alternative without rejecting an opaque runtime string. */
type ValueHasLiteralNul<V> =
  Extract<V, `${string}${typeof ARGV_STRING_CONSTRAINT.forbiddenCharacter}${string}`> extends never
    ? false
    : true;
/** Inspect only emitted operand or option words; unrelated object metadata is ignored. */
type TokenHasLiteralNul<T> = T extends { readonly operand: infer V }
  ? ValueHasLiteralNul<V>
  : T extends readonly unknown[]
    ? true extends { [I in keyof T]: ValueHasLiteralNul<T[I]> }[number]
      ? true
      : false
    : false;
/** Check slots separately so another broad string cannot erase a known NUL, including variadic arrays. */
export type ArgumentsHaveLiteralNul<A extends readonly unknown[]> = true extends {
  [I in keyof A]: TokenHasLiteralNul<A[I]>;
}[number]
  ? true
  : false;

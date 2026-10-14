import type { ARGV_STRING_CONSTRAINT } from './spec.js';

// NUL cannot be represented in an OS argv string, independently of command parsing/help.
type ValueHasLiteralNul<V> =
  Extract<V, `${string}${typeof ARGV_STRING_CONSTRAINT.forbiddenCharacter}${string}`> extends never
    ? false
    : true;
type TokenHasLiteralNul<T> = T extends { readonly operand: infer V }
  ? ValueHasLiteralNul<V>
  : T extends readonly unknown[]
    ? true extends { [I in keyof T]: ValueHasLiteralNul<T[I]> }[number]
      ? true
      : false
    : false;
// Check each tuple slot before forming a union: a broad string in another slot
// must not erase a known NUL literal by widening their combined value to string.
export type ArgumentsHaveLiteralNul<A extends readonly unknown[]> = true extends {
  [I in keyof A]: TokenHasLiteralNul<A[I]>;
}[number]
  ? true
  : false;

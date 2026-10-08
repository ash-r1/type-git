import type { ArgumentsHaveLiteralNul as HasNul } from '../../src/commands/argument-string-types.js';
type Yes<T extends true> = T;
type No<T extends false> = T;
export type Cases = [
  No<HasNul<readonly []>>,
  No<HasNul<readonly [readonly ['--format', string], { readonly operand: string }]>>,
  Yes<HasNul<readonly [readonly ['--format', string], { readonly operand: 'a\0b' }]>>,
  Yes<HasNul<readonly [readonly ['--format', 'a\0b'], { readonly operand: string }]>>,
  Yes<HasNul<readonly [{ readonly operand: string }, readonly ['--file', 'a\0b']]>>,
  Yes<HasNul<readonly [{ readonly operand: 'valid' | 'bad\0value' }]>>,
  Yes<HasNul<readonly [{ readonly operand: `${string}\0${string}` }]>>,
  No<HasNul<readonly [{ readonly operand: string }]>>,
  No<HasNul<readonly [{ readonly operand: 'path'; readonly metadata: 'unused\0data' }]>>,
  Yes<HasNul<readonly [readonly [string, 'a\0b']]>>,
  Yes<HasNul<readonly [readonly ['a\0b', string]]>>,
  No<HasNul<readonly [readonly ['--flag', undefined]]>>,
];

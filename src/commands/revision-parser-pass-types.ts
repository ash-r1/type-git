import type { DynamicWord } from './initial-parser-pass-types.js';
import type { CommandSpec } from './spec.js';

type Token = readonly string[] | { operand: string };
type Tokens = readonly Token[];
type Invalid = { invalid: true };
type Deferred = { dynamic: true };
type Done<T extends Tokens> = { tokens: T };
type Phase<S extends CommandSpec> = NonNullable<S['parserExit']>;
type Options<S extends CommandSpec> = NonNullable<Phase<S>['remainingOptions']>;
type Tick<N extends readonly unknown[]> = readonly [...N, 0];
type Operands<A extends readonly string[]> = { [I in keyof A]: { operand: A[I] } };
type LongEnough<W extends string, N extends readonly unknown[] = []> = N['length'] extends 3
  ? true
  : W extends `${infer _C}${infer R}`
    ? LongEnough<R, Tick<N>>
    : false;
type Typo<S extends CommandSpec, W extends string> = LongEnough<W> extends true
  ? W extends `no-${string}`
    ? true
    : Phase<S> extends { remainingLongNames: readonly (infer Name extends string)[] }
      ? [Extract<Name, `${W}${string}`>] extends [never]
        ? false
        : true
      : false
  : false;
type Bare<
  S extends CommandSpec,
  F extends keyof Options<S> & string,
  R extends readonly string[],
  T extends Tokens,
  N extends readonly unknown[],
> = Options<S>[F]['value'] extends 'flag' | `optional-${string}`
  ? Walk<S, R, readonly [...T, readonly [F]], N>
  : F extends `--${string}`
    ? Phase<S> extends { remainingDetachedOptions: readonly (infer Allowed)[] }
      ? F extends Allowed
        ? Take<S, F, R, T, N>
        : Invalid
      : Invalid
    : Take<S, F, R, T, N>;
type Take<
  S extends CommandSpec,
  F extends string,
  R extends readonly string[],
  T extends Tokens,
  N extends readonly unknown[],
> = R extends readonly [infer V extends string, ...infer Tail extends string[]]
  ? Walk<S, Tail, readonly [...T, readonly [F, V]], N>
  : Invalid;
type Cluster<
  S extends CommandSpec,
  W extends string,
  Original extends string,
  R extends readonly string[],
  T extends Tokens,
  N extends readonly unknown[],
  First extends boolean = true,
> = N['length'] extends 128
  ? Deferred
  : W extends `${infer C}${infer Tail}`
    ? Phase<S> extends { remainingShortOptions: readonly (infer Flag)[] }
      ? `-${C}` extends Flag & keyof Options<S>
        ? Options<S>[`-${C}`]['value'] extends 'flag'
          ? First extends true
            ? Tail extends ''
              ? Walk<S, R, readonly [...T, readonly [`-${C}`]], N>
              : Typo<S, Original> extends true
                ? Invalid
                : Cluster<S, Tail, Original, R, readonly [...T, readonly [`-${C}`]], Tick<N>, false>
            : Cluster<S, Tail, Original, R, readonly [...T, readonly [`-${C}`]], Tick<N>, false>
          : Tail extends ''
            ? Options<S>[`-${C}`]['value'] extends `optional-${string}`
              ? Walk<S, R, readonly [...T, readonly [`-${C}`]], N>
              : Take<S, `-${C}`, R, T, N>
            : Walk<S, R, readonly [...T, readonly [`-${C}`, Tail]], N>
        : Invalid
      : Invalid
    : Walk<S, R, T, N>;
type Word<
  S extends CommandSpec,
  W extends string,
  R extends readonly string[],
  T extends Tokens,
  N extends readonly unknown[],
> = W extends '--end-of-options'
  ? Done<readonly [...T, readonly [W], ...Operands<R>]>
  : W extends keyof Options<S>
    ? Bare<S, W, R, T, N>
    : W extends `--${string}`
      ? W extends `${infer F}=${infer V}`
        ? F extends keyof Options<S>
          ? Options<S>[F] extends { value: 'flag' } | { separateValue: true }
            ? Invalid
            : Walk<S, R, readonly [...T, readonly [F, V]], N>
          : Invalid
        : Invalid
      : W extends `-n${infer V}`
        ? Walk<S, R, readonly [...T, readonly ['-n', V]], N>
        : W extends `-${infer V}`
          ? V extends `${'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'}${string}`
            ? Walk<S, R, readonly [...T, readonly ['-n', V]], N>
            : V extends ''
              ? Invalid
              : Cluster<S, V, V, R, T, N>
          : Walk<S, R, readonly [...T, { operand: W }], N>;
type Walk<
  S extends CommandSpec,
  A extends readonly string[],
  T extends Tokens = [],
  N extends readonly unknown[] = [],
> = N['length'] extends 128
  ? Deferred
  : A extends readonly [infer W extends string, ...infer R extends string[]]
    ? Word<S, W, R, T, Tick<N>>
    : Done<T>;
type Split<
  S extends CommandSpec,
  A extends readonly string[],
  Before extends readonly string[] = [],
  N extends readonly unknown[] = [],
> = N['length'] extends 128
  ? Deferred
  : A extends readonly [infer W extends string, ...infer R extends string[]]
    ? W extends '--'
      ? Walk<S, Before> extends infer P
        ? P extends { tokens: infer T extends Tokens }
          ? Done<readonly [...T, readonly ['--'], ...Operands<R>]>
          : P
        : Invalid
      : Split<S, R, readonly [...Before, W], Tick<N>>
    : Walk<S, Before>;
type ReplaceDash<S extends CommandSpec, A extends readonly string[]> = Phase<S> extends {
  leadingDashReplacement: infer W extends string;
}
  ? A extends readonly ['-', ...infer R extends string[]]
    ? readonly [W, ...R]
    : A
  : A;
export type RevisionParserPass<S, A extends readonly string[]> = S extends CommandSpec
  ? Phase<S> extends { splitRemainingPaths: true }
    ? Split<S, ReplaceDash<S, A>>
    : Walk<S, ReplaceDash<S, A>>
  : Invalid;

// Match the native retained-word partition before the later parser sees any words.
type PartitionWords<
  A extends readonly string[],
  Prefix extends string,
  Key extends string,
  Words extends readonly string[] = [],
  OperandWords extends readonly string[] = [],
  N extends readonly unknown[] = [],
> = N['length'] extends 128
  ? Deferred
  : A extends readonly [infer W extends string, ...infer R extends string[]]
    ? DynamicWord<W> extends true
      ? Deferred
      : W extends `${Prefix}${string}`
        ? PartitionWords<R, Prefix, Key, readonly [...Words, W], OperandWords, Tick<N>>
        : PartitionWords<R, Prefix, Key, Words, readonly [...OperandWords, W], Tick<N>>
    : { words: Words; state: { [K in Key]: OperandWords } };
export type PartitionRemaining<S, A extends readonly string[]> = S extends {
  parserExit: {
    remainingPartition: {
      optionPrefix: infer Prefix extends string;
      operandKey: infer Key extends string;
    };
  };
}
  ? PartitionWords<A, Prefix, Key>
  : { words: A; state: {} };

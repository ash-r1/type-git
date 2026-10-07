import type { CommandSpec, OptionSpec } from './spec.js';

type Tokens = readonly (readonly string[])[];
type Deferred = { exited: 'dynamic' };
type Invalid = { exited: 'invalid' };
type Done<T extends Tokens, R extends readonly string[]> = {
  exited: false;
  tokens: T;
  remaining: R;
};
type Help<T extends Tokens> = { exited: true; tokens: readonly [...T, readonly ['-h']] };
type Text<V> = V extends string | number | bigint | boolean ? `${V}` : never;
type Emit<K extends string, D extends OptionSpec, V> = [V] extends [undefined]
  ? readonly [K]
  : D extends { separateValue: true }
    ? readonly [K, Text<V>]
    : K extends `--${string}`
      ? readonly [`${K}=${Text<V>}`]
      : D['value'] extends `optional-${string}`
        ? V extends ''
          ? D extends { emptyValueFlag: infer F extends string }
            ? readonly [`${F}=`]
            : readonly [K]
          : readonly [`${K}${Text<V>}`]
        : D extends { attachedValue: true }
          ? readonly [`${K}${Text<V>}`]
          : readonly [K, Text<V>];
type Serialize<
  S extends CommandSpec,
  A extends readonly unknown[],
  Out extends readonly string[] = [],
  N extends readonly unknown[] = [],
> = N['length'] extends 128
  ? Deferred
  : A extends readonly [infer H, ...infer R]
    ? H extends { operand: infer W extends string }
      ? Serialize<S, R, readonly [...Out, W], Tick<N>>
      : H extends readonly [infer K extends string, infer V]
        ? K extends keyof S['options']
          ? Serialize<S, R, readonly [...Out, ...Emit<K, S['options'][K], V>], Tick<N>>
          : Deferred
        : H extends readonly [infer K extends string]
          ? Serialize<S, R, readonly [...Out, K], Tick<N>>
          : Deferred
    : Out;
type Flags<S extends CommandSpec> = S extends {
  parserExit: { firstPassOptions: readonly (infer F)[] };
}
  ? F
  : never;
type LongNames<S extends CommandSpec> = S extends {
  parserExit: { firstPassLongNames: readonly (infer F extends string)[] };
}
  ? F
  : never;
type LongEnough<W extends string, N extends readonly unknown[] = []> = N['length'] extends 3
  ? true
  : W extends `${infer _C}${infer R}`
    ? LongEnough<R, readonly [...N, 0]>
    : false;
type Typo<S extends CommandSpec, W extends string> = LongEnough<W> extends true
  ? W extends `no-${string}`
    ? true
    : [Extract<LongNames<S>, `${W}${string}`>] extends [never]
      ? false
      : true
  : false;
type Option<S extends CommandSpec, F> = F extends Flags<S>
  ? F extends keyof S['options']
    ? S['options'][F]
    : never
  : never;
type Tick<N extends readonly unknown[]> = readonly [...N, 0];
type Long<
  S extends CommandSpec,
  W extends string,
  R extends readonly string[],
  T extends Tokens,
  N extends readonly unknown[],
  Out extends readonly string[],
> = W extends `${infer F}=${infer V}`
  ? F extends '--help'
    ? Walk<S, R, T, N, readonly [...Out, W]>
    : [Option<S, F>] extends [never]
      ? Walk<S, R, T, N, readonly [...Out, W]>
      : Option<S, F>['value'] extends 'flag'
        ? Invalid
        : Walk<S, R, readonly [...T, readonly [F, V]], N, Out>
  : [Option<S, W>] extends [never]
    ? Walk<S, R, T, N, readonly [...Out, W]>
    : Option<S, W>['value'] extends 'flag' | `optional-${string}`
      ? Walk<S, R, readonly [...T, readonly [W]], N, Out>
      : R extends readonly [infer V extends string, ...infer Rest extends string[]]
        ? Walk<S, Rest, readonly [...T, readonly [W, V]], N, Out>
        : Invalid;
type Short<
  S extends CommandSpec,
  W extends string,
  Original extends string,
  R extends readonly string[],
  T extends Tokens,
  N extends readonly unknown[],
  First extends boolean,
  Out extends readonly string[],
> = N['length'] extends 128
  ? Deferred
  : string extends W
    ? Deferred
    : W extends `${infer C}${infer Rest}`
      ? C extends 'h'
        ? First extends true
          ? Typo<S, Original> extends true
            ? Invalid
            : Help<T>
          : Help<T>
        : [Option<S, `-${C}`>] extends [never]
          ? First extends true
            ? Typo<S, Original> extends true
              ? Invalid
              : Walk<S, R, T, N, readonly [...Out, `-${W}`]>
            : Walk<S, R, T, N, readonly [...Out, `-${W}`]>
          : Option<S, `-${C}`>['value'] extends 'flag'
            ? First extends true
              ? Rest extends ''
                ? Walk<S, R, readonly [...T, readonly [`-${C}`]], N, Out>
                : Typo<S, Original> extends true
                  ? Invalid
                  : Short<
                      S,
                      Rest,
                      Original,
                      R,
                      readonly [...T, readonly [`-${C}`]],
                      Tick<N>,
                      false,
                      Out
                    >
              : Short<
                  S,
                  Rest,
                  Original,
                  R,
                  readonly [...T, readonly [`-${C}`]],
                  Tick<N>,
                  false,
                  Out
                >
            : Rest extends ''
              ? Option<S, `-${C}`>['value'] extends `optional-${string}`
                ? Walk<S, R, readonly [...T, readonly [`-${C}`]], N, Out>
                : R extends readonly [infer V extends string, ...infer Tail extends string[]]
                  ? Walk<S, Tail, readonly [...T, readonly [`-${C}`, V]], N, Out>
                  : Invalid
              : Walk<S, R, readonly [...T, readonly [`-${C}`, Rest]], N, Out>
      : Walk<S, R, T, N, Out>;
type DynamicWord<W extends string, N extends readonly unknown[] = []> = string extends W
  ? true
  : `${number}` extends W
    ? true
    : `${bigint}` extends W
      ? true
      : N['length'] extends 128
        ? true
        : W extends `${infer _C}${infer R}`
          ? DynamicWord<R, Tick<N>>
          : false;
type Walk<
  S extends CommandSpec,
  A extends readonly string[],
  T extends Tokens = [],
  N extends readonly unknown[] = [],
  Out extends readonly string[] = [],
> = N['length'] extends 128
  ? Deferred
  : A extends readonly [infer W extends string, ...infer R extends string[]]
    ? DynamicWord<W> extends true
      ? Deferred
      : W extends '--' | '--end-of-options'
        ? Done<
            T,
            W extends '--end-of-options'
              ? readonly [...Out, W, ...R]
              : S extends { parserExit: { keepDashDash: true } }
                ? readonly [...Out, W, ...R]
                : readonly [...Out, ...R]
          >
        : W extends '--help' | '--help-all'
          ? Help<T>
          : W extends `--${string}`
            ? Long<S, W, R, T, Tick<N>, Out>
            : W extends '-'
              ? Walk<S, R, T, Tick<N>, readonly [...Out, W]>
              : W extends `-${infer Cluster}`
                ? Short<S, Cluster, Cluster, R, T, Tick<N>, true, Out>
                : Walk<S, R, T, Tick<N>, readonly [...Out, W]>
    : Done<T, Out>;
/** Bounded literal execution of the source-recorded KEEP_UNKNOWN_OPT pass. */
type Parsed<S extends CommandSpec, A extends readonly unknown[]> = Serialize<
  S,
  A
> extends infer Words
  ? Words extends readonly string[]
    ? S extends { parserExit: { exceptFirst: readonly (infer Excluded)[] } }
      ? [Words[0]] extends [Excluded]
        ? Done<[], Words> & { delegated: true }
        : Walk<S, Words>
      : Walk<S, Words>
    : Deferred
  : never;

export type InitialParserPass<S, A extends readonly unknown[]> = S extends CommandSpec
  ? Parsed<S, A>
  : Invalid;

import type { CommandSpec, OptionSpec } from './spec.js';

type Tokens = readonly (readonly string[])[];
type Deferred = { exited: 'dynamic' };
type Invalid = { exited: 'invalid' };
type Done<T extends Tokens, R extends readonly string[]> = {
  exited: false;
  tokens: T;
  remaining: R;
};
type HelpFlags<S extends CommandSpec> = S extends {
  parserExit: { flags: readonly (infer F)[] };
}
  ? F
  : never;
type ExceptFirst<S extends CommandSpec> = S extends {
  parserExit: { exceptFirst: readonly (infer F)[] };
}
  ? F
  : never;
type FirstInternalHelp<F extends readonly string[], E> = F extends readonly [
  infer H extends string,
  ...infer R extends string[],
]
  ? H extends E
    ? FirstInternalHelp<R, E>
    : H
  : never;
type Help<S extends CommandSpec, T extends Tokens> = S extends {
  parserExit: { flags: infer F extends readonly string[] };
}
  ? { exited: true; tokens: readonly [...T, readonly [FirstInternalHelp<F, ExceptFirst<S>>]] }
  : never;
type ShortHelp<S extends CommandSpec, C extends string> = C extends 'h'
  ? '-h' extends HelpFlags<S>
    ? true
    : false
  : false;
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
type ArgumentOptions<S extends CommandSpec> = S extends {
  parserExit: { argumentOptions: infer O extends Readonly<Record<string, OptionSpec>> };
}
  ? O
  : S['options'];
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
        ? K extends keyof ArgumentOptions<S>
          ? Serialize<S, R, readonly [...Out, ...Emit<K, ArgumentOptions<S>[K], V>], Tick<N>>
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
type Unknown<
  S extends CommandSpec,
  W extends string,
  R extends readonly string[],
  T extends Tokens,
  N extends readonly unknown[],
  Out extends readonly string[],
> = S extends { parserExit: { mandatorySubcommand: true }; dispatch: infer D }
  ? W extends keyof D
    ? Done<T, R> & { subcommand: W }
    : Invalid
  : S extends { parserExit: { stopAtUnknown: true } } | { parserExit: { stopAtOperand: true } }
    ? Done<T, readonly [...Out, W, ...R]>
    : Walk<S, R, T, N, readonly [...Out, W]>;
type Unrecognized<
  S extends CommandSpec,
  W extends string,
  R extends readonly string[],
  T extends Tokens,
  N extends readonly unknown[],
  Out extends readonly string[],
> = S extends { parserExit: { unknownOptions: 'error' } } ? Invalid : Unknown<S, W, R, T, N, Out>;
type ResolveLong<
  S extends CommandSpec,
  F extends string,
  Form extends 'plain' | 'attached',
> = S extends { parserExit: { longForms: infer L } }
  ? Form extends keyof L
    ? F extends keyof L[Form]
      ? L[Form][F]
      : undefined
    : undefined
  : F extends '--help'
    ? Form extends 'attached'
      ? undefined
      : F
    : F;
type TakesOptionalDefault<
  D extends OptionSpec,
  R extends readonly string[],
> = D['value'] extends 'flag'
  ? true
  : D['value'] extends `optional-${string}`
    ? D extends { lastArgDefault: true }
      ? R extends readonly []
        ? true
        : false
      : true
    : false;
type LongOption<
  S extends CommandSpec,
  W extends string,
  K,
  V extends string | undefined,
  R extends readonly string[],
  T extends Tokens,
  N extends readonly unknown[],
  Out extends readonly string[],
> = K extends null
  ? Invalid
  : K extends string
    ? [Option<S, K>] extends [never]
      ? Unrecognized<S, W, R, T, N, Out>
      : V extends string
        ? Option<S, K>['value'] extends 'flag'
          ? Invalid
          : Walk<S, R, readonly [...T, readonly [K, V]], N, Out>
        : TakesOptionalDefault<Option<S, K>, R> extends true
          ? Walk<S, R, readonly [...T, readonly [K]], N, Out>
          : R extends readonly [infer Value extends string, ...infer Rest extends string[]]
            ? Walk<S, Rest, readonly [...T, readonly [K, Value]], N, Out>
            : Invalid
    : Unrecognized<S, W, R, T, N, Out>;
type Long<
  S extends CommandSpec,
  W extends string,
  R extends readonly string[],
  T extends Tokens,
  N extends readonly unknown[],
  Out extends readonly string[],
> = W extends `${infer F}=${infer V}`
  ? LongOption<S, W, ResolveLong<S, F, 'attached'>, V, R, T, N, Out>
  : LongOption<S, W, ResolveLong<S, W, 'plain'>, undefined, R, T, N, Out>;
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
      ? ShortHelp<S, C> extends true
        ? First extends true
          ? Typo<S, Original> extends true
            ? Invalid
            : Help<S, T>
          : Help<S, T>
        : [Option<S, `-${C}`>] extends [never]
          ? First extends true
            ? Typo<S, Original> extends true
              ? Invalid
              : Unrecognized<S, `-${W}`, R, T, N, Out>
            : Unrecognized<S, `-${W}`, R, T, N, Out>
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
              ? TakesOptionalDefault<Option<S, `-${C}`>, R> extends true
                ? Walk<S, R, readonly [...T, readonly [`-${C}`]], N, Out>
                : R extends readonly [infer V extends string, ...infer Tail extends string[]]
                  ? Walk<S, Tail, readonly [...T, readonly [`-${C}`, V]], N, Out>
                  : Invalid
              : Walk<S, R, readonly [...T, readonly [`-${C}`, Rest]], N, Out>
      : Walk<S, R, T, N, Out>;
export type DynamicWord<W extends string, N extends readonly unknown[] = []> = string extends W
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
        ? S extends { parserExit: { mandatorySubcommand: true } }
          ? Invalid
          : Done<
              T,
              W extends '--end-of-options'
                ? S extends { parserExit: { keepEndOfOptions: false } }
                  ? readonly [...Out, ...R]
                  : readonly [...Out, W, ...R]
                : S extends { parserExit: { keepDashDash: true } }
                  ? readonly [...Out, W, ...R]
                  : readonly [...Out, ...R]
            >
        : W extends '--help' | '--help-all'
          ? Help<S, T>
          : W extends `--${string}`
            ? Long<S, W, R, T, Tick<N>, Out>
            : W extends '-'
              ? Unknown<S, W, R, T, Tick<N>, Out>
              : W extends `-${infer Cluster}`
                ? Short<S, Cluster, Cluster, R, T, Tick<N>, true, Out>
                : Unknown<S, W, R, T, Tick<N>, Out>
    : S extends { parserExit: { mandatorySubcommand: true } }
      ? Invalid
      : Done<T, Out>;
type Wrapper = NonNullable<NonNullable<CommandSpec['parserExit']>['wrappers']>[number];
type SingleWordExits<S extends CommandSpec> = S extends {
  parserExit: { singleWordExits: infer F extends readonly string[] };
}
  ? F
  : readonly [];
type NativePass<S extends CommandSpec, Words extends readonly string[]> =
  Words extends readonly [infer W extends string]
    ? W extends SingleWordExits<S>[number]
      ? Help<S, []>
      : Walk<S, Words>
    : Walk<S, Words>;
type WrapperWalk<
  S extends CommandSpec,
  Words extends readonly string[],
  Wrappers,
> = Wrappers extends readonly [infer H, ...infer R]
  ? H extends Wrapper
    ? NativePass<
        Omit<S, 'parserExit'> & {
          parserExit: H & {
            flags: readonly ['-h', '--help'];
            firstPassOptions: readonly [];
            singleWordExits: SingleWordExits<S>;
          };
        },
        Words
      > extends infer P
      ? P extends { exited: false; remaining: infer Next extends readonly string[] }
        ? WrapperWalk<S, Next, R>
        : P
      : never
    : Invalid
  : NativePass<S, Words>;
type WithWrappers<S extends CommandSpec, Words extends readonly string[]> = S extends {
  parserExit: { wrappers: infer W };
}
  ? WrapperWalk<S, Words, W>
  : NativePass<S, Words>;
/** Bounded literal execution of the source-recorded KEEP_UNKNOWN_OPT passes. */
type Parsed<S extends CommandSpec, A extends readonly unknown[]> = Serialize<
  S,
  A
> extends infer Words
  ? Words extends readonly string[]
    ? S extends { parserExit: { exceptFirst: readonly (infer Excluded)[] } }
      ? [Words[0]] extends [Excluded]
        ? Done<[], Words> & { delegated: true }
        : WithWrappers<S, Words>
      : WithWrappers<S, Words>
    : Deferred
  : never;

export type InitialParserPass<S, A extends readonly unknown[]> = S extends CommandSpec
  ? Parsed<S, A>
  : Invalid;

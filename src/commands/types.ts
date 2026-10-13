import type { Constraint } from '../constraints/model.js';
import type { Constrained } from '../constraints/types.js';
import type { ExecOpts, RawResult } from '../core/types.js';
import type { COMMAND_SPECS } from './generated.js';
import type { OptionSpec } from './spec.js';

export type GitCommandName = keyof typeof COMMAND_SPECS;
type Spec<C extends GitCommandName> = (typeof COMMAND_SPECS)[C];
type Options<C extends GitCommandName> = Spec<C>['options'];
type Value<S extends OptionSpec> = S extends { allowed: infer A extends readonly unknown[] }
  ? A[number]
  : S['value'] extends 'flag' | 'boolean'
    ? boolean
    : S['value'] extends 'integer' | 'optional-integer'
      ? number
      : string;
type Token<K, S extends OptionSpec> = S['value'] extends 'flag'
  ? readonly [flag: K]
  : S['value'] extends 'boolean' | 'optional-string' | 'optional-integer'
    ? readonly [flag: K, value?: Value<S>]
    : readonly [flag: K, value: Value<S>];
/** Tuples identify options; objects identify positional operands. Their order is preserved. */
export type GitCommandArgument<C extends GitCommandName> = C extends GitCommandName
  ?
      | {
          [K in keyof Options<C>]: Options<C>[K] extends OptionSpec
            ? Token<K, Options<C>[K]>
            : never;
        }[keyof Options<C>]
      | { readonly operand: string }
      | (Spec<C>['separator'] extends false ? never : readonly ['--'])
  : never;
export type GitCommandExecOpts = ExecOpts & { stdin?: string };

type AllOptions<C extends GitCommandName> = Options<C>[keyof Options<C>] & OptionSpec;
type Base<C extends GitCommandName> = {
  [S in AllOptions<C> as S['key']]?:
    | Value<S>
    | DefaultValue<S>
    | (S['value'] extends 'optional-string' | 'optional-integer' ? true : never)
    | (S extends { repeat: true } ? readonly (Value<S> | DefaultValue<S>)[] : never);
} & {
  operands: readonly string[];
  operandsBeforeSeparator: readonly string[];
  pathsAfterSeparator: readonly string[];
  hasSeparator?: boolean;
  operand0?: string;
  inRepository?: boolean;
};
type Initial<C extends GitCommandName> = {
  [K in Exclude<
    keyof Base<C>,
    'operands' | 'operandsBeforeSeparator' | 'pathsAfterSeparator'
  >]?: undefined;
} & {
  operands: readonly [];
  operandsBeforeSeparator: readonly [];
  pathsAfterSeparator: readonly [];
};
type Put<S, K extends PropertyKey, V> = Omit<S, K> & { [P in K]: V };
type DefaultValue<D extends OptionSpec> = D extends { clear: true }
  ? undefined
  : D extends { set: infer V }
    ? V
    : true;
type TokenValue<T extends readonly unknown[], D extends OptionSpec> = T extends readonly [
  unknown,
  infer V,
]
  ? V extends undefined
    ? DefaultValue<D>
    : D extends { emptyIsUnset: true }
      ? V extends ''
        ? undefined
        : V
      : V
  : DefaultValue<D>;
type Append<S, D extends OptionSpec, V> = D extends { clear: true }
  ? readonly []
  : V extends false
    ? readonly []
    : D extends { skipEmpty: true }
      ? V extends ''
        ? D['key'] extends keyof S
          ? S[D['key']]
          : readonly []
        : Accumulate<S, D, V>
      : Accumulate<S, D, V>;
type Accumulate<S, D extends OptionSpec, V> = readonly [
  ...(D['key'] extends keyof S
    ? S[D['key']] extends readonly unknown[]
      ? S[D['key']]
      : readonly []
    : readonly []),
  V,
];
type Effects<S, E extends NonNullable<OptionSpec['effects']>> = E extends readonly [
  infer H extends NonNullable<OptionSpec['effects']>[number],
  ...infer R extends NonNullable<OptionSpec['effects']>,
]
  ? Effects<
      H extends { when: { equals: infer V } }
        ? H['key'] extends keyof S
          ? S[H['key']] extends V
            ? Put<S, H['key'], H['set']>
            : S
          : S
        : H extends { when: { notEquals: infer V } }
          ? H['key'] extends keyof S
            ? S[H['key']] extends V
              ? S
              : Put<S, H['key'], H['set']>
            : Put<S, H['key'], H['set']>
          : Put<S, H['key'], H['set']>,
      R
    >
  : S;
type OptionState<S, D extends OptionSpec, T extends readonly unknown[]> = D extends { repeat: true }
  ? Put<S, D['key'], Append<S, D, TokenValue<T, D>>>
  : Put<S, D['key'], TokenValue<T, D>>;
type ModeState<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
  modeGroup: infer G extends string;
}
  ? `mode:${G}` extends keyof S
    ? TokenValue<T, D> extends false | undefined
      ? never
      : S[`mode:${G}`] extends D['key']
        ? OptionState<S, D, T>
        : never
    : TokenValue<T, D> extends false | undefined
      ? OptionState<S, D, T>
      : Put<OptionState<S, D, T>, `mode:${G}`, D['key']>
  : OptionState<S, D, T>;
type ParsedState<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
  parser: 'config-type';
}
  ? TokenValue<T, D> extends undefined
    ? ModeState<S, D, T>
    : D['key'] extends keyof S
      ? Exclude<S[D['key']], undefined> extends never
        ? ModeState<S, D, T>
        : Extract<TokenValue<T, D>, S[D['key']]> extends never
          ? never
          : ModeState<S, D, T>
      : ModeState<S, D, T>
  : ModeState<S, D, T>;
type ParsingEnded<C extends GitCommandName, S> = S extends { ended: true }
  ? true
  : Spec<C> extends { optionParsing: 'stop-at-operand' }
    ? S extends { operands: readonly [] }
      ? false
      : true
    : false;
type AddOperand<
  S,
  V,
  K extends PropertyKey = S extends { ended: true }
    ? 'pathsAfterSeparator'
    : 'operandsBeforeSeparator',
> = Put<
  S,
  K,
  readonly [
    ...(K extends keyof S ? (S[K] extends readonly unknown[] ? S[K] : readonly []) : readonly []),
    V,
  ]
>;
type ApplyToken<C extends GitCommandName, S, T> = T extends readonly ['--']
  ? ParsingEnded<C, S> extends true
    ? never
    : Put<Put<S, 'ended', true>, 'hasSeparator', true>
  : T extends { operand: infer V extends string }
    ? S extends { operands: infer P extends readonly string[] }
      ? AddOperand<
          Put<
            Put<S, 'operands', readonly [...P, V]>,
            'operand0',
            P extends readonly [] ? V : S extends { operand0: infer F } ? F : string
          >,
          V
        >
      : never
    : ParsingEnded<C, S> extends true
      ? never
      : T extends readonly [infer K extends keyof Options<C>, ...unknown[]]
        ? Options<C>[K] extends infer D extends OptionSpec
          ? D extends { effects: infer E extends NonNullable<OptionSpec['effects']> }
            ? Effects<ParsedState<S, D, T>, E>
            : ParsedState<S, D, T>
          : never
        : S;
type State<
  C extends GitCommandName,
  A extends readonly unknown[],
  S = Initial<C>,
> = A extends readonly [infer H, ...infer Rest] ? State<C, Rest, ApplyToken<C, S, H>> : S;
// Evaluate one rule at a time: constructing their Cartesian union can exceed TypeScript's union limit.
type CheckRules<C extends GitCommandName, S, R extends readonly Constraint[]> = R extends readonly [
  infer H extends Constraint,
  ...infer Rest extends readonly Constraint[],
]
  ? S extends Constrained<S, readonly [H]>
    ? CheckRules<C, S, Rest>
    : false
  : true;
/** Literal option combinations are checked against the same schema as runtime calls. */
export type CheckedCommandArguments<
  C extends GitCommandName,
  A extends readonly GitCommandArgument<C>[],
> = number extends A['length']
  ? A
  : [State<C, A>] extends [never]
    ? never
    : State<C, A> extends { help: true }
      ? A
      : CheckRules<C, State<C, A>, Spec<C>['rules']> extends true
        ? A
        : never;

/** Typed CLI access for commands without a parsed convenience API. */
export interface GitCommandClient {
  command<C extends GitCommandName, const A extends readonly GitCommandArgument<NoInfer<C>>[]>(
    command: C,
    args: A & CheckedCommandArguments<C, A>,
    opts?: GitCommandExecOpts,
  ): Promise<RawResult>;
}

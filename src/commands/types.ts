import type {
  GitNumericLiteral,
  GitNumericParser,
  GitNumericValue,
} from '../constraints/git-numeric-types.js';
import type { Constraint, Predicate } from '../constraints/model.js';
import type { ObjectFilterLiteral } from '../constraints/object-filter-types.js';
import type { Constrained } from '../constraints/types.js';
import type { ExecOpts, RawResult } from '../core/types.js';
import type { COMMAND_SPECS } from './generated.js';
import type { OptionSpec } from './spec.js';

export type GitCommandName = keyof typeof COMMAND_SPECS;
type Spec<C extends GitCommandName> = (typeof COMMAND_SPECS)[C];
type Options<C extends GitCommandName> = Spec<C>['options'];
type NumericOption<C extends GitCommandName> =
  Spec<C> extends { numericOption: infer D extends OptionSpec } ? D : never;
type AsciiUpper =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z';
// Validate the supplied literal instead of enumerating 2^N enum spellings.
type AsciiLower<S extends string> = string extends S
  ? string
  : S extends `${infer H}${infer R}`
    ? `${H extends AsciiUpper ? Lowercase<H> : H}${AsciiLower<R>}`
    : S;
type Value<S extends OptionSpec> = S extends { parser: GitNumericParser }
  ? number | string | bigint
  : S extends { allowed: infer A extends readonly unknown[] }
    ? S extends { caseInsensitive: true }
      ? string | Exclude<A[number], string>
      : A[number]
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
type LocalCommandArgument<C extends GitCommandName> = C extends GitCommandName
  ?
      | {
          [K in keyof Options<C>]: Options<C>[K] extends OptionSpec
            ? Token<K, Options<C>[K]>
            : never;
        }[keyof Options<C>]
      | { readonly operand: string }
      | (Spec<C>['separator'] extends false ? never : readonly ['--'])
      | ([NumericOption<C>] extends [never] ? never : readonly [`-${number}` | `-${bigint}`])
  : never;
type Dispatch<C extends GitCommandName> = Spec<C> extends { dispatch: infer D } ? D : never;
type DispatchTarget<C extends GitCommandName> = Extract<
  Dispatch<C>[keyof Dispatch<C>],
  GitCommandName
>;
export type GitCommandArgument<C extends GitCommandName> =
  | LocalCommandArgument<C>
  | LocalCommandArgument<DispatchTarget<C>>;
export type GitCommandExecOpts = ExecOpts & { stdin?: string };

type OptionKeys<D> = D extends { key: infer K extends string } ? K : never;
type EffectKeys<D> = D extends { effects: readonly { key: infer K extends string }[] } ? K : never;
// Initial state needs only the keys. Expanding every option's value language here
// constructs unions that are immediately discarded and grows with the catalogue.
type Empty<C extends GitCommandName> = {
  [K in
    | OptionKeys<Options<C>[keyof Options<C>]>
    | EffectKeys<Options<C>[keyof Options<C>]>
    | OptionKeys<NumericOption<C>>
    | EffectKeys<NumericOption<C>>
    | 'argumentTokens'
    | 'hasSeparator'
    | 'operand0'
    | 'inRepository']?: undefined;
} & {
  operands: readonly [];
  operandsBeforeSeparator: readonly [];
  pathsAfterSeparator: readonly [];
};
type Initial<C extends GitCommandName> =
  Spec<C> extends { initial: infer D } ? Omit<Empty<C>, keyof D> & D : Empty<C>;
type Put<S, K extends PropertyKey, V> = Omit<S, K> & { [P in K]: V };
type DefaultValue<D extends OptionSpec> = D extends { clear: true }
  ? undefined
  : D extends { set: infer V }
    ? V
    : true;
type Normalize<V, D extends OptionSpec> = D extends { parser: infer P extends GitNumericParser }
  ? GitNumericValue<V, P>
  : D extends { caseInsensitive: true }
    ? D extends { preserveCase: true }
      ? V
      : V extends string
        ? AsciiLower<V>
        : V
    : V;
type TokenValue<T extends readonly unknown[], D extends OptionSpec> = Normalize<
  T extends readonly [unknown, infer V]
    ? V extends undefined
      ? DefaultValue<D>
      : D extends { emptyIsUnset: true }
        ? V extends ''
          ? undefined
          : V
        : V
    : DefaultValue<D>,
  D
>;
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
// Distinguish impossible conditions from unknown runtime values before updating parser state.
type EffectCondition<
  S,
  P extends readonly Predicate[],
  C = Constrained<
    S,
    readonly [
      {
        id: 'effect';
        kind: 'required';
        required: P;
        origin: 'git';
        source: '';
        reason: '';
      },
    ]
  >,
> = S extends C
  ? true
  : {
        [K in Extract<P[number]['key'], keyof S>]: K extends keyof C
          ? [C[K]] extends [never]
            ? K
            : never
          : K;
      }[Extract<P[number]['key'], keyof S>] extends never
    ? 'unknown'
    : false;
type Effects<S, E extends NonNullable<OptionSpec['effects']>> = [S] extends [never]
  ? never
  : E extends readonly [
        infer H extends NonNullable<OptionSpec['effects']>[number],
        ...infer R extends NonNullable<OptionSpec['effects']>,
      ]
    ? Effects<
        H extends { when: { all: infer P extends readonly Predicate[] } }
          ? EffectCondition<S, P> extends true
            ? Put<S, H['key'], H['set']>
            : EffectCondition<S, P> extends false
              ? S
              : Put<S, H['key'], string | number | boolean | undefined>
          : H extends { when: { equals: infer V } }
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
type UnparsedOptionState<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
  ignore: true;
}
  ? S
  : D extends { toggle: true }
    ? Put<S, D['key'], D['key'] extends keyof S ? (S[D['key']] extends true ? false : true) : true>
    : D extends { repeat: true }
      ? Put<S, D['key'], Append<S, D, TokenValue<T, D>>>
      : Put<S, D['key'], TokenValue<T, D>>;
type OptionState<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
  parser: 'rev-list-missing';
}
  ? TokenValue<T, D> extends 'error' | 'allow-any' | 'print' | 'print-info' | 'allow-promisor'
    ? UnparsedOptionState<S, D, T>
    : string extends TokenValue<T, D>
      ? UnparsedOptionState<S, D, T>
      : S
  : D extends { parser: { kind: 'decimal'; default: 'previous' } }
    ? T extends readonly [unknown] | readonly [unknown, undefined]
      ? S
      : UnparsedOptionState<S, D, T>
    : UnparsedOptionState<S, D, T>;
type ModeValue<D extends OptionSpec, T extends readonly unknown[]> = D extends {
  modeFromValue: true;
}
  ? TokenValue<T, D>
  : D extends { modeValue: infer M }
    ? M
    : D['key'];
type ModeState<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
  modeGroup: infer G extends string;
}
  ? `mode:${G}` extends keyof S
    ? TokenValue<T, D> extends false | undefined
      ? never
      : S[`mode:${G}`] extends ModeValue<D, T>
        ? OptionState<S, D, T>
        : never
    : TokenValue<T, D> extends false | undefined
      ? OptionState<S, D, T>
      : Put<OptionState<S, D, T>, `mode:${G}`, ModeValue<D, T>>
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
type CheckedCallbackState<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
  checks: infer R extends readonly Constraint[];
}
  ? CheckRules<Put<S, '$value', TokenValue<T, D>>, R> extends true
    ? ParsedState<S, D, T>
    : never
  : ParsedState<S, D, T>;
type ScalarLiteral<D extends OptionSpec, V> = D extends { parser: infer P extends GitNumericParser }
  ? GitNumericLiteral<V, P>
  : V extends string
    ? string extends V
      ? true
      : D extends { parser: 'object-filter' | 'object-filter-auto' }
        ? ObjectFilterLiteral<V, D['parser'] extends 'object-filter-auto' ? true : false>
        : D extends { parser: 'shortlog-group' }
          ? AsciiLower<V> extends 'author' | 'committer'
            ? true
            : V extends `trailer:${string}` | `format:${string}` | `${string}%${string}`
              ? true
              : false
          : D extends { parser: 'pull-rebase' }
            ? AsciiLower<V> extends '' | 'true' | 'false' | 'yes' | 'no' | 'on' | 'off'
              ? true
              : V extends 'merges' | 'm' | 'interactive' | 'i'
                ? true
                : // Git's signed/base/unit integer language is checked at runtime.
                  V extends `${'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '+' | '-' | ' ' | '\t' | '\r' | '\n' | '\v' | '\f'}${string}`
                  ? true
                  : false
            : true
    : true;
type AllowedEnumLiteral<D extends OptionSpec, T extends readonly unknown[]> = D extends {
  parser: GitNumericParser;
  allowed: infer A extends readonly unknown[];
}
  ? T extends readonly [unknown, infer V]
    ? V extends undefined
      ? true
      : number extends TokenValue<T, D>
        ? true
        : TokenValue<T, D> extends A[number]
          ? true
          : false
    : true
  : D extends {
        caseInsensitive: true;
        allowed: infer A extends readonly unknown[];
      }
    ? T extends readonly [unknown, infer V]
      ? V extends undefined
        ? true
        : V extends string
          ? string extends V
            ? true
            : AsciiLower<V> extends A[number]
              ? true
              : false
          : V extends A[number]
            ? true
            : false
      : true
    : true;
type AllowedLiteral<D extends OptionSpec, T extends readonly unknown[]> = T extends readonly [
  unknown,
  infer V,
]
  ? ScalarLiteral<D, V> extends true
    ? AllowedEnumLiteral<D, T>
    : false
  : AllowedEnumLiteral<D, T>;
type CheckedTokenState<S, D extends OptionSpec, T extends readonly unknown[]> = AllowedLiteral<
  D,
  T
> extends true
  ? CheckedCallbackState<S, D, T>
  : never;
type ParsingEnded<C extends GitCommandName, S> = S extends
  | { ended: true }
  | { literalOperands: true }
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
type Digits<S extends string> = S extends ''
  ? true
  : S extends `${'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'}${infer R}`
    ? Digits<R>
    : false;
type AppliedOption<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
  effects: infer E extends NonNullable<OptionSpec['effects']>;
}
  ? Effects<CheckedTokenState<S, D, T>, E>
  : CheckedTokenState<S, D, T>;
type ApplyOption<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
  consumesRest: true;
}
  ? [AppliedOption<S, D, T>] extends [never]
    ? never
    : Put<AppliedOption<S, D, T>, 'literalOperands', true>
  : AppliedOption<S, D, T>;
type NumericValue<D extends OptionSpec, Text extends string> = D extends {
  parser: GitNumericParser;
}
  ? Text
  : Text extends `${infer N extends number}`
    ? N
    : number;
type ApplyNumeric<C extends GitCommandName, S, T> = T extends readonly [`-${infer Text}`]
  ? (`${number}` extends Text ? true : `${bigint}` extends Text ? true : Digits<Text>) extends true
    ? NumericOption<C> extends { allowed: infer A extends readonly unknown[] }
      ? NumericValue<NumericOption<C>, Text> extends infer N
        ? (number extends N ? true : N extends A[number] ? true : false) extends true
          ? ApplyOption<S, NumericOption<C>, readonly [T[0], N]>
          : never
        : never
      : ApplyOption<S, NumericOption<C>, readonly [T[0], NumericValue<NumericOption<C>, Text>]>
    : never
  : S;
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
          ? ApplyOption<S, D, T>
          : never
        : ApplyNumeric<C, S, T>;
type State<
  C extends GitCommandName,
  A extends readonly unknown[],
  S = Put<Initial<C>, 'argumentTokens', A>,
> = [S] extends [never]
  ? never
  : A extends readonly [infer H, ...infer Rest]
    ? State<C, Rest, ApplyToken<C, Put<S, '$remaining', Rest>, H>>
    : S;
// Evaluate one rule at a time: constructing their Cartesian union can exceed TypeScript's union limit.
type CheckRules<S, R extends readonly Constraint[]> = R extends readonly [
  infer H extends Constraint,
  ...infer Rest extends readonly Constraint[],
]
  ? S extends Constrained<S, readonly [H]>
    ? CheckRules<S, Rest>
    : false
  : true;
/** Literal option combinations are checked against the same schema as runtime calls. */
type CheckedLocalArguments<
  C extends GitCommandName,
  A extends readonly unknown[],
> = A extends readonly LocalCommandArgument<C>[]
  ? number extends A['length']
    ? A
    : [State<C, A>] extends [never]
      ? never
      : State<C, A> extends { help: true }
        ? A
        : CheckRules<State<C, A>, Spec<C>['rules']> extends true
          ? A
          : never
  : never;

/** Dispatch precedes option callbacks, so fallback rules cannot reject a child command. */
export type CheckedCommandArguments<
  C extends GitCommandName,
  A extends readonly GitCommandArgument<C>[],
> = number extends A['length']
  ? A
  : A extends readonly [{ readonly operand: infer W extends string }, ...infer Rest]
    ? [Dispatch<C>] extends [never]
      ? CheckedLocalArguments<C, A>
      : string extends W
        ? A
        : W extends keyof Dispatch<C>
          ? Dispatch<C>[W] extends infer Target extends GitCommandName
            ? [CheckedLocalArguments<Target, Rest>] extends [never]
              ? never
              : A
            : never
          : CheckedLocalArguments<C, A>
    : CheckedLocalArguments<C, A>;

/** Typed CLI access for commands without a parsed convenience API. */
export interface GitCommandClient {
  command<C extends GitCommandName, const A extends readonly GitCommandArgument<NoInfer<C>>[]>(
    command: C,
    args: A & CheckedCommandArguments<C, A>,
    opts?: GitCommandExecOpts,
  ): Promise<RawResult>;
}

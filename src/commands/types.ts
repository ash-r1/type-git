import type { CompoundDecimalLiteral } from '../constraints/compound-decimal-types.js';
import type { AsciiLower, AsciiUpper } from '../constraints/ascii-types.js';
import type { GitBooleanCallback, GitBooleanSource } from '../constraints/git-boolean.js';
import type {
  GitBooleanCallbackLiteral,
  GitBooleanCallbackValue,
} from '../constraints/git-boolean-types.js';
import type { ArgumentsHaveLiteralNul } from './argument-string-types.js';
import type {
  GitNumericLiteral,
  GitNumericParser,
  GitNumericValue,
} from '../constraints/git-numeric-types.js';
import type {
  GitDecimalParser,
  GitDecimalCallback,
  GitDecimalCallbacks,
  LegacyGitDecimal,
} from '../constraints/git-decimal.js';
import type { GitIntegerParser } from '../constraints/git-integer.js';
import type { MainlineLiteral, MainlineValue } from '../constraints/mainline-types.js';
import type { Constraint, Predicate } from '../constraints/model.js';
import type { NumberLiteralOrder, SafeIntegerAtLeast } from '../constraints/number-types.js';
import type { ObjectFilterLiteral } from '../constraints/object-filter-types.js';
import type { Constrained } from '../constraints/types.js';
import type { ExecOpts, GitOutputMode, RawResult } from '../core/types.js';
import type { COMMAND_SPECS } from './generated.js';
import type { InitialParserPass } from './initial-parser-pass-types.js';
import type { OptionSpec } from './spec.js';
import type { CheckedGuiArguments, CommandGrammarContext } from './gui-syntax.js';

export type GitCommandName = keyof typeof COMMAND_SPECS;
type Spec<C extends GitCommandName> = (typeof COMMAND_SPECS)[C];
type Options<C extends GitCommandName> = Spec<C>['options'];
type NumericOption<C extends GitCommandName> =
  Spec<C> extends { numericOption: infer D extends OptionSpec } ? D : never;
type PrimitiveValue<S extends OptionSpec> = S['value'] extends 'flag' | 'boolean'
  ? boolean
  : S['value'] extends 'integer' | 'optional-integer'
    ? number
    : string;
type Value<S extends OptionSpec, MayBeIgnored extends boolean> = S extends {
  parser: GitNumericParser | 'python-int' | 'perl-int' | 'perl-int-gnu';
}
  ? number | string | bigint
  : MayBeIgnored extends true
    ? PrimitiveValue<S>
    : S extends { allowed: infer A extends readonly unknown[] }
      ? S extends { caseInsensitive: true }
        ? string | Exclude<A[number], string>
        : A[number]
      : PrimitiveValue<S>;
type Token<K, S extends OptionSpec, MayBeIgnored extends boolean> = S['value'] extends 'flag'
  ? readonly [flag: K]
  : S['value'] extends 'boolean' | 'optional-string' | 'optional-integer'
    ? readonly [flag: K, value?: Value<S, MayBeIgnored>]
    : readonly [flag: K, value: Value<S, MayBeIgnored>];
/** Tuples identify options; objects identify positional operands. Their order is preserved. */
type LocalCommandArgument<C extends GitCommandName> = C extends GitCommandName
  ?
      | {
          [K in keyof Options<C>]: Options<C>[K] extends OptionSpec
            ? Token<K, Options<C>[K], Spec<C> extends { parserExit: unknown } ? true : false>
            : never;
        }[keyof Options<C>]
      | { readonly operand: string }
      | (Spec<C>['separator'] extends false ? never : readonly ['--'])
      | ([NumericOption<C>] extends [never] ? never : readonly [`-${number}` | `-${bigint}`])
  : never;
type Dispatch<C extends GitCommandName> = Spec<C> extends { dispatch: infer D } ? D : never;
type DispatchOption<C extends GitCommandName> =
  Spec<C> extends {
    dispatchOptions: readonly (infer K)[];
  }
    ? K
    : never;
type DispatchTarget<C extends GitCommandName> = Extract<
  Dispatch<C>[keyof Dispatch<C>],
  GitCommandName
>;
export type GitCommandArgument<C extends GitCommandName> =
  | LocalCommandArgument<C>
  | LocalCommandArgument<DispatchTarget<C>>;
export type GitCommandExecOpts<Mode extends GitOutputMode = 'text'> = ExecOpts & {
  stdin?: string | Uint8Array;
  stdout?: Mode;
};

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
    | 'operand1'
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
type BooleanSourceOf<D> = D extends { booleanSource: infer P extends GitBooleanSource }
  ? P
  : 'modern';
type Normalize<V, D extends OptionSpec, Previous> = D extends {
  parser: infer P extends GitNumericParser;
}
  ? GitNumericValue<V, P>
  : D extends { parser: infer P extends GitBooleanCallback }
    ? GitBooleanCallbackValue<V, P, Previous, BooleanSourceOf<D>>
    : D extends { caseInsensitive: true }
      ? D extends { preserveCase: true }
        ? V extends string
          ? V extends object
            ? string
            : V
          : V
        : V extends string
          ? AsciiLower<V>
          : V
      : V;
type TokenValue<
  T extends readonly unknown[],
  D extends OptionSpec,
  Previous = undefined,
> = Normalize<
  T extends readonly [unknown, infer V]
    ? V extends undefined
      ? DefaultValue<D>
      : D extends { emptyIsUnset: true }
        ? V extends ''
          ? undefined
          : V
        : V
    : DefaultValue<D>,
  D,
  Previous
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
      : Put<
          S,
          D['key'],
          D extends { parser: 'mainline' }
            ? MainlineValue<TokenValue<T, D>>
            : TokenValue<T, D, D['key'] extends keyof S ? S[D['key']] : undefined>
        >;
type IntegerRangeValid<V, Min extends number, Max extends number> = V extends number
  ? [SafeIntegerAtLeast<V, Min, false>] extends [never]
    ? false
    : NumberLiteralOrder<V, Max> extends 1
      ? false
      : true
  : false;
type MissingAction = 'error' | 'allow-any' | 'print' | 'print-info' | 'allow-promisor';
type SelectedMissingActions<S, D extends OptionSpec, V> = V extends MissingAction
  ? Put<S, D['key'], V>
  : never;
// The native prescan ignores unknown actions. Preserve every possible recognized
// selection in unions/templates, alongside the prior state when an unknown value
// is possible. Opaque strings can contain any action at runtime.
type MissingOptionState<S, D extends OptionSpec, V> = V extends string
  ? V extends object
    ? S | SelectedMissingActions<S, D, MissingAction>
    :
        | (V extends MissingAction ? never : S)
        | SelectedMissingActions<S, D, Extract<MissingAction, V>>
  : S;
type OptionState<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
  parser: 'rev-list-missing';
}
  ? MissingOptionState<S, D, TokenValue<T, D>>
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
// Every possible accumulated/incoming pair must select the same single mode.
type IsUnion<T, Whole = T> = T extends unknown ? ([Whole] extends [T] ? false : true) : never;
type SameMode<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? [A] extends [never]
      ? false
      : string extends A
        ? false
        : number extends A
          ? false
          : IsUnion<A> extends false
            ? true
            : false
    : false
  : false;
type ModeState<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
  parser: 'revision-count';
}
  ? false extends IntegerRangeValid<TokenValue<T, D>, -2147483648, 2147483647>
    ? never
    : UncheckedModeState<S, D, T>
  : D extends { parser: 'unsigned-int' }
    ? false extends IntegerRangeValid<TokenValue<T, D>, 0, 4294967295>
      ? never
      : UncheckedModeState<S, D, T>
    : D extends { parser: 'unsigned-size' }
      ? // Literal contracts have no target ABI; represent valid LP64/LLP64 inputs.
        // Runtime parsing applies the actual size_t width on ILP32 hosts.
        false extends IntegerRangeValid<TokenValue<T, D>, 0, 9007199254740991>
        ? never
        : UncheckedModeState<S, D, T>
      : D extends { parser: 'mainline' }
        ? MainlineLiteral<TokenValue<T, D>> extends false
          ? never
          : UncheckedModeState<S, D, T>
        : UncheckedModeState<S, D, T>;
type UncheckedModeState<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
  modeGroup: infer G extends string;
}
  ? `mode:${G}` extends keyof S
    ? TokenValue<T, D> extends false | undefined
      ? never
      : SameMode<S[`mode:${G}`], ModeValue<D, T>> extends true
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
// Callback-only inputs avoid expanding persistent state for every argument.
type CheckedCallbackState<
  S,
  D extends OptionSpec,
  T extends readonly unknown[],
  Remaining extends readonly unknown[],
> = D extends {
  checks: infer R extends readonly Constraint[];
}
  ? CheckRules<Put<Put<S, '$value', TokenValue<T, D>>, '$remaining', Remaining>, R> extends true
    ? ParsedState<S, D, T>
    : never
  : ParsedState<S, D, T>;
type ImportSignLiteral<V> = V extends string
  ? string extends V
    ? true
    : V extends object
      ? true
      : {} extends Record<V, unknown>
        ? true
        : V extends
              | 'abort'
              | 'verbatim'
              | 'ignore'
              | 'warn-verbatim'
              | 'warn'
              | 'warn-strip'
              | 'strip'
              | 'abort-if-invalid'
              | 'strip-if-invalid'
              | 'sign-if-invalid'
              | `sign-if-invalid=${string}`
          ? true
          : false
  : true;
type PerlDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
// Complement of the ASCII characters admitted by Getopt::Long PAT_INT.
type PerlIntegerForbiddenAscii =
  | AsciiUpper
  | Lowercase<AsciiUpper>
  | '\u0000'
  | '\u0001'
  | '\u0002'
  | '\u0003'
  | '\u0004'
  | '\u0005'
  | '\u0006'
  | '\u0007'
  | '\b'
  | '\t'
  | '\u000b'
  | '\f'
  | '\r'
  | '\u000e'
  | '\u000f'
  | '\u0010'
  | '\u0011'
  | '\u0012'
  | '\u0013'
  | '\u0014'
  | '\u0015'
  | '\u0016'
  | '\u0017'
  | '\u0018'
  | '\u0019'
  | '\u001a'
  | '\u001b'
  | '\u001c'
  | '\u001d'
  | '\u001e'
  | '\u001f'
  | ' '
  | '!'
  | '"'
  | '#'
  | '$'
  | '%'
  | '&'
  | "'"
  | '('
  | ')'
  | '*'
  | ','
  | '.'
  | '/'
  | ':'
  | ';'
  | '<'
  | '='
  | '>'
  | '?'
  | '@'
  | '['
  | '\\'
  | ']'
  | '^'
  | '`'
  | '{'
  | '|'
  | '}'
  | '~'
  | '\u007f';
// Long literals defer to runtime before TypeScript's instantiation limit.
type PerlIntegerDigits<
  S extends string,
  Budget extends readonly unknown[] = readonly [],
> = Budget['length'] extends 192
  ? true
  : S extends '' | '\n'
    ? true
    : S extends `${infer H}${infer R}`
      ? H extends PerlDigit | '_'
        ? PerlIntegerDigits<R, readonly [...Budget, unknown]>
        : false
      : false;
type PerlIntegerStart<
  S extends string,
  Budget extends readonly unknown[] = readonly [],
> = Budget['length'] extends 192
  ? true
  : S extends `_${infer R}`
    ? PerlIntegerStart<R, readonly [...Budget, unknown]>
    : S extends `${infer H}${infer R}`
      ? H extends PerlDigit
        ? PerlIntegerDigits<R, readonly [...Budget, unknown]>
        : false
      : false;
type PerlIntegerText<
  S extends string,
  AllowEmpty extends boolean,
> = S extends `${string}${PerlIntegerForbiddenAscii}${string}`
  ? false // A known forbidden character cannot be repaired by dynamic text elsewhere.
  : {} extends Record<S, unknown>
    ? true // Nonliteral templates and dynamic strings remain runtime inputs.
    : S extends ''
      ? AllowEmpty
      : S extends `${'+' | '-'}${infer R}`
        ? PerlIntegerStart<R>
        : PerlIntegerStart<S>;
type PerlIntegerLiteral<D extends OptionSpec, V> = V extends string
  ? V extends object
    ? true
    : PerlIntegerText<V, D extends { parser: 'perl-int-gnu' } ? true : false>
  : V extends number | bigint
    ? PerlIntegerText<`${V}`, false>
    : false;
type ScalarLiteral<D extends OptionSpec, V> = D extends { parser: infer P extends GitNumericParser }
  ? GitNumericLiteral<V, P>
  : D extends { parser: infer P extends GitBooleanCallback }
    ? V extends undefined
      ? true
      : GitBooleanCallbackLiteral<V, P, BooleanSourceOf<D>>
    : D extends { parser: 'shortlog-wrap' | 'show-branch-reflog' }
      ? V extends undefined
        ? true
        : CompoundDecimalLiteral<
            V,
            D['parser'],
            D extends { compoundLongBits: infer B extends 32 | 64 } ? B : 64,
            D extends { compoundNegatedOverflow: true } ? true : false
          >
      : D extends {
            parser: 'object-filter' | 'object-filter-auto';
          }
        ? V extends string
          ? ObjectFilterLiteral<
              V,
              D['parser'] extends 'object-filter-auto' ? true : false,
              D extends { negativeMagnitudes: true } ? true : false
            >
          : true
        : D extends { parser: 'perl-int' | 'perl-int-gnu' }
          ? PerlIntegerLiteral<D, V>
          : D extends { parser: 'fast-import-sign' }
            ? ImportSignLiteral<V>
            : D extends { parser: 'anonymize-map' }
              ? V extends string
                ? string extends V
                  ? true
                  : V extends object
                    ? true
                    : V extends ''
                      ? false
                      : V extends `${infer Key}:${infer Replacement}`
                        ? Key extends ''
                          ? false
                          : Replacement extends ''
                            ? false
                            : true
                        : true
                : true
              : D extends { parser: 'shortlog-group' | 'pull-rebase' | 'fast-export-reencode' }
                ? ParsedScalarLiteral<D, V>
                : true;
type ParsedScalarLiteral<D extends OptionSpec, V> = V extends string
  ? string extends AsciiLower<V>
    ? true
    : D extends { parser: 'shortlog-group' }
      ? AsciiLower<V> extends 'author' | 'committer'
        ? true
        : V extends `trailer:${string}` | `format:${string}` | `${string}%${string}`
          ? true
          : false
      : D extends { parser: 'fast-export-reencode' }
        ? AsciiLower<V> extends '' | 'true' | 'false' | 'yes' | 'no' | 'on' | 'off' | 'abort'
          ? true
          : V extends `${'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '+' | '-' | ' ' | '\t' | '\r' | '\n' | '\v' | '\f'}${string}`
            ? true // Git's integer language is validated at runtime, as for pull --rebase.
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
          ? string extends AsciiLower<V>
            ? true
            : AsciiLower<V> extends A[number]
              ? true
              : false
          : V extends A[number]
            ? true
            : false
      : true
    : D extends { allowed: infer A extends readonly unknown[] }
      ? T extends readonly [unknown, infer V]
        ? V extends undefined
          ? true
          : string extends V
            ? true
            : [V] extends [A[number]]
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
type CheckedTokenState<
  S,
  D extends OptionSpec,
  T extends readonly unknown[],
  Remaining extends readonly unknown[],
> = AllowedLiteral<D, T> extends true ? CheckedCallbackState<S, D, T, Remaining> : never;
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
type AppliedOption<
  S,
  D extends OptionSpec,
  T extends readonly unknown[],
  Remaining extends readonly unknown[],
> = D extends {
  effects: infer E extends NonNullable<OptionSpec['effects']>;
}
  ? Effects<CheckedTokenState<S, D, T, Remaining>, E>
  : CheckedTokenState<S, D, T, Remaining>;
type PositionedOption<
  S,
  D extends OptionSpec,
  T extends readonly unknown[],
  Remaining extends readonly unknown[],
> = D extends {
  consumesRest: true;
}
  ? [AppliedOption<S, D, T, Remaining>] extends [never]
    ? never
    : Put<AppliedOption<S, D, T, Remaining>, 'literalOperands', true>
  : AppliedOption<S, D, T, Remaining>;
type ApplyOption<
  S,
  D extends OptionSpec,
  T extends readonly unknown[],
  Remaining extends readonly unknown[],
  First extends boolean,
> = D extends { firstOnly: true }
  ? First extends true
    ? PositionedOption<S, D, T, Remaining>
    : never
  : PositionedOption<S, D, T, Remaining>;
type NumericValue<D extends OptionSpec, Text extends string> = D extends {
  parser: GitNumericParser;
}
  ? Text
  : Text extends `${infer N extends number}`
    ? N
    : number;
type ApplyNumeric<
  C extends GitCommandName,
  S,
  T,
  Remaining extends readonly unknown[],
  First extends boolean,
> = T extends readonly [`-${infer Text}`]
  ? (`${number}` extends Text ? true : `${bigint}` extends Text ? true : Digits<Text>) extends true
    ? NumericOption<C> extends { allowed: infer A extends readonly unknown[] }
      ? NumericValue<NumericOption<C>, Text> extends infer N
        ? (number extends N ? true : N extends A[number] ? true : false) extends true
          ? ApplyOption<S, NumericOption<C>, readonly [T[0], N], Remaining, First>
          : never
        : never
      : ApplyOption<
          S,
          NumericOption<C>,
          readonly [T[0], NumericValue<NumericOption<C>, Text>],
          Remaining,
          First
        >
    : never
  : S;
// Keep parser uncertainty separate from input unions: each source family must
// validate the whole tuple, and ordinary invalid union arms cannot disappear.
type IntegerProfiledOption<S, D extends OptionSpec> = S extends { integerProfile: 'decimal-cast' }
  ? D extends { parser: infer P extends GitIntegerParser }
    ? P extends { bits: 32 }
      ? P extends { nativeWidth: string }
        ? D
        : Omit<D, 'parser'> & { parser: P & { integerProfile: 'decimal-cast' } }
      : D
    : D
  : D;
type MagnitudeProfiledOption<S, D extends OptionSpec> = S extends { negativeMagnitudes: true }
  ? D extends { parser: infer P extends GitIntegerParser }
    ? P extends { negativeMagnitudes: false }
      ? D
      : Omit<D, 'parser'> & { parser: P & { negativeMagnitudes: true } }
    : D & { negativeMagnitudes: true }
  : D;
type DecimalProfiledOption<S, D extends OptionSpec> = S extends {
  decimalLongBits: infer Bits extends 32 | 64;
}
  ? D extends { parser: infer P extends GitDecimalParser }
    ? Omit<D, 'parser'> & { parser: Omit<P, 'longBits'> & { longBits: Bits } }
    : D extends { parser: 'shortlog-wrap' | 'show-branch-reflog' }
      ? D & {
          compoundLongBits: Bits;
          compoundNegatedOverflow: S extends { compoundNegatedOverflow: true } ? true : false;
        }
      : D
  : D;
type CallbackProfiledOption<S, D extends OptionSpec> = D extends {
  parser: infer P extends GitDecimalParser & { nativeCallback: GitDecimalCallback };
}
  ? S extends { decimalCallbacks: infer F extends GitDecimalCallbacks }
    ? F[P['nativeCallback']] extends 'legacy'
      ? Omit<D, 'parser'> & { parser: LegacyGitDecimal<P> }
      : D
    : D
  : D;
/** Defer old string-option validation and effects until parsing ends. */
type ConflictProfiledOption<S, D extends OptionSpec> = S extends { conflictStyle: 'deferred' }
  ? D extends { nativeEnumCallback: 'conflict-style' }
    ? Omit<D, 'allowed' | 'effects'>
    : D
  : D;
/** A first --help selects git-help; command-specific conflict options are unknown there. */
type DispatcherProfiledOption<S, D extends OptionSpec> = S extends {
  argumentTokens: readonly [readonly ['--help'], ...unknown[]];
}
  ? D extends { nativeEnumCallback: 'conflict-style' }
    ? never
    : D
  : D;
/** Apply one recorded boolean family to every callback in the same state walk. */
type BooleanProfiledOption<S, D extends OptionSpec> = S extends {
  booleanSource: infer P extends GitBooleanSource;
}
  ? D extends { parser: GitBooleanCallback }
    ? D & { booleanSource: P }
    : D
  : D;
type ProfiledOption<S, D extends OptionSpec> = DispatcherProfiledOption<
  S,
  BooleanProfiledOption<
    S,
    ConflictProfiledOption<
      S,
      DecimalProfiledOption<
        S,
        CallbackProfiledOption<S, MagnitudeProfiledOption<S, IntegerProfiledOption<S, D>>>
      >
    >
  >
>;
type ApplyToken<
  C extends GitCommandName,
  S,
  T,
  Remaining extends readonly unknown[],
  First extends boolean,
> = T extends readonly ['--']
  ? ParsingEnded<C, S> extends true
    ? never
    : Put<Put<S, 'ended', true>, 'hasSeparator', true>
  : T extends { operand: infer V extends string }
    ? S extends { operands: infer P extends readonly string[] }
      ? AddOperand<
          Put<
            Put<
              Put<S, 'operands', readonly [...P, V]>,
              'operand1',
              P extends readonly [string]
                ? V
                : S extends { operand1: infer Second }
                  ? Second
                  : undefined
            >,
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
          ? ApplyOption<S, ProfiledOption<S, D>, T, Remaining, First>
          : never
        : ApplyNumeric<C, S, T, Remaining, First>;
type ExitFlag<C extends GitCommandName, First extends boolean> = Spec<C> extends {
  parserExit: { flags: readonly (infer Flag)[] };
}
  ? First extends true
    ? Spec<C> extends { parserExit: { exceptFirst: readonly (infer Excluded)[] } }
      ? Exclude<Flag, Excluded>
      : Flag
    : Flag
  : never;
type State<
  C extends GitCommandName,
  A extends readonly unknown[],
  S = Put<Initial<C>, 'argumentTokens', A>,
  First extends boolean = true,
> = [S] extends [never]
  ? never
  : S extends { parserExited: true }
    ? S
    : A extends readonly [infer H, ...infer Rest]
      ? H extends readonly [ExitFlag<C, First>]
        ? ParsingEnded<C, S> extends true
          ? never
          : Put<S, 'parserExited', true>
        : State<C, Rest, ApplyToken<C, S, H, Rest, First>, false>
      : S;
/** A bad reached callback stays invalid even when another input-union arm exits. */
type InvalidPass = { invalidParserPass: true };
type ParsedPassState<
  C extends GitCommandName,
  A extends readonly unknown[],
  Pass,
  InitialState,
> = Pass extends { exited: true; tokens: infer T extends readonly unknown[] }
  ? [State<C, T, InitialState>] extends [never]
    ? InvalidPass
    : State<C, T, InitialState>
  : Pass extends { exited: 'invalid' }
    ? InvalidPass
    : Pass extends { exited: 'dynamic' }
      ? { parserExited: true }
      : State<C, A, InitialState>;
/** Initial-pass projection preserves every independently selected scalar and ABI trait. */
type CommandState<
  C extends GitCommandName,
  A extends readonly unknown[],
  InitialState = Initial<C>,
> = Spec<C> extends { parserExit: { firstPassOptions: readonly string[] } }
  ? ParsedPassState<C, A, InitialParserPass<Spec<C>, A>, InitialState> extends infer S
    ? [Extract<S, InvalidPass>] extends [never]
      ? S
      : never
    : never
  : State<C, A, InitialState>;
type ProfiledConstraint<S, R extends Constraint> = R extends {
  kind: 'scalar';
  key: string;
  parser: infer P;
}
  ? P extends GitNumericParser
    ? ProfiledOption<S, { key: R['key']; value: 'string'; parser: P }> extends { parser: infer Q }
      ? Omit<R, 'parser'> & { parser: Q }
      : R
    : S extends { negativeMagnitudes: true }
      ? R & { negativeMagnitudes: true }
      : R
  : R;
// Evaluate one rule at a time: constructing their Cartesian union can exceed TypeScript's union limit.
type CheckRules<S, R extends readonly Constraint[]> = R extends readonly [
  infer H extends Constraint,
  ...infer Rest extends readonly Constraint[],
]
  ? S extends Constrained<S, readonly [ProfiledConstraint<S, H>]>
    ? CheckRules<S, Rest>
    : false
  : true;
type CheckedLegacyIntegerArguments<
  C extends GitCommandName,
  A extends readonly unknown[],
  IntegerProfile extends 'bounded' | 'decimal-cast' = 'decimal-cast',
  Negative extends boolean = false,
  LongBits extends 32 | 64 = 64,
  Callbacks extends GitDecimalCallbacks = {},
  CompoundOverflow extends boolean = false,
  S = CommandState<
    C,
    A,
    Put<
      Put<
        Put<
          Put<Put<Initial<C>, 'argumentTokens', A>, 'integerProfile', IntegerProfile>,
          'negativeMagnitudes',
          Negative
        >,
        'decimalLongBits',
        LongBits
      >,
      'decimalCallbacks',
      Callbacks
    > & { compoundNegatedOverflow: CompoundOverflow }
  >,
> = [S] extends [never]
  ? never
  : S extends { help: true } | { parserExited: true }
    ? A
    : CheckRules<S, Spec<C>['rules']> extends true
      ? A
      : never;
type CheckedIntegerAlternativesAtWidth<
  C extends GitCommandName,
  A extends readonly unknown[],
  Bits extends 32 | 64,
> = [CheckedLegacyIntegerArguments<C, A, 'decimal-cast', false, Bits>] extends [never]
  ? [CheckedLegacyIntegerArguments<C, A, 'bounded', true, Bits>] extends [never]
    ? CheckedLegacyIntegerArguments<C, A, 'decimal-cast', true, Bits>
    : A
  : A;
/** Avoid replaying a whole tuple for a width that cannot change any callback state. */
type DecimalWidthChanges<
  C extends GitCommandName,
  A extends readonly unknown[],
  F extends GitDecimalCallbacks = {},
> = A extends readonly [infer T, ...infer Rest]
  ? T extends readonly [infer K extends keyof Options<C>, ...unknown[]]
    ? CallbackProfiledOption<
        { decimalCallbacks: F },
        Extract<Options<C>[K], OptionSpec>
      > extends infer D extends OptionSpec
      ? D extends { parser: infer P extends GitDecimalParser & { conversion: 'cast' | 'atoi' } }
        ? GitNumericValue<
            T extends readonly [unknown, infer V] ? V : DefaultValue<D>,
            P
          > extends infer Wide
          ? GitNumericValue<
              T extends readonly [unknown, infer V] ? V : DefaultValue<D>,
              Omit<P, 'longBits'> & { longBits: 32 }
            > extends infer Narrow
            ? [Wide] extends [Narrow]
              ? [Narrow] extends [Wide]
                ? DecimalWidthChanges<C, Rest, F>
                : true
              : true
            : never
          : never
        : D extends { parser: 'shortlog-wrap' | 'show-branch-reflog' }
          ? CompoundDecimalLiteral<
              T extends readonly [unknown, infer V] ? V : DefaultValue<D>,
              D['parser'],
              64
            > extends CompoundDecimalLiteral<
              T extends readonly [unknown, infer V] ? V : DefaultValue<D>,
              D['parser'],
              32
            >
            ? DecimalWidthChanges<C, Rest, F>
            : true
          : DecimalWidthChanges<C, Rest, F>
      : false
    : DecimalWidthChanges<C, Rest, F>
  : false;
type CheckedIntegerAlternatives<
  C extends GitCommandName,
  A extends readonly unknown[],
> = TupleIntegerTraits<C, A> extends true
  ? [CheckedIntegerAlternativesAtWidth<C, A, 64>] extends [never]
    ? DecimalWidthChanges<C, A> extends true
      ? CheckedIntegerAlternativesAtWidth<C, A, 32>
      : never
    : A
  : DecimalWidthChanges<C, A> extends true
    ? CheckedLegacyIntegerArguments<C, A, 'bounded', false, 32>
    : never;
type TupleCallbacks<C extends GitCommandName, A extends readonly unknown[]> = A extends readonly [
  infer T,
  ...infer Rest,
]
  ? T extends readonly [infer K extends keyof Options<C>, ...unknown[]]
    ? Options<C>[K] extends {
        parser: { kind: 'decimal'; nativeCallback: infer F extends GitDecimalCallback };
      }
      ? F | TupleCallbacks<C, Rest>
      : TupleCallbacks<C, Rest>
    : TupleCallbacks<C, Rest>
  : never;
type CallbackChoices<K extends GitDecimalCallback> = ('unified-context' extends K
  ? { 'unified-context': 'modern' } | { 'unified-context': 'legacy' }
  : {}) &
  ('revision-count' extends K
    ? { 'revision-count': 'modern' } | { 'revision-count': 'legacy' }
    : {}) &
  ('strip-count' extends K ? { 'strip-count': 'modern' } | { 'strip-count': 'legacy' } : {}) &
  ('daemon-count' extends K ? { 'daemon-count': 'modern' } | { 'daemon-count': 'legacy' } : {}) &
  ('daemon-timeout' extends K
    ? { 'daemon-timeout': 'modern' } | { 'daemon-timeout': 'legacy' }
    : {}) &
  ('daemon-init-timeout' extends K
    ? { 'daemon-init-timeout': 'modern' } | { 'daemon-init-timeout': 'legacy' }
    : {});
/** Source-family alternatives are relevant only to schema integers and object filters. */
type TupleIntegerTraits<
  C extends GitCommandName,
  A extends readonly unknown[],
> = A extends readonly [infer T, ...infer Rest]
  ? T extends readonly [infer K extends keyof Options<C>, ...unknown[]]
    ? Options<C>[K] extends { parser: infer P }
      ? P extends { kind: 'integer' } | 'object-filter' | 'object-filter-auto'
        ? true
        : TupleIntegerTraits<C, Rest>
      : TupleIntegerTraits<C, Rest>
    : TupleIntegerTraits<C, Rest>
  : false;
type CheckedCallbackWidth<
  C extends GitCommandName,
  A extends readonly unknown[],
  F extends GitDecimalCallbacks,
  Bits extends 32 | 64,
> = [CheckedLegacyIntegerArguments<C, A, 'bounded', false, Bits, F>] extends [never]
  ? TupleIntegerTraits<C, A> extends true
    ? [CheckedLegacyIntegerArguments<C, A, 'decimal-cast', false, Bits, F>] extends [never]
      ? [CheckedLegacyIntegerArguments<C, A, 'bounded', true, Bits, F>] extends [never]
        ? CheckedLegacyIntegerArguments<C, A, 'decimal-cast', true, Bits, F>
        : A
      : A
    : never
  : A;
type CheckedCallbackChoice<
  C extends GitCommandName,
  A extends readonly unknown[],
  F extends GitDecimalCallbacks,
> = F extends unknown
  ? Extract<F[keyof F], 'legacy'> extends never
    ? never
    : [CheckedCallbackWidth<C, A, F, 64>] extends [never]
      ? DecimalWidthChanges<C, A, F> extends true
        ? CheckedCallbackWidth<C, A, F, 32>
        : never
      : A
  : never;
/** Detect compound callbacks without replaying unrelated numeric families. */
type TupleUsesCompound<
  C extends GitCommandName,
  A extends readonly unknown[],
> = A extends readonly [infer T, ...infer Rest]
  ? T extends readonly [infer K extends keyof Options<C>, ...unknown[]]
    ? Options<C>[K] extends { parser: 'shortlog-wrap' | 'show-branch-reflog' }
      ? true
      : TupleUsesCompound<C, Rest>
    : TupleUsesCompound<C, Rest>
  : false;
/** One consistent overflow and long-width implementation governs the complete tuple. */
type CompoundOverflowAxes<
  C extends GitCommandName,
  A extends readonly unknown[],
  I extends 'bounded' | 'decimal-cast',
  N extends boolean,
  B extends 32 | 64,
  F extends GitDecimalCallbacks,
> = I extends unknown
  ? N extends unknown
    ? B extends unknown
      ? F extends unknown
        ? CheckedLegacyIntegerArguments<C, A, I, N, B, F, true>
        : never
      : never
    : never
  : never;
/** Keep generic arrays lazy; only concrete compound tuples add the observed overflow alternative. */
type CheckedCompoundOverflow<
  C extends GitCommandName,
  A extends readonly unknown[],
> = A extends readonly [unknown, ...unknown[]]
  ? TupleUsesCompound<C, A> extends true
    ? CompoundOverflowAxes<
        C,
        A,
        TupleIntegerTraits<C, A> extends true ? 'bounded' | 'decimal-cast' : 'bounded',
        TupleIntegerTraits<C, A> extends true ? false | true : false,
        32 | 64,
        CallbackChoices<TupleCallbacks<C, A>>
      >
    : never
  : never;
type CheckedNumericAlternatives<C extends GitCommandName, A extends readonly unknown[]> = [
  CheckedIntegerAlternatives<C, A>,
] extends [never]
  ? [TupleCallbacks<C, A>] extends [never]
    ? CheckedCompoundOverflow<C, A>
    : [CheckedCallbackChoice<C, A, CallbackChoices<TupleCallbacks<C, A>>>] extends [never]
      ? CheckedCompoundOverflow<C, A>
      : A
  : A;
/** The old string callback validates only the last stored value after parsing. */
type DeferredConflictValid<S> = S extends { conflict: infer V }
  ? string extends V
    ? true
    : V extends object
      ? true
      : [V] extends ['merge' | 'diff3' | 'zdiff3' | undefined]
        ? true
        : false
  : true;
/** The old parser applies the implied merge after consuming all options. */
type DeferredConflictFinalState<S> = S extends { conflict: infer V }
  ? [V] extends [undefined]
    ? S
    : Put<S, 'merge', true>
  : S;
/** Help stops before final value validation; ordinary tuples keep all final rules. */
type DeferredConflictResult<C extends GitCommandName, A extends readonly unknown[], S> = [
  S,
] extends [never]
  ? never
  : S extends { help: true } | { parserExited: true }
    ? A
    : DeferredConflictValid<S> extends true
      ? CheckRules<DeferredConflictFinalState<S>, Spec<C>['rules']> extends true
        ? A
        : never
      : never;
// Each parser family is applied to the entire tuple, preserving invalid union arms.
type DeferredConflictAlternatives<
  C extends GitCommandName,
  A extends readonly unknown[],
  I extends 'bounded' | 'decimal-cast' = 'bounded' | 'decimal-cast',
  N extends boolean = false | true,
  B extends 32 | 64 = 32 | 64,
  F extends GitDecimalCallbacks = CallbackChoices<TupleCallbacks<C, A>>,
> = I extends unknown
  ? N extends unknown
    ? B extends unknown
      ? F extends unknown
        ? DeferredConflictResult<
            C,
            A,
            CommandState<
              C,
              A,
              Put<
                Put<
                  Put<
                    Put<
                      Put<Put<Initial<C>, 'argumentTokens', A>, 'integerProfile', I>,
                      'negativeMagnitudes',
                      N
                    >,
                    'decimalLongBits',
                    B
                  >,
                  'decimalCallbacks',
                  F
                >,
                'conflictStyle',
                'deferred'
              >
            >
          >
        : never
      : never
    : never
  : never;
/** An explicit immediate profile cannot accept a tuple only valid under deferred timing. */
type ConflictArgumentsFallback<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx,
> = Ctx extends { conflictStyle: 'immediate' }
  ? never
  : Extract<Options<C>[keyof Options<C>], { nativeEnumCallback: 'conflict-style' }> extends never
    ? never
    : DeferredConflictAlternatives<C, A>;
/** Check the normal parser family and existing numeric whole-tuple alternatives. */
type CheckedLocalParserArguments<
  C extends GitCommandName,
  A extends readonly unknown[],
> = number extends A['length']
  ? A
  : [CommandState<C, A>] extends [never]
    ? CheckedNumericAlternatives<C, A>
    : CommandState<C, A> extends { help: true } | { parserExited: true }
      ? A
      : CheckRules<CommandState<C, A>, Spec<C>['rules']> extends true
        ? A
        : CheckedNumericAlternatives<C, A>;
/** Keep the established numeric/conflict validation path for all unaffected tuples. */
type ExistingLocalProfiles<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
> = Ctx extends { conflictStyle: 'deferred' }
  ? Extract<Options<C>[keyof Options<C>], { nativeEnumCallback: 'conflict-style' }> extends never
    ? [CheckedLocalParserArguments<C, A>] extends [never]
      ? CombinedArgumentsFallback<C, A, Ctx>
      : A
    : CombinedArgumentsFallback<C, A, Ctx>
  : [CheckedLocalParserArguments<C, A>] extends [never]
    ? CombinedArgumentsFallback<C, A, Ctx>
    : A;
/** Literal option combinations are checked against the same schema as runtime calls. */
type CheckedLocalArguments<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext = {},
> = Spec<C> extends { guiScript: true }
  ? A extends readonly GitCommandArgument<C>[]
    ? CheckedGuiArguments<Spec<C>, A, Ctx>
    : never
  : A extends readonly LocalCommandArgument<C>[]
    ? Ctx extends { booleanSource: infer Source extends GitBooleanSource }
      ? Source extends 'modern'
        ? ExistingLocalProfiles<C, A, Ctx>
        : TupleUsesBoolean<C, A> extends true
          ? BooleanTupleFamilies<C, A, Source, Ctx>
          : ExistingLocalProfiles<C, A, Ctx>
      : ExistingLocalProfiles<C, A, Ctx>
    : never;

/** Precompute the small command set instead of comparing every command's option union during inference. */
type BooleanCommandName = {
  [C in GitCommandName]: [
    Extract<Options<C>[keyof Options<C>], { parser: GitBooleanCallback }>,
  ] extends [never]
    ? never
    : C;
}[GitCommandName];
type TupleUsesConflict<
  C extends GitCommandName,
  A extends readonly unknown[],
> = A extends readonly [infer T, ...infer Rest]
  ? T extends readonly [infer K extends keyof Options<C>, ...unknown[]]
    ? Options<C>[K] extends { nativeEnumCallback: 'conflict-style' }
      ? true
      : TupleUsesConflict<C, Rest>
    : TupleUsesConflict<C, Rest>
  : false;
/** Source uncertainty is evaluated per complete tuple; invalid input unions remain invalid. */
type BooleanTupleResult<C extends GitCommandName, A extends readonly unknown[], S> = [S] extends [
  never,
]
  ? never
  : S extends { help: true } | { parserExited: true }
    ? A
    : S extends { conflictStyle: 'deferred' }
      ? DeferredConflictResult<C, A, S>
      : CheckRules<S, Spec<C>['rules']> extends true
        ? A
        : never;
type BooleanTupleAxes<
  C extends GitCommandName,
  A extends readonly unknown[],
  Source extends GitBooleanSource,
  I extends 'bounded' | 'decimal-cast',
  N extends boolean,
  B extends 32 | 64,
  F extends GitDecimalCallbacks,
  Conflict extends 'immediate' | 'deferred',
> = Source extends unknown
  ? I extends unknown
    ? N extends unknown
      ? B extends unknown
        ? F extends unknown
          ? Conflict extends unknown
            ? BooleanTupleResult<
                C,
                A,
                CommandState<
                  C,
                  A,
                  Put<
                    Put<
                      Put<
                        Put<
                          Put<
                            Put<Put<Initial<C>, 'argumentTokens', A>, 'integerProfile', I>,
                            'negativeMagnitudes',
                            N
                          >,
                          'decimalLongBits',
                          B
                        >,
                        'decimalCallbacks',
                        F
                      >,
                      'conflictStyle',
                      Conflict
                    >,
                    'booleanSource',
                    Source
                  >
                >
              >
            : never
          : never
        : never
      : never
    : never
  : never;
/** Delay numeric callback combinations until the argument list is a concrete nonempty tuple. */
type BooleanTupleFamilies<
  C extends GitCommandName,
  A extends readonly unknown[],
  Source extends GitBooleanSource,
  Ctx extends CommandGrammarContext,
> = A extends readonly [unknown, ...unknown[]]
  ? BooleanTupleAxes<
      C,
      A,
      Source,
      TupleIntegerTraits<C, A> extends true ? 'bounded' | 'decimal-cast' : 'bounded',
      TupleIntegerTraits<C, A> extends true ? false | true : false,
      TupleIntegerTraits<C, A> extends true
        ? 32 | 64
        : [TupleCallbacks<C, A>] extends [never]
          ? 64
          : 32 | 64,
      CallbackChoices<TupleCallbacks<C, A>>,
      Ctx extends { conflictStyle: infer P extends 'immediate' | 'deferred' }
        ? P
        : TupleUsesConflict<C, A> extends true
          ? 'immediate' | 'deferred'
          : 'immediate'
    >
  : A;
type TupleUsesBoolean<C extends GitCommandName, A extends readonly unknown[]> = A extends readonly [
  infer T,
  ...infer Rest,
]
  ? T extends readonly [infer K extends keyof Options<C>, ...unknown[]]
    ? Options<C>[K] extends { parser: GitBooleanCallback }
      ? true
      : TupleUsesBoolean<C, Rest>
    : TupleUsesBoolean<C, Rest>
  : false;
/** Invoke source alternatives only after the existing tuple checker has rejected the tuple. */
type BooleanArgumentsFallback<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
> = number extends A['length']
  ? A
  : TupleUsesBoolean<C, A> extends true
    ? Ctx extends { booleanSource: 'modern' }
      ? never
      : BooleanTupleFamilies<
          C,
          A,
          Ctx extends { booleanSource: infer P extends GitBooleanSource }
            ? P
            : 'legacy-units' | 'symmetric',
          Ctx
        >
    : never;
type CombinedArgumentsFallback<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
> = C extends BooleanCommandName
  ? [ConflictArgumentsFallback<C, A, Ctx>] extends [never]
    ? BooleanArgumentsFallback<C, A, Ctx>
    : A
  : ConflictArgumentsFallback<C, A, Ctx>;

/** Collect invalid finite dispatch alternatives before accepting the complete tuple. */
type InvalidDispatchAlternative<
  C extends GitCommandName,
  W extends string,
  Rest extends readonly unknown[],
  Prefix extends readonly unknown[] = readonly [],
  Ctx extends CommandGrammarContext = {},
> = W extends unknown
  ? string extends W
    ? never
    : W extends object
      ? never
      : {} extends Record<W, unknown>
        ? never
        : W extends keyof Dispatch<C>
          ? Dispatch<C>[W] extends infer Target extends GitCommandName
            ? [CheckedLocalArguments<Target, readonly [...Prefix, ...Rest], Ctx>] extends [never]
              ? true
              : never
            : true
          : [
                CheckedLocalArguments<
                  C,
                  readonly [...Prefix, { readonly operand: W }, ...Rest],
                  Ctx
                >,
              ] extends [never]
            ? true
            : never
  : never;

type CheckedDispatchedArguments<
  C extends GitCommandName,
  A extends readonly unknown[],
  Remaining extends readonly unknown[] = A,
  Prefix extends readonly unknown[] = readonly [],
  Ctx extends CommandGrammarContext = {},
> = Remaining extends readonly [{ readonly operand: infer W extends string }, ...infer Rest]
  ? [InvalidDispatchAlternative<C, W, Rest, Prefix, Ctx>] extends [never]
    ? A
    : never
  : Remaining extends readonly [infer H, ...infer Rest]
    ? H extends readonly [infer K, ...unknown[]]
      ? K extends DispatchOption<C>
        ? CheckedDispatchedArguments<C, A, Rest, readonly [...Prefix, H], Ctx>
        : CheckedLocalArguments<C, A, Ctx>
      : CheckedLocalArguments<C, A, Ctx>
    : CheckedLocalArguments<C, A, Ctx>;

/** Select child grammar after precisely the native dispatcher's global options. */
export type CheckedCommandArguments<
  C extends GitCommandName,
  A extends readonly GitCommandArgument<C>[],
  Ctx extends CommandGrammarContext = {},
> = ArgumentsHaveLiteralNul<A> extends true
  ? never
  : number extends A['length']
    ? A
    : Spec<C> extends { guiScript: true }
      ? CheckedLocalArguments<C, A, Ctx>
      : [Dispatch<C>] extends [never]
        ? CheckedLocalArguments<C, A, Ctx>
        : CheckedDispatchedArguments<C, A, A, readonly [], Ctx>;

/** Typed CLI access for commands without a parsed convenience API. */
export interface GitCommandClient {
  command<C extends GitCommandName, const A extends readonly GitCommandArgument<NoInfer<C>>[]>(
    command: C,
    args: A & CheckedCommandArguments<C, A>,
    opts: GitCommandExecOpts<'bytes'> & { stdout: 'bytes' },
  ): Promise<RawResult<Uint8Array>>;
  command<C extends GitCommandName, const A extends readonly GitCommandArgument<NoInfer<C>>[]>(
    command: C,
    args: A & CheckedCommandArguments<C, A>,
    opts?: GitCommandExecOpts,
  ): Promise<RawResult>;
  command<C extends GitCommandName, const A extends readonly GitCommandArgument<NoInfer<C>>[]>(
    command: C,
    args: A & CheckedCommandArguments<C, A>,
    opts: GitCommandExecOpts<GitOutputMode>,
  ): Promise<RawResult<string | Uint8Array>>;
}

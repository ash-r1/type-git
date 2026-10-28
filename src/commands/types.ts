import type { AsciiLower, AsciiUpper } from '../constraints/ascii-types.js';
import type { CompoundDecimalLiteral } from '../constraints/compound-decimal-types.js';
import type { FastImportUnsignedParser } from '../constraints/fast-import-unsigned.js';
import type { FastImportUnsignedLiteral } from '../constraints/fast-import-unsigned-types.js';
import type { GitBooleanCallback, GitBooleanSource } from '../constraints/git-boolean.js';
import type {
  GitBooleanCallbackLiteral,
  GitBooleanCallbackValue,
} from '../constraints/git-boolean-types.js';
import type {
  GitDecimalCallback,
  GitDecimalCallbacks,
  GitDecimalParser,
  LegacyGitDecimal,
} from '../constraints/git-decimal.js';
import type { GitIntegerParser } from '../constraints/git-integer.js';
import type {
  GitNumericLiteral,
  GitNumericParser,
  GitNumericValue,
} from '../constraints/git-numeric-types.js';
import type { GitTimestampParser } from '../constraints/git-timestamp.js';
import type { MainlineLiteral, MainlineValue } from '../constraints/mainline-types.js';
import type { Constraint, Predicate } from '../constraints/model.js';
import type { NumberLiteralOrder, SafeIntegerAtLeast } from '../constraints/number-types.js';
import type { ObjectFilterLiteral } from '../constraints/object-filter-types.js';
import type { StringCallbackParser } from '../constraints/string-callback.js';
import type {
  StringCallbackLiteral,
  StringCallbackValue,
} from '../constraints/string-callback-types.js';
import type { Constrained, ConstraintRequirement } from '../constraints/types.js';
import type { ExecOpts, GitOutputMode, RawResult } from '../core/types.js';
import type { ArgumentsHaveLiteralNul } from './argument-string-types.js';
import type { COMMAND_SPECS } from './generated.js';
import type { CheckedGuiArguments, CommandGrammarContext } from './gui-syntax.js';
import type { InitialParserPass } from './initial-parser-pass-types.js';
import type { InitialParserInputs } from './initial-parser-inputs.js';
import type { PartitionRemaining, RevisionParserPass } from './revision-parser-pass-types.js';
import type { GLOBAL_HELP_DISPATCH_OPTIONS, OptionSpec } from './spec.js';
import type { SvnSelect, SvnTokens, SvnWords } from './svn-dispatch-types.js';

export type GitCommandName = keyof typeof COMMAND_SPECS;
type Spec<C extends GitCommandName> = (typeof COMMAND_SPECS)[C];
type Options<C extends GitCommandName> = Spec<C>['options'];
export type DocumentationCommand = {
  [C in GitCommandName]: Spec<C> extends { argv: readonly [string] }
    ? Spec<C> extends { executable: unknown }
      ? never
      : C
    : never;
}[GitCommandName];
type DocumentationOptions = Omit<Options<'help'>, keyof typeof GLOBAL_HELP_DISPATCH_OPTIONS> &
  typeof GLOBAL_HELP_DISPATCH_OPTIONS;
type DocumentationFlag = keyof DocumentationOptions;
/** Documentation argv has its own option shapes, independent of the original command. */
type DocumentationArgument =
  | {
      [K in DocumentationFlag]: DocumentationOptions[K] extends OptionSpec
        ? Token<K, DocumentationOptions[K], false>
        : never;
    }[DocumentationFlag]
  | { readonly operand: string }
  | readonly ['--'];
type NumericOption<C extends GitCommandName> =
  Spec<C> extends { numericOption: infer D extends OptionSpec } ? D : never;
type PrimitiveValue<S extends OptionSpec> = S['value'] extends 'flag' | 'boolean'
  ? boolean
  : S['value'] extends 'integer' | 'optional-integer'
    ? number
    : string;
type Value<S extends OptionSpec, MayBeIgnored extends boolean> = S extends {
  parser: GitNumericParser | 'python-int' | 'perl-int' | 'perl-int-gnu' | FastImportUnsignedParser;
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
type LocalCommandArgumentsByName = {
  [C in GitCommandName]:
    | {
        [K in keyof Options<C>]: Options<C>[K] extends OptionSpec
          ? Token<K, Options<C>[K], Spec<C> extends { parserExit: unknown } ? true : false>
          : never;
      }[keyof Options<C>]
    | { readonly operand: string }
    | (Spec<C>['separator'] extends false ? never : readonly ['--'])
    | ([NumericOption<C>] extends [never] ? never : readonly [`-${number}` | `-${bigint}`]);
};
type LocalCommandArgument<C extends GitCommandName> = LocalCommandArgumentsByName[C];
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
/** Only finite allowed-value vocabularies need widening when a native exit ignores values. */
type IgnoredAllowedArguments<C extends GitCommandName> = C extends GitCommandName
  ? Spec<C> extends { parserExit: unknown }
    ? never
    : {
        [K in keyof Options<C>]: Options<C>[K] extends OptionSpec & { allowed: readonly unknown[] }
          ? Token<K, Options<C>[K], true>
          : never;
      }[keyof Options<C>]
  : never;
type RawIgnoredDocumentationArgument = readonly [`-${string}`] | readonly [`-${string}`, string];
/** Earlier frontend argument vocabularies remain available independently of dispatch eligibility. */
type LegacyDocumentationCommand =
  | 'shell'
  | 'filter-branch'
  | 'merge-recursive'
  | 'merge-recursive-ours'
  | 'merge-recursive-theirs'
  | 'merge-subtree';
type LegacyDocumentationArgument<C extends GitCommandName> = C extends LegacyDocumentationCommand
  ? readonly [keyof typeof GLOBAL_HELP_DISPATCH_OPTIONS]
  : never;
export type GitCommandArgument<C extends GitCommandName> =
  | LocalCommandArgument<C>
  | LocalCommandArgument<DispatchTarget<C>>
  | LegacyDocumentationArgument<C>
  | LegacyDocumentationArgument<DispatchTarget<C>>;
export type GitCommandExecOpts<Mode extends GitOutputMode = 'text'> = ExecOpts & {
  stdin?: string | Uint8Array;
  stdout?: Mode;
};

type OptionKeys<D> = D extends { key: infer K extends string } ? K : never;
type EffectKeys<D> = D extends { effects: readonly { key: infer K extends string }[] } ? K : never;
/** Only state keys observed by constraints or conditional effects need an unset entry. */
type ReferencedStateKeys<T> = T extends readonly unknown[]
  ? ReferencedStateKeys<T[number]>
  :
      | (T extends { key: infer K extends string } ? K : never)
      | (T extends { valueKey: infer K extends string } ? K : never)
      | (T extends { keys: readonly (infer K extends string)[] } ? K : never)
      | {
          [K in Extract<
            keyof T,
            'guard' | 'when' | 'required' | 'choices' | 'others' | 'groups' | 'all'
          >]: ReferencedStateKeys<T[K]>;
        }[Extract<
          keyof T,
          'guard' | 'when' | 'required' | 'choices' | 'others' | 'groups' | 'all'
        >];
type OptionReadKeys<D> = D extends unknown
  ?
      | (D extends { effects: infer E } ? ReferencedStateKeys<E> : never)
      | (D extends { checks: infer R } ? ReferencedStateKeys<R> : never)
      // An empty repeat occurrence retains undefined before the first value.
      | (D extends { skipEmpty: true } ? OptionKeys<D> : never)
  : never;
type DeclaredStateKeys<C extends GitCommandName> =
  | OptionKeys<Options<C>[keyof Options<C>]>
  | EffectKeys<Options<C>[keyof Options<C>]>
  | OptionKeys<NumericOption<C>>
  | EffectKeys<NumericOption<C>>;
/** Include both parser passes when deciding whether an unset or temporary key can be read. */
type ReadStateKeys<C extends GitCommandName> =
  | ReferencedStateKeys<Spec<C>['rules']>
  | OptionReadKeys<
      | Options<C>[keyof Options<C>]
      | NumericOption<C>
      | RemainingOptions<C>[keyof RemainingOptions<C>]
    >;
type Empty<C extends GitCommandName> = {
  [K in
    | Extract<DeclaredStateKeys<C>, ReadStateKeys<C>>
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
type Normalize<V, D extends OptionSpec, Previous> = D extends { nativeIntegerDeferred: true }
  ? V
  : D extends {
        parser: infer P extends GitNumericParser;
      }
    ? GitNumericValue<V, P>
    : D extends { parser: infer P extends GitBooleanCallback }
      ? GitBooleanCallbackValue<V, P, Previous, BooleanSourceOf<D>>
      : D extends { parser: infer P extends StringCallbackParser }
        ? StringCallbackValue<V, P>
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
/** Preserve each value arm while selecting observed filename pointer semantics. */
type FilenameTokenValue<S, D extends OptionSpec, T extends readonly unknown[]> = S extends {
  filenameProfile: 'legacy';
}
  ? D extends { emptyIsUnset: true }
    ? T extends readonly [unknown, infer V]
      ? Normalize<V extends undefined ? DefaultValue<D> : V, D, undefined>
      : TokenValue<T, D>
    : TokenValue<T, D>
  : TokenValue<T, D, D['key'] extends keyof S ? S[D['key']] : undefined>;
type MissingOptionalFilenameValue<S, D extends OptionSpec, V> = V extends string
  ? V extends `:(optional)${infer Path}`
    ? Path extends ''
      ? TokenValue<readonly [unknown, V], D>
      : D['key'] extends keyof S
        ? S[D['key']]
        : undefined
    : TokenValue<readonly [unknown, V], D>
  : TokenValue<readonly [unknown, V], D>;
type UnparsedOptionState<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
  emptyIsUnset: true;
}
  ? S extends { filenameProfile: unknown }
    ? FilenameOptionState<S, D, T>
    : OrdinaryOptionState<S, D, T>
  : OrdinaryOptionState<S, D, T>;
type OrdinaryOptionState<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
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
type FilenameOptionState<S, D extends OptionSpec, T extends readonly unknown[]> = S extends {
  filenameProfile: 'optional';
  filenameIgnoredValues: infer Values;
}
  ? D extends { emptyIsUnset: true; ignore?: false }
    ? T extends readonly [unknown, infer V]
      ? Put<
          S,
          D['key'],
          V extends Values ? MissingOptionalFilenameValue<S, D, V> : FilenameTokenValue<S, D, T>
        >
      : AssignedOptionState<S, D, T>
    : AssignedOptionState<S, D, T>
  : AssignedOptionState<S, D, T>;
type AssignedOptionState<S, D extends OptionSpec, T extends readonly unknown[]> = D extends {
  ignore: true;
}
  ? D extends { emptyIsUnset: true }
    ? S extends { filenameProfile: 'legacy' | 'intermediate' }
      ? Put<S, D['key'], undefined>
      : S
    : S
  : D extends { toggle: true }
    ? Put<S, D['key'], D['key'] extends keyof S ? (S[D['key']] extends true ? false : true) : true>
    : D extends { repeat: true }
      ? Put<S, D['key'], Append<S, D, FilenameTokenValue<S, D, T>>>
      : Put<
          S,
          D['key'],
          D extends { parser: 'mainline' }
            ? MainlineValue<TokenValue<T, D>>
            : FilenameTokenValue<S, D, T>
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
type ScalarLiteral<D extends OptionSpec, V> = D extends { nativeIntegerDeferred: true }
  ? true
  : D extends { parser: infer P extends GitNumericParser }
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
          : D extends { parser: infer F extends FastImportUnsignedParser }
            ? FastImportUnsignedLiteral<V, F>
            : D extends { parser: 'perl-int' | 'perl-int-gnu' }
              ? PerlIntegerLiteral<D, V>
              : D extends { parser: infer P extends StringCallbackParser }
                ? StringCallbackLiteral<V, P>
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
> = AllowedLiteral<D, T> extends true
  ? CheckedCallbackState<S, D, T, Remaining>
  : D extends { parserErrorKey: infer K extends string }
    ? Put<S, K, true>
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
type WithDecimalWidth<
  P extends GitDecimalParser | GitTimestampParser,
  Bits extends 32 | 64,
> = P extends GitDecimalParser
  ? Omit<P, 'longBits'> & { longBits: Bits }
  : P extends GitTimestampParser
    ? Omit<P, 'longBits'> & { longBits: Bits }
    : never;
type DecimalProfiledOption<S, D extends OptionSpec> = S extends {
  decimalLongBits: infer Bits extends 32 | 64;
}
  ? D extends { parser: infer P extends GitDecimalParser | GitTimestampParser }
    ? Omit<D, 'parser'> & { parser: WithDecimalWidth<P, Bits> }
    : D extends { parser: 'shortlog-wrap' | 'show-branch-reflog' }
      ? D & {
          compoundLongBits: Bits;
          compoundNegatedOverflow: S extends { compoundNegatedOverflow: true } ? true : false;
        }
      : D
  : D;
type CallbackProfiledOption<S, D extends OptionSpec> = D extends {
  parser: infer P extends GitTimestampParser & { nativeCallback: 'revision-age' };
}
  ? S extends { decimalCallbacks: { 'revision-age': 'legacy' } }
    ? Omit<D, 'parser'> & { parser: Omit<P, 'conversion'> & { conversion: 'atoi' } }
    : D
  : D extends {
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
    : D extends { key: 'help'; firstOnly: true }
      ? Omit<D, 'firstOnly'>
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
type OrdinaryProfiledOption<S, D extends OptionSpec> = DispatcherProfiledOption<
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
/** Preserve raw old string values only inside the explicitly selected timing walk. */
type ProfiledOption<S, D extends OptionSpec> = S extends { repackMaxPackSize: 'deferred' }
  ? OrdinaryProfiledOption<S, D> extends infer P extends OptionSpec
    ? P extends { nativeIntegerTiming: 'repack-max-pack-size' }
      ? P & { nativeIntegerDeferred: true }
      : P
    : never
  : OrdinaryProfiledOption<S, D>;
/** Preserve a failing repack flag-union arm through the complete parser walk. */
type ApplyRepackOption<
  S,
  D,
  T extends readonly unknown[],
  R extends readonly unknown[],
  First extends boolean,
> = D extends OptionSpec
  ? ApplyOption<S, ProfiledOption<S, D>, T, R, First> extends infer Next
    ? [Next] extends [never]
      ? InvalidPass
      : Next
    : InvalidPass
  : InvalidPass;
/** Preserve failed mode union arms instead of dropping an incompatible parser family. */
type ApplyLsTreeOption<
  S,
  D,
  T extends readonly unknown[],
  R extends readonly unknown[],
  F extends boolean,
> = D extends OptionSpec
  ? (
      S extends { parserExited: true }
        ? ApplyOption<S, ProfiledOption<S, D>, T, R, F>
        : S extends { lsTreeModes: 'bits' }
          ? D extends { nativeLsTreeModern: true }
            ? never
            : D extends { nativeLsTreeMode: true }
              ? ApplyOption<S, Omit<ProfiledOption<S, D>, 'modeGroup'>, T, R, F>
              : ApplyOption<S, ProfiledOption<S, D>, T, R, F>
          : ApplyOption<S, ProfiledOption<S, D>, T, R, F>
    ) extends infer Next
    ? [Next] extends [never]
      ? InvalidPass
      : Next
    : InvalidPass
  : InvalidPass;
/** Retain failed read-tree union arms, including legacy duplicate callbacks. */
type ApplyReadTreeOption<
  S,
  D,
  T extends readonly unknown[],
  R extends readonly unknown[],
  F extends boolean,
> = D extends OptionSpec
  ? (
      D extends { nativeReadTreeExclude: true }
        ? S extends { readTreeExclude: 'legacy' }
          ? S extends { readTreeExcludeSeen: true }
            ? never
            : ApplyOption<
                Put<S, 'readTreeExcludeSeen', true>,
                Omit<ProfiledOption<S, D>, 'checks' | 'allowed'>,
                T,
                R,
                F
              >
          : ApplyOption<S, ProfiledOption<S, D>, T, R, F>
        : ApplyOption<S, ProfiledOption<S, D>, T, R, F>
    ) extends infer Next
    ? [Next] extends [never]
      ? InvalidPass
      : Next
    : InvalidPass
  : InvalidPass;
// Preserve rejected ls-remote option arms until the whole command state is checked.
type ApplyLsRemoteOption<
  S,
  D,
  T extends readonly unknown[],
  R extends readonly unknown[],
  F extends boolean,
> = D extends OptionSpec
  ? ApplyOption<S, ProfiledOption<S, D>, T, R, F> extends infer Next
    ? [Next] extends [never]
      ? InvalidPass
      : Next
    : InvalidPass
  : InvalidPass;
// Preserve rejected cherry option arms until the whole command state is checked.
type ApplyCherryOption<
  S,
  D,
  T extends readonly unknown[],
  R extends readonly unknown[],
  F extends boolean,
> = D extends OptionSpec
  ? ApplyOption<S, ProfiledOption<S, D>, T, R, F> extends infer Next
    ? [Next] extends [never]
      ? InvalidPass
      : Next
    : InvalidPass
  : InvalidPass;
// Preserve rejected commit-tree option arms until the whole command state is checked.
type ApplyCommitTreeOption<
  S,
  D,
  T extends readonly unknown[],
  R extends readonly unknown[],
  F extends boolean,
> = D extends OptionSpec
  ? ApplyOption<S, ProfiledOption<S, D>, T, R, F> extends infer Next
    ? [Next] extends [never]
      ? InvalidPass
      : Next
    : InvalidPass
  : InvalidPass;
// Preserve rejected for-each-repo option arms until the whole command state is checked.
type ApplyForEachRepoOption<
  S,
  D,
  T extends readonly unknown[],
  R extends readonly unknown[],
  F extends boolean,
> = D extends OptionSpec
  ? ApplyOption<S, ProfiledOption<S, D>, T, R, F> extends infer Next
    ? [Next] extends [never]
      ? InvalidPass
      : Next
    : InvalidPass
  : InvalidPass;
// Preserve rejected mailinfo option arms until the whole command state is checked.
type ApplyMailinfoOption<
  S,
  D,
  T extends readonly unknown[],
  R extends readonly unknown[],
  F extends boolean,
> = D extends OptionSpec
  ? ApplyOption<S, ProfiledOption<S, D>, T, R, F> extends infer Next
    ? [Next] extends [never]
      ? InvalidPass
      : Next
    : InvalidPass
  : InvalidPass;
type ApplyToken<
  C extends GitCommandName,
  S,
  T,
  Remaining extends readonly unknown[],
  First extends boolean,
  O = Options<C>,
> = T extends readonly ['--']
  ? (
      '--end-of-options' extends keyof O
        ? S extends { ended: true }
          ? true
          : false
        : ParsingEnded<C, S>
    ) extends true
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
      : T extends readonly [infer K extends keyof O, ...unknown[]]
        ? O[K] extends infer D extends OptionSpec
          ? C extends 'ls-tree'
            ? ApplyLsTreeOption<S, D, T, Remaining, First>
            : C extends 'read-tree'
              ? ApplyReadTreeOption<S, D, T, Remaining, First>
              : C extends 'ls-remote'
                ? ApplyLsRemoteOption<S, D, T, Remaining, First>
                : C extends 'cherry'
                  ? ApplyCherryOption<S, D, T, Remaining, First>
                  : C extends 'commit-tree'
                    ? ApplyCommitTreeOption<S, D, T, Remaining, First>
                    : C extends 'for-each-repo'
                      ? ApplyForEachRepoOption<S, D, T, Remaining, First>
                      : C extends 'mailinfo'
                        ? ApplyMailinfoOption<S, D, T, Remaining, First>
                        : C extends 'repack'
                          ? ApplyRepackOption<S, D, T, Remaining, First>
                          : ApplyOption<S, ProfiledOption<S, D>, T, Remaining, First>
          : never
        : T extends readonly [infer K]
          ? [Extract<K, DocumentationFlag>] extends [never]
            ? ApplyNumeric<C, S, T, Remaining, First>
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
type SingleWordExit<C extends GitCommandName> =
  Spec<C> extends {
    parserExit: { singleWordExits: readonly unknown[]; firstPassOptions: readonly string[] };
  }
    ? never
    : Spec<C> extends { parserExit: { singleWordExits: readonly (infer F)[] } }
      ? F
      : never;
type IsSingleWordExit<
  C extends GitCommandName,
  A extends readonly unknown[],
  First extends boolean,
> = First extends true
  ? [A] extends [readonly [readonly [SingleWordExit<C>]]]
    ? true
    : false
  : false;
type FirstWordExit<C extends GitCommandName> =
  Spec<C> extends {
    parserExit: { firstWordExits: readonly (infer F)[] };
  }
    ? F
    : never;
type IsFirstWordExit<
  C extends GitCommandName,
  A extends readonly unknown[],
  First extends boolean,
> = First extends true
  ? [A] extends [readonly [infer H, ...unknown[]]]
    ? [H] extends [readonly [FirstWordExit<C>] | { readonly operand: FirstWordExit<C> }]
      ? true
      : false
    : false
  : false;
type State<
  C extends GitCommandName,
  A extends readonly unknown[],
  S = Put<Initial<C>, 'argumentTokens', A>,
  First extends boolean = true,
  O = Options<C>,
> = [S] extends [never]
  ? never
  : S extends InvalidPass
    ? S
    : S extends { parserExited: true }
      ? S
      : IsFirstWordExit<C, A, First> extends true
        ? Put<S, 'parserExited', true>
        : IsSingleWordExit<C, A, First> extends true
          ? Put<S, 'parserExited', true>
          : A extends readonly [infer H, ...infer Rest]
            ? H extends readonly [ExitFlag<C, First>]
              ? ParsingEnded<C, S> extends true
                ? never
                : Put<S, 'parserExited', true>
              : State<
                  C,
                  Rest,
                  ApplyToken<
                    C,
                    '$remaining' extends ReadStateKeys<C> ? Put<S, '$remaining', Rest> : S,
                    H,
                    Rest,
                    First,
                    O
                  >,
                  false,
                  O
                >
            : S;
/** A bad reached callback stays invalid even when another input-union arm exits. */
type InvalidPass = { invalidParserPass: true };
type RemainingOptions<C extends GitCommandName> =
  Spec<C> extends { parserExit: { remainingOptions: infer O } } ? O : never;
type OperandTokens<R extends readonly string[]> = { [I in keyof R]: { operand: R[I] } };
type OperandInitial<C extends GitCommandName, R extends readonly string[], S> = Spec<C> extends {
  parserExit: { remainingOperands: 'drop-leading-dashdash' };
}
  ? R extends readonly ['--', ...unknown[]]
    ? Put<Put<Put<S, 'literalOperands', true>, 'ended', true>, 'hasSeparator', true>
    : Put<S, 'literalOperands', true>
  : Put<S, 'literalOperands', true>;
// The operand consumer can recognize a boundary independently of parse-options.
// Reset only examines argv[0..1]; checkout scans for the first retained --.
type SplitOperandWords<
  R extends readonly string[],
  Max,
  Before extends readonly string[] = readonly [],
> = R extends readonly [infer H extends string, ...infer Rest extends readonly string[]]
  ? H extends '--'
    ? { before: Before; after: Rest }
    : Before['length'] extends Max
      ? { before: readonly [...Before, H, ...Rest] }
      : SplitOperandWords<Rest, Max, readonly [...Before, H]>
  : { before: Before };
type OperandWordState<C extends GitCommandName, R extends readonly string[], S> = Spec<C> extends {
  parserExit: { remainingSeparator: infer Separator };
}
  ? SplitOperandWords<R, Separator extends { maxIndex: infer Max } ? Max : never> extends infer P
    ? P extends {
        before: infer Before extends readonly string[];
        after: infer After extends readonly string[];
      }
      ? State<
          C,
          OperandTokens<After>,
          Put<Put<State<C, OperandTokens<Before>, S>, 'ended', true>, 'hasSeparator', true>
        >
      : P extends { before: infer Before extends readonly string[] }
        ? State<C, OperandTokens<Before>, S>
        : InvalidPass
    : InvalidPass
  : State<C, OperandTokens<R>, S>;
/** Preserve the original tuple and selected profiles while replaying terminal operands. */
type OperandPassState<
  C extends GitCommandName,
  E extends readonly unknown[],
  R extends readonly string[],
  InitialState,
> = State<C, E, InitialState> extends infer S
  ? [S] extends [never]
    ? InvalidPass
    : OperandWordState<
        C,
        Spec<C> extends { parserExit: { remainingOperands: 'drop-leading-dashdash' } }
          ? R extends readonly ['--', ...infer Rest extends string[]]
            ? Rest
            : R
          : R,
        OperandInitial<C, R, S>
      >
  : InvalidPass;
/** Carry the original arguments and selected source/ABI traits through partition replay. */
type RevisionPassState<
  C extends GitCommandName,
  E extends readonly unknown[],
  R extends readonly string[],
  InitialState,
> = RevisionParserPass<Spec<C>, R> extends infer P
  ? P extends { tokens: infer T extends readonly unknown[] }
    ? State<C, T, State<C, E, InitialState>, true, RemainingOptions<C>> extends infer S
      ? [S] extends [never]
        ? InvalidPass
        : P extends { exited: true }
          ? S & { parserExited: true }
          : S
      : InvalidPass
    : P extends { dynamic: true }
      ? { parserExited: true }
      : InvalidPass
  : InvalidPass;
type RemainingState<
  C extends GitCommandName,
  E extends readonly unknown[],
  R extends readonly string[],
  InitialState,
> = Spec<C> extends { parserExit: { remainingOperands: string } }
  ? OperandPassState<C, E, R, InitialState>
  : Spec<C> extends { parserExit: { remainingPartition: unknown } }
    ? PartitionRemaining<Spec<C>, R> extends infer P
      ? P extends { words: infer W extends readonly string[]; state: infer X }
        ? RevisionPassState<C, E, W, InitialState & X>
        : P extends { dynamic: true }
          ? { parserExited: true }
          : InvalidPass
      : InvalidPass
    : RevisionPassState<C, E, R, InitialState>;
/** Both parser passes carry the same original inputs and independently selected traits. */
type ParsedPassState<
  C extends GitCommandName,
  A extends readonly unknown[],
  Pass,
  InitialState,
> = Pass extends { delegated: true }
  ? State<C, A, InitialState>
  : Pass extends { exited: true; tokens: infer T extends readonly unknown[] }
    ? [State<C, InitialParserInputs<Spec<C>, A, T>, InitialState>] extends [never]
      ? InvalidPass
      : State<C, InitialParserInputs<Spec<C>, A, T>, InitialState>
    : Pass extends {
          exited: false;
          tokens: infer E extends readonly unknown[];
          remaining: infer R extends readonly string[];
        }
      ? Spec<C> extends { conditionalCommand: unknown }
        ? InitialState & { repositoryDependent: true }
        : RemainingState<C, InitialParserInputs<Spec<C>, A, E>, R, InitialState>
      : Pass extends { exited: 'invalid' }
        ? InvalidPass
        : Pass extends { exited: 'dynamic' }
          ? { parserExited: true }
          : InvalidPass;
/** Initial projection preserves all scalar and ABI traits before residual replay. */
type CommandState<
  C extends GitCommandName,
  A extends readonly unknown[],
  InitialState = Put<Initial<C>, 'argumentTokens', A>,
> = Spec<C> extends { parserExit: { firstPassOptions: readonly string[] } }
  ? ParsedPassState<
      C,
      A,
      InitialParserPass<Spec<C>, A, InitialState extends { firstPassEmpty: false } ? false : true>,
      InitialState
    > extends infer S
    ? [Extract<S, InvalidPass>] extends [never]
      ? S
      : never
    : never
  : State<C, A, InitialState> extends infer S
    ? [Extract<S, InvalidPass>] extends [never]
      ? S
      : never
    : never;
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
/** An input union is safe only when every non-exiting state satisfies each rule. */
type RuleStateValid<S, H extends Constraint> = S extends
  | { help: true }
  | { parserExited: true }
  | { repositoryDependent: true }
  ? true
  : S extends ConstraintRequirement<S, ProfiledConstraint<S, H>>
    ? true
    : false;
// Evaluate one rule at a time without forming a Cartesian union of all rules.
type CheckRules<S, R extends readonly Constraint[]> = R extends readonly [
  infer H extends Constraint,
  ...infer Rest extends readonly Constraint[],
]
  ? H extends { nativeWhatchangedOptIn: true } | { nativePackRedundantOptIn: true }
    ? CheckRules<S, Rest>
    : H extends { nativeEmptyPickaxe: true }
      ? S extends { emptyPickaxeRejected: true }
        ? false extends RuleStateValid<S, H>
          ? false
          : CheckRules<S, Rest>
        : CheckRules<S, Rest>
      : false extends RuleStateValid<S, H>
        ? false
        : CheckRules<S, Rest>
  : true;
type CheckedLegacyIntegerArguments<
  C extends GitCommandName,
  A extends readonly unknown[],
  IntegerProfile extends 'bounded' | 'decimal-cast' = 'decimal-cast',
  Negative extends boolean = false,
  LongBits extends 32 | 64 = 64,
  Callbacks extends GitDecimalCallbacks = {},
  CompoundOverflow extends boolean = false,
  EmptyRegistered extends boolean = true,
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
    > & { compoundNegatedOverflow: CompoundOverflow; firstPassEmpty: EmptyRegistered }
  >,
> = [S] extends [never]
  ? never
  : [S] extends [{ help: true } | { parserExited: true } | { repositoryDependent: true }]
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
/** Only an initial table containing --empty can differ between these source profiles. */
type RelevantEmptyProfile<
  C extends GitCommandName,
  EmptyRegistered extends boolean,
> = Spec<C> extends { parserExit: { firstPassOptions: readonly (infer Flag)[] } }
  ? '--empty' extends Flag
    ? EmptyRegistered
    : true
  : true;
/** Discover candidate traits from the words consumed by the two parser passes. */
type TraitArguments<
  C extends GitCommandName,
  A extends readonly unknown[],
  EmptyRegistered extends boolean = boolean,
> = number extends A['length']
  ? A
  : Spec<C> extends { conditionalCommand: unknown }
    ? readonly []
    : Spec<C> extends { parserExit: { remainingOptions: unknown } }
      ? InitialParserPass<Spec<C>, A, RelevantEmptyProfile<C, EmptyRegistered>> extends infer P
        ? P extends { delegated: true }
          ? A
          : P extends { exited: true; tokens: infer T extends readonly unknown[] }
            ? T
            : P extends {
                  tokens: infer E extends readonly unknown[];
                  remaining: infer R extends readonly string[];
                }
              ? Spec<C> extends { parserExit: { remainingOperands: string } }
                ? E
                : PartitionRemaining<Spec<C>, R> extends {
                      words: infer W extends readonly string[];
                    }
                  ? RevisionParserPass<Spec<C>, W> extends {
                      tokens: infer T extends readonly unknown[];
                    }
                    ? readonly [...E, ...T]
                    : E
                  : E
              : A
        : A
      : A;
/** Avoid replaying a whole tuple for a width that cannot change callback state. */
type DecimalWidthChanges<
  C extends GitCommandName,
  A extends readonly unknown[],
  F extends GitDecimalCallbacks = {},
> = DecimalWidthChangesRaw<C, TraitArguments<C, A>, F>;
type DecimalWidthChangesRaw<
  C extends GitCommandName,
  A extends readonly unknown[],
  F extends GitDecimalCallbacks = {},
> = A extends readonly [infer T, ...infer Rest]
  ? T extends readonly [infer K extends keyof Options<C>, ...unknown[]]
    ? CallbackProfiledOption<
        { decimalCallbacks: F },
        Extract<Options<C>[K], OptionSpec>
      > extends infer D extends OptionSpec
      ? D extends {
          parser: infer P extends (GitDecimalParser | GitTimestampParser) & {
            conversion: 'cast' | 'atoi' | 'prefix-cast';
          };
        }
        ? GitNumericValue<
            T extends readonly [unknown, infer V] ? V : DefaultValue<D>,
            P
          > extends infer Wide
          ? GitNumericValue<
              T extends readonly [unknown, infer V] ? V : DefaultValue<D>,
              WithDecimalWidth<P, 32>
            > extends infer Narrow
            ? [Wide] extends [Narrow]
              ? [Narrow] extends [Wide]
                ? DecimalWidthChangesRaw<C, Rest, F>
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
            ? DecimalWidthChangesRaw<C, Rest, F>
            : true
          : DecimalWidthChangesRaw<C, Rest, F>
      : false
    : DecimalWidthChangesRaw<C, Rest, F>
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
type TupleCallbacks<
  C extends GitCommandName,
  A extends readonly unknown[],
  EmptyRegistered extends boolean = boolean,
> = TupleCallbacksRaw<C, TraitArguments<C, A, EmptyRegistered>>;
type TupleCallbacksRaw<
  C extends GitCommandName,
  A extends readonly unknown[],
> = A extends readonly [infer T, ...infer Rest]
  ? T extends readonly [infer K extends keyof Options<C>, ...unknown[]]
    ? Options<C>[K] extends {
        parser: {
          kind: 'decimal' | 'timestamp';
          nativeCallback: infer F extends GitDecimalCallback;
        };
      }
      ? F | TupleCallbacksRaw<C, Rest>
      : TupleCallbacksRaw<C, Rest>
    : TupleCallbacksRaw<C, Rest>
  : never;
type CallbackChoices<K extends GitDecimalCallback> = ('revision-age' extends K
  ? { 'revision-age': 'modern' } | { 'revision-age': 'legacy' }
  : {}) &
  ('unified-context' extends K
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
  EmptyRegistered extends boolean = boolean,
> = TupleIntegerTraitsRaw<C, TraitArguments<C, A, EmptyRegistered>>;
type TupleIntegerTraitsRaw<
  C extends GitCommandName,
  A extends readonly unknown[],
> = A extends readonly [infer T, ...infer Rest]
  ? T extends readonly [infer K extends keyof Options<C>, ...unknown[]]
    ? Options<C>[K] extends { parser: infer P }
      ? P extends { kind: 'integer' } | 'object-filter' | 'object-filter-auto'
        ? true
        : TupleIntegerTraitsRaw<C, Rest>
      : TupleIntegerTraitsRaw<C, Rest>
    : TupleIntegerTraitsRaw<C, Rest>
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
> = TupleUsesCompoundRaw<C, TraitArguments<C, A>>;
type TupleUsesCompoundRaw<
  C extends GitCommandName,
  A extends readonly unknown[],
> = A extends readonly [infer T, ...infer Rest]
  ? T extends readonly [infer K extends keyof Options<C>, ...unknown[]]
    ? Options<C>[K] extends { parser: 'shortlog-wrap' | 'show-branch-reflog' }
      ? true
      : TupleUsesCompoundRaw<C, Rest>
    : TupleUsesCompoundRaw<C, Rest>
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
  : [S] extends [{ help: true } | { parserExited: true } | { repositoryDependent: true }]
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
    : CommandState<C, A> extends
          | { help: true }
          | { parserExited: true }
          | { repositoryDependent: true }
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
/** Preserve one numeric implementation while projecting the older initial option set. */
type OldEmptyAxes<
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
        ? CheckedLegacyIntegerArguments<C, A, I, N, B, F, false, false>
        : never
      : never
    : never
  : never;
/** Only a concrete cherry-pick tuple with an actual early exit gains an older option-set alternative. */
type CheckedOldEmptyPass<
  C extends GitCommandName,
  A extends readonly unknown[],
> = C extends 'cherry-pick'
  ? A extends readonly [unknown, ...unknown[]]
    ? InitialParserPass<Spec<C>, A, false> extends { exited: true }
      ? OldEmptyAxes<
          C,
          A,
          TupleIntegerTraits<C, A, false> extends true ? 'bounded' | 'decimal-cast' : 'bounded',
          TupleIntegerTraits<C, A, false> extends true ? false | true : false,
          TupleIntegerTraits<C, A, false> extends true
            ? 32 | 64
            : [TupleCallbacks<C, A, false>] extends [never]
              ? 64
              : 32 | 64,
          CallbackChoices<TupleCallbacks<C, A, false>>
        >
      : never
    : never
  : never;
/** Explicitly pinned modern contexts cannot borrow the old --empty initial-pass behavior. */
type InitialLocalProfiles<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
> = Ctx extends { firstPassEmpty: false }
  ? [CheckedOldEmptyPass<C, A>] extends [never]
    ? ExistingLocalProfiles<C, A, Ctx>
    : A
  : [ExistingLocalProfiles<C, A, Ctx>] extends [never]
    ? Ctx extends { firstPassEmpty: true }
      ? never
      : CheckedOldEmptyPass<C, A>
    : A;
/** Native-oracle fixtures may pin callback families instead of borrowing older parsing rules. */
type PinnedCallbackArguments<
  C extends GitCommandName,
  A extends readonly unknown[],
  F extends GitDecimalCallbacks,
  Ctx extends CommandGrammarContext,
  S = CommandState<C, A, Put<Initial<C>, 'argumentTokens', A> & Ctx & { decimalCallbacks: F }>,
> = number extends A['length']
  ? A
  : [S] extends [never]
    ? never
    : [S] extends [{ help: true } | { parserExited: true } | { repositoryDependent: true }]
      ? A
      : CheckRules<S, Spec<C>['rules']> extends true
        ? A
        : never;
/** Explore unpinned axes while keeping every explicit decimal callback family fixed. */
type PinnedCallbackAlternatives<
  C extends GitCommandName,
  A extends readonly unknown[],
  F extends GitDecimalCallbacks,
  Ctx extends CommandGrammarContext,
  Source extends GitBooleanSource = Ctx extends { booleanSource: infer X extends GitBooleanSource }
    ? X
    : TupleUsesBoolean<C, A> extends true
      ? GitBooleanSource
      : 'modern',
  I extends 'bounded' | 'decimal-cast' = Ctx extends {
    integerProfile: infer P extends 'bounded' | 'decimal-cast';
  }
    ? P
    : TupleIntegerTraits<C, A> extends true
      ? 'bounded' | 'decimal-cast'
      : 'bounded',
  N extends boolean = TupleIntegerTraits<C, A> extends true ? boolean : false,
  B extends 32 | 64 = TupleIntegerTraits<C, A> extends true
    ? 32 | 64
    : [TupleCallbacks<C, A>] extends [never]
      ? 64
      : 32 | 64,
  Conflict extends 'immediate' | 'deferred' = Ctx extends {
    conflictStyle: infer X extends 'immediate' | 'deferred';
  }
    ? X
    : TupleUsesConflict<C, A> extends true
      ? 'immediate' | 'deferred'
      : 'immediate',
  EmptyRegistered extends boolean = Ctx extends { firstPassEmpty: infer X extends boolean }
    ? X
    : C extends 'cherry-pick'
      ? boolean
      : true,
  Overflow extends boolean = TupleUsesCompound<C, A> extends true ? boolean : false,
  OtherCallbacks extends GitDecimalCallbacks = CallbackChoices<
    Exclude<TupleCallbacks<C, A>, keyof F>
  >,
> = OtherCallbacks extends unknown
  ? Source extends unknown
    ? I extends unknown
      ? N extends unknown
        ? B extends unknown
          ? Conflict extends unknown
            ? EmptyRegistered extends unknown
              ? Overflow extends unknown
                ? BooleanTupleResult<
                    C,
                    A,
                    CommandState<
                      C,
                      A,
                      Put<Initial<C>, 'argumentTokens', A> &
                        Pick<
                          Ctx,
                          Extract<
                            keyof Ctx,
                            'filenameProfile' | 'filenameIgnoredValues' | 'emptyPickaxeRejected'
                          >
                        > & {
                          decimalCallbacks: F & OtherCallbacks;
                          booleanSource: Source;
                          integerProfile: I;
                          negativeMagnitudes: N;
                          decimalLongBits: B;
                          conflictStyle: Conflict;
                          firstPassEmpty: EmptyRegistered;
                          compoundNegatedOverflow: Overflow;
                        }
                    >
                  >
                : never
              : never
            : never
          : never
        : never
      : never
    : never
  : never;
/** Skip a duplicate retry only when all remaining scalar axes equal the checked defaults. */
type PinnedScalarAxesComplete<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
> = Ctx extends { integerProfile: 'bounded'; booleanSource: 'modern'; firstPassEmpty: true }
  ? [
      Extract<
        Spec<C>['rules'][number],
        {
          kind: 'scalar';
          parser: GitNumericParser | 'depth-initial' | 'object-filter' | 'object-filter-auto';
        }
      >,
    ] extends [never]
    ? [TupleCallbacks<C, A>] extends [never]
      ? TupleIntegerTraits<C, A> extends true
        ? false
        : TupleUsesCompound<C, A> extends true
          ? false
          : Ctx extends { conflictStyle: 'immediate' }
            ? true
            : TupleUsesConflict<C, A> extends true
              ? false
              : true
      : false
    : false
  : false;
/** A decimal pin does not silently pin unrelated parser implementations. */
type IndependentlyPinnedCallbacks<
  C extends GitCommandName,
  A extends readonly unknown[],
  F extends GitDecimalCallbacks,
  Ctx extends CommandGrammarContext,
> = [PinnedCallbackArguments<C, A, F, Ctx>] extends [never]
  ? PinnedScalarAxesComplete<C, A, Ctx> extends true
    ? never
    : PinnedCallbackAlternatives<C, A, F, Ctx>
  : A;

type BaseLocalParserProfiles<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext = {},
> = Spec<C> extends { guiScript: true }
  ? A extends readonly GitCommandArgument<C>[]
    ? CheckedGuiArguments<Spec<C>, A, Ctx>
    : never
  : A extends readonly LocalCommandArgument<C>[]
    ? Ctx extends { emptyPickaxeRejected: boolean }
      ? IndependentlyPinnedCallbacks<
          C,
          A,
          Ctx extends { decimalCallbacks: infer F extends GitDecimalCallbacks } ? F : {},
          Ctx
        >
      : Ctx extends { decimalCallbacks: infer F extends GitDecimalCallbacks }
        ? IndependentlyPinnedCallbacks<C, A, F, Ctx>
        : Ctx extends { integerProfile: 'bounded' | 'decimal-cast' }
          ? IndependentlyPinnedCallbacks<C, A, {}, Ctx>
          : Ctx extends { booleanSource: infer Source extends GitBooleanSource }
            ? Source extends 'modern'
              ? InitialLocalProfiles<C, A, Ctx>
              : TupleUsesBoolean<C, A> extends true
                ? BooleanTupleFamilies<C, A, Source, Ctx>
                : InitialLocalProfiles<C, A, Ctx>
            : InitialLocalProfiles<C, A, Ctx>
    : never;

/** A legacy string callback adds an alternative only if the whole tuple actually exits at help. */
type DeferredRepackHelp<A extends readonly unknown[]> =
  A extends readonly LocalCommandArgument<'repack'>[]
    ? CommandState<
        'repack',
        A,
        Put<Initial<'repack'>, 'argumentTokens', A> & { repackMaxPackSize: 'deferred' }
      > extends infer S
      ? [S] extends [never]
        ? never
        : [S] extends [{ parserExited: true }]
          ? A
          : never
      : never
    : never;
/** Check each complete legacy parser state, including the deferred update prerequisite. */
type LegacyReadTreeStateValid<S> = S extends { parserExited: true }
  ? true
  : CheckRules<S, Spec<'read-tree'>['rules']> extends true
    ? S extends { readTreeExcludeSeen: true }
      ? S extends { u: true }
        ? true
        : false
      : true
    : false;
type LegacyReadTreeArguments<
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
> = A extends readonly LocalCommandArgument<'read-tree'>[]
  ? CommandState<
      'read-tree',
      A,
      Put<Initial<'read-tree'>, 'argumentTokens', A> & Ctx & { readTreeExclude: 'legacy' }
    > extends infer S
    ? [S] extends [never]
      ? never
      : [LegacyReadTreeStateValid<S>] extends [true]
        ? A
        : never
    : never
  : never;
/** Keep the complete legacy walk, including failed option-union branches. */
type LsTreeBitState<A extends readonly unknown[], Ctx extends CommandGrammarContext> = [A] extends [
  readonly LocalCommandArgument<'ls-tree'>[],
]
  ? CommandState<
      'ls-tree',
      A,
      Put<Initial<'ls-tree'>, 'argumentTokens', A> & Ctx & { lsTreeModes: 'bits' }
    >
  : never;
/** Reached help bypasses final rules; every non-exiting legacy state still satisfies them. */
type LegacyLsTreeArguments<
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
  S = LsTreeBitState<A, Ctx>,
> = [S] extends [never] ? never : CheckRules<S, Spec<'ls-tree'>['rules']> extends true ? A : never;
/** Check each input tuple before collecting the family's failures. */
type LsTreeBitsBranch<
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
> = A extends unknown
  ? [A] extends [
      BaseLocalParserProfiles<'ls-tree', A, Omit<Ctx, 'lsTreeModes'> & { lsTreeModes: 'cmdmode' }>,
    ]
    ? [LsTreeBitState<A, Ctx>] extends [never]
      ? InvalidPass
      : A
    : [LegacyLsTreeArguments<A, Ctx>] extends [never]
      ? InvalidPass
      : A
  : never;
type CheckedLsTreeBits<
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
  R = LsTreeBitsBranch<A, Ctx>,
> = [R] extends [never] ? never : [Extract<R, InvalidPass>] extends [never] ? A : never;
type CheckedLocalParserProfiles<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext = {},
> = C extends 'ls-tree'
  ? Ctx extends { lsTreeModes: 'bits' }
    ? CheckedLsTreeBits<A, Ctx>
    : Ctx extends { lsTreeModes: 'cmdmode' }
      ? BaseLocalParserProfiles<C, A, Ctx>
      : [A] extends [BaseLocalParserProfiles<C, A, Ctx>]
        ? A
        : CheckedLsTreeBits<A, Ctx>
  : C extends 'read-tree'
    ? Ctx extends { readTreeExclude: 'legacy' }
      ? LegacyReadTreeArguments<A, Ctx>
      : Ctx extends { readTreeExclude: 'modern' }
        ? BaseLocalParserProfiles<C, A, Ctx>
        : [BaseLocalParserProfiles<C, A, Ctx>] extends [never]
          ? LegacyReadTreeArguments<A, Ctx>
          : A
    : C extends 'repack'
      ? Ctx extends { repackMaxPackSize: 'immediate' }
        ? BaseLocalParserProfiles<C, A, Ctx>
        : [BaseLocalParserProfiles<C, A, Ctx>] extends [never]
          ? DeferredRepackHelp<A>
          : A
      : BaseLocalParserProfiles<C, A, Ctx>;

/** Explore filename fields independently, checking the complete input in each state. */
type FilenameFields<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
  R extends readonly unknown[] = A,
  Ignored extends string = never,
  Assigned extends string = never,
> = R extends readonly [infer H, ...infer Rest]
  ? H extends readonly [infer K extends keyof Options<C>, infer V]
    ? Options<C>[K] extends { emptyIsUnset: true }
      ? Extract<V, `:(optional)${string}`> extends infer Paths extends string
        ? [Paths] extends [never]
          ? FilenameFields<C, A, Ctx, Rest, Ignored, Assigned>
          : [Exclude<Paths, Ignored | Assigned>] extends [never]
            ? FilenameFields<C, A, Ctx, Rest, Ignored, Assigned>
            :
                | FilenameFields<C, A, Ctx, Rest, Ignored | Paths, Assigned>
                | FilenameFields<C, A, Ctx, Rest, Ignored, Assigned | Paths>
        : never
      : FilenameFields<C, A, Ctx, Rest, Ignored, Assigned>
    : FilenameFields<C, A, Ctx, Rest, Ignored, Assigned>
  : CheckedLocalWithoutFilename<
      C,
      A,
      Ctx & {
        filenameProfile: 'optional';
        filenameIgnoredValues: Ignored;
        decimalCallbacks: Ctx extends { decimalCallbacks: infer F extends GitDecimalCallbacks }
          ? F
          : {};
      }
    >;
type HasFilenameUpdate<
  C extends GitCommandName,
  A extends readonly unknown[],
> = A extends readonly [infer H, ...infer R]
  ? H extends readonly [infer K extends keyof Options<C>, ...infer V]
    ? Options<C>[K] extends { emptyIsUnset: true }
      ? Options<C>[K] extends { ignore: true }
        ? true
        : V extends readonly [infer FilenameInput]
          ? [Extract<FilenameInput, '' | `:(optional)${string}`>] extends [never]
            ? HasFilenameUpdate<C, R>
            : true
          : HasFilenameUpdate<C, R>
      : HasFilenameUpdate<C, R>
    : HasFilenameUpdate<C, R>
  : false;
/** Project optional filename values without replaying unaffected whole tuples. */
type OptionalFilenameValues<
  C extends GitCommandName,
  A extends readonly unknown[],
  T = A[number],
> = T extends readonly [infer K extends keyof Options<C>, infer V]
  ? Options<C>[K] extends { emptyIsUnset: true }
    ? Extract<V, `:(optional)${string}`>
    : never
  : never;
/** Keep existing parser alternatives and add only observed filename profiles. */
type CheckedLocalArguments<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext = {},
> = Ctx extends { filenameProfile: 'optional' }
  ? Ctx extends { filenameIgnoredValues: string }
    ? CheckedLocalWithoutFilename<
        C,
        A,
        Ctx & {
          decimalCallbacks: Ctx extends { decimalCallbacks: infer F extends GitDecimalCallbacks }
            ? F
            : {};
        }
      >
    : [OptionalFilenameValues<C, A>] extends [never]
      ? CheckedLocalWithoutFilename<
          C,
          A,
          Ctx & {
            decimalCallbacks: Ctx extends { decimalCallbacks: infer F extends GitDecimalCallbacks }
              ? F
              : {};
          }
        >
      : FilenameFields<C, A, Ctx>
  : Ctx extends { filenameProfile: unknown }
    ? CheckedLocalWithoutFilename<
        C,
        A,
        Ctx & {
          decimalCallbacks: Ctx extends { decimalCallbacks: infer F extends GitDecimalCallbacks }
            ? F
            : {};
        }
      >
    : HasFilenameUpdate<C, A> extends true
      ? [CheckedLocalWithoutFilename<C, A, Ctx>] extends [never]
        ?
            | CheckedLocalWithoutFilename<
                C,
                A,
                Ctx & { filenameProfile: 'legacy'; decimalCallbacks: {} }
              >
            | CheckedLocalWithoutFilename<
                C,
                A,
                Ctx & { filenameProfile: 'intermediate'; decimalCallbacks: {} }
              >
            | FilenameFields<C, A, Ctx>
        : A
      : CheckedLocalWithoutFilename<C, A, Ctx>;

/** Replace only recognized aliases for type evaluation; emitted words are never rewritten. */
type SubmoduleInitTokens<A extends readonly unknown[]> = A extends readonly [infer H, ...infer Rest]
  ? H extends { operand: string } | readonly ['--'] | readonly ['-h'] | readonly ['--help']
    ? A
    : readonly [H extends readonly ['-i'] ? readonly ['--init'] : H, ...SubmoduleInitTokens<Rest>]
  : A;
type ReachedSubmoduleAlias<A extends readonly unknown[]> = A extends readonly [
  infer H,
  ...infer Rest,
]
  ? H extends { operand: string } | readonly ['--'] | readonly ['-h'] | readonly ['--help']
    ? false
    : H extends readonly ['-i']
      ? true
      : ReachedSubmoduleAlias<Rest>
  : false;
/** Preserve the complete command checker while selecting one helper alias capability. */
type CheckedLocalWithoutFilename<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext = {},
> = [C] extends ['submodule update' | 'submodule--helper update']
  ? Ctx extends { submoduleInitAlias: false }
    ? ['submodule--helper update'] extends [C]
      ? true extends ReachedSubmoduleAlias<A>
        ? never
        : CheckedLocalParserProfiles<C, A, Ctx>
      : CheckedLocalParserProfiles<C, A, Ctx>
    : Ctx extends { submoduleInitAlias: true }
      ? [CheckedLocalParserProfiles<C, SubmoduleInitTokens<A>, Ctx>] extends [never]
        ? never
        : A
      : [CheckedLocalParserProfiles<C, A, Ctx>] extends [never]
        ? [CheckedLocalParserProfiles<C, SubmoduleInitTokens<A>, Ctx>] extends [never]
          ? never
          : A
        : A
  : CheckedLocalParserProfiles<C, A, Ctx>;

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
> = TupleUsesConflictRaw<C, TraitArguments<C, A>>;
type TupleUsesConflictRaw<
  C extends GitCommandName,
  A extends readonly unknown[],
> = A extends readonly [infer T, ...infer Rest]
  ? T extends readonly [infer K extends keyof Options<C>, ...unknown[]]
    ? Options<C>[K] extends { nativeEnumCallback: 'conflict-style' }
      ? true
      : TupleUsesConflictRaw<C, Rest>
    : TupleUsesConflictRaw<C, Rest>
  : false;
/** Source uncertainty is evaluated per complete tuple; invalid input unions remain invalid. */
type BooleanTupleResult<C extends GitCommandName, A extends readonly unknown[], S> = [S] extends [
  never,
]
  ? never
  : [S] extends [{ help: true } | { parserExited: true } | { repositoryDependent: true }]
    ? A
    : [S] extends [{ conflictStyle: 'deferred' }]
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
type TupleUsesBoolean<C extends GitCommandName, A extends readonly unknown[]> = TupleUsesBooleanRaw<
  C,
  TraitArguments<C, A>
>;
type TupleUsesBooleanRaw<
  C extends GitCommandName,
  A extends readonly unknown[],
> = A extends readonly [infer T, ...infer Rest]
  ? T extends readonly [infer K extends keyof Options<C>, ...unknown[]]
    ? Options<C>[K] extends { parser: GitBooleanCallback }
      ? true
      : TupleUsesBooleanRaw<C, Rest>
    : TupleUsesBooleanRaw<C, Rest>
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

/** Reinterpret only the actual child argv retained by native parent parsing. */
type MandatoryWordOperands<W extends readonly string[]> = {
  readonly [K in keyof W]: { readonly operand: W[K] };
};
type InvalidMandatoryPass = { invalidMandatoryPass: true };
type MandatoryParentState<
  C extends GitCommandName,
  A extends readonly unknown[],
  T extends readonly unknown[],
  Ctx extends CommandGrammarContext,
> = State<C, T, Put<Initial<C>, 'argumentTokens', A> & Ctx>;
type CheckedSubcommandPass<
  C extends GitCommandName,
  A extends readonly unknown[],
  P,
  Ctx extends CommandGrammarContext,
> = P extends {
  subcommand: infer W extends keyof Dispatch<C>;
  tokens: infer T extends readonly unknown[];
  remaining: infer R extends readonly string[];
}
  ? [MandatoryParentState<C, A, T, Ctx>] extends [never]
    ? InvalidMandatoryPass
    : Dispatch<C>[W] extends infer Target extends GitCommandName
      ? [CheckedLocalArguments<Target, MandatoryWordOperands<R>, Ctx>] extends [never]
        ? InvalidMandatoryPass
        : A
      : InvalidMandatoryPass
  : P extends { exited: true; tokens: infer T extends readonly unknown[] }
    ? [MandatoryParentState<C, A, T, Ctx>] extends [never]
      ? InvalidMandatoryPass
      : A
    : P extends { exited: 'dynamic' } | { delegated: true }
      ? A
      : InvalidMandatoryPass;
/** Every finite parser alternative must pass under the same selected source context. */
type CheckedMandatoryArguments<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
> = CheckedSubcommandPass<
  C,
  A,
  InitialParserPass<Spec<C>, A, Ctx extends { firstPassEmpty: false } ? false : true>,
  Ctx
> extends infer P
  ? [P] extends [never]
    ? never
    : [Extract<P, InvalidMandatoryPass>] extends [never]
      ? A
      : never
  : never;

/** The legacy empty parent pass can exit before any explicit stash child is parsed. */
type LegacyStashHelp<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
> = C extends 'stash' | `stash ${string}`
  ? Ctx extends { stashParent: 'modern' }
    ? false
    : InitialParserPass<
          Omit<Spec<C>, 'parserExit'> & {
            parserExit: {
              origin: 'git';
              reason: 'Legacy parent help precedes child dispatch';
              source: 'Git 2.25.1 builtin/stash.c:cmd_stash';
              flags: readonly ['-h', '--help'];
              firstPassOptions: readonly [];
              firstPassLongNames: readonly [];
              keepDashDash: true;
            };
          },
          A
        > extends infer P
      ? [P] extends [never]
        ? false
        : [P] extends [{ exited: true }]
          ? true
          : false
      : false
  : false;

/** Reject any known selected-command alternative whose reconstructed tuple is invalid. */
type InvalidSvnSelection<S, Ctx extends CommandGrammarContext> = S extends {
  kind: 'command';
  command: infer C extends DispatchTarget<'svn'>;
  remaining: infer W extends readonly string[];
}
  ? SvnTokens<W, Options<C>> extends infer A
    ? [A] extends [never]
      ? true
      : A extends readonly unknown[]
        ? [CheckedLocalArguments<C, A, Ctx>] extends [never]
          ? true
          : never
        : true
    : true
  : S extends { kind: 'none' }
    ? true
    : never;
/** Preserve existing tuple types when dispatch only removes a positional word. */
type CheckedSvnOperandScan<
  A extends readonly unknown[],
  R extends readonly unknown[] = A,
  Prefix extends readonly unknown[] = readonly [],
  Ctx extends CommandGrammarContext = {},
> = R extends readonly [{ readonly operand: infer W extends string }, ...infer Rest]
  ? string extends W
    ? CheckedSvnArguments<'svn', A, Ctx>
    : [W] extends [keyof Dispatch<'svn'>]
      ? [InvalidDispatchAlternative<'svn', W, Rest, Prefix, Ctx>] extends [never]
        ? A
        : never
      : [Extract<W, keyof Dispatch<'svn'> | 'help'>] extends [never]
        ? CheckedSvnOperandScan<A, Rest, readonly [...Prefix, { readonly operand: W }], Ctx>
        : CheckedSvnArguments<'svn', A, Ctx>
  : CheckedSvnArguments<'svn', A, Ctx>;

type CheckedSvnArguments<
  C extends 'svn',
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
> = SvnSelect<SvnWords<A>, Dispatch<'svn'>> extends infer Selected
  ? [Selected] extends [{ kind: 'none' }]
    ? CheckedLocalArguments<C, A, Ctx>
    : [InvalidSvnSelection<Selected, Ctx>] extends [never]
      ? A
      : never
  : never;

/** Keep correlated option-token union arms separate before checking each complete input. */
type SvnInputAlternatives<
  A extends readonly unknown[],
  Prefix extends readonly unknown[] = readonly [],
> = number extends A['length']
  ? readonly unknown[]
  : A extends readonly [infer H, ...infer R]
    ? H extends unknown
      ? SvnInputAlternatives<R, readonly [...Prefix, H]>
      : never
    : Prefix;
type InvalidSvnInput<A, Ctx extends CommandGrammarContext> = A extends readonly unknown[]
  ? [CheckedSvnOperandScan<A, A, readonly [], Ctx>] extends [never]
    ? true
    : never
  : true;
type CheckedSvnInputs<A extends readonly unknown[], Ctx extends CommandGrammarContext> = [
  InvalidSvnInput<SvnInputAlternatives<A>, Ctx>,
] extends [never]
  ? A
  : never;

/** Select child grammar after precisely the native dispatcher's global options. */
type CheckedCommandGrammar<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext = {},
> = ArgumentsHaveLiteralNul<A> extends true
  ? never
  : number extends A['length']
    ? A
    : [C] extends ['svn']
      ? [A] extends [readonly [unknown, ...unknown[]]]
        ? NoInfer<CheckedSvnInputs<A, Ctx>>
        : CheckedLocalArguments<C, A, Ctx>
      : LegacyStashHelp<C, A, Ctx> extends true
        ? A
        : Spec<C> extends { parserExit: { mandatorySubcommand: true } }
          ? CheckedMandatoryArguments<C, A, Ctx>
          : Spec<C> extends { guiScript: true }
            ? CheckedLocalArguments<C, A, Ctx>
            : [Dispatch<C>] extends [never]
              ? CheckedLocalArguments<C, A, Ctx>
              : CheckedDispatchedArguments<C, A, A, readonly [], Ctx>;

/** Native help exits before later words; a union must guarantee the exit in every arm. */
type DocumentationExitToken =
  | readonly ['-h' | '--help' | '--help-all' | '--']
  | { readonly operand: '-h' | '--help' | '--help-all' | '--' };
type DocumentationIgnoredArgument<C extends GitCommandName> =
  | DocumentationArgument
  | LocalCommandArgument<C>
  | LocalCommandArgument<DispatchTarget<C>>
  | IgnoredAllowedArguments<C>
  | IgnoredAllowedArguments<DispatchTarget<C>>;
type LocalOptionFlag<C extends GitCommandName> = C extends GitCommandName
  ? keyof Options<C>
  : never;
/** Distribute flag unions but require every resulting shape to be valid. */
type CheckedIgnoredDocumentationToken<C extends GitCommandName, T> = T extends readonly [
  infer Flag extends string,
  ...infer Values,
]
  ? Flag extends DocumentationFlag | LocalOptionFlag<C> | LocalOptionFlag<DispatchTarget<C>>
    ? [readonly [Flag, ...Values]] extends [DocumentationIgnoredArgument<C>]
      ? true
      : false
    : [readonly [Flag, ...Values]] extends [RawIgnoredDocumentationArgument]
      ? true
      : false
  : [T] extends [{ readonly operand: string }]
    ? true
    : false;
type DocumentationTokenFits<
  C extends GitCommandName,
  T,
  Exited extends boolean,
> = Exited extends true
  ? CheckedIgnoredDocumentationToken<C, T>
  : [T] extends [DocumentationArgument]
    ? true
    : false;
type CheckedDocumentationTail<
  C extends GitCommandName,
  A extends readonly unknown[],
  Exited extends boolean = false,
> = A extends readonly [infer H, ...infer R]
  ? [DocumentationTokenFits<C, H, Exited>] extends [true]
    ? CheckedDocumentationTail<
        C,
        R,
        Exited extends true ? true : [H] extends [DocumentationExitToken] ? true : false
      >
    : false
  : DocumentationTokenFits<C, A[number], Exited>;
/** New ignored-word vocabulary must never escape into an ordinary command invocation. */
/** A guaranteed prefix selects documentation without first expanding local option vocabularies. */
export type DocumentationPrefix = readonly [readonly ['--help'], ...unknown[]];
/** Apply the same documentation tail and NUL checks used by the general command checker. */
export type CheckedDocumentationArguments<
  C extends DocumentationCommand,
  A extends DocumentationPrefix,
> = ArgumentsHaveLiteralNul<A> extends true
  ? never
  : [A] extends [readonly [unknown, ...infer Tail]]
    ? [CheckedDocumentationTail<C, Tail>] extends [true]
      ? A
      : never
    : never;

/** Reject every non-documentation input outside the original local argument vocabulary. */
type CheckedOriginalCommandGrammar<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
> = [A[number]] extends [LocalCommandArgument<C> | LocalCommandArgument<DispatchTarget<C>>]
  ? CheckedCommandGrammar<C, A, Ctx>
  : never;

/** Select documentation before applying any local parser's option arities or constraints. */
export type CheckedCommandArguments<
  C extends GitCommandName,
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext = {},
> = [C] extends [DocumentationCommand]
  ? [A] extends [readonly [readonly ['--help'], ...infer Tail]]
    ? ArgumentsHaveLiteralNul<A> extends true
      ? never
      : [CheckedDocumentationTail<C, Tail>] extends [true]
        ? A
        : never
    : CheckedOriginalCommandGrammar<C, A, Ctx>
  : CheckedOriginalCommandGrammar<C, A, Ctx>;

/** Ordinary dynamic argument arrays keep their original value vocabulary. */
export type UsageCommand = {
  [C in GitCommandName]: Spec<C> extends { usageExit: { flags: readonly string[] } } ? C : never;
}[GitCommandName];
type UsageExitToken<C extends UsageCommand> =
  Spec<C> extends {
    usageExit: { flags: readonly (infer F extends string)[] };
  }
    ? readonly [F]
    : never;
type IgnoredUsageTokenFits<C extends UsageCommand, T> = T extends readonly [
  infer F extends string,
  ...unknown[],
]
  ? F extends LocalOptionFlag<C>
    ? [T] extends [LocalCommandArgument<C> | IgnoredAllowedArguments<C>]
      ? true
      : false
    : [T] extends [RawIgnoredDocumentationArgument]
      ? true
      : false
  : [T] extends [{ readonly operand: string }]
    ? true
    : false;
type UsageTailFits<C extends UsageCommand, A extends readonly unknown[]> = A extends readonly [
  infer H,
  ...infer R,
]
  ? [IgnoredUsageTokenFits<C, H>] extends [true]
    ? UsageTailFits<C, R>
    : false
  : [A[number]] extends [never]
    ? true
    : [IgnoredUsageTokenFits<C, A[number]>] extends [true]
      ? true
      : false;
type UsagePrefixFits<
  C extends UsageCommand,
  A extends readonly unknown[],
> = A extends readonly GitCommandArgument<C>[]
  ? [CheckedCommandArguments<C, A>] extends [never]
    ? false
    : true
  : false;
type UsageArgumentsFit<
  C extends UsageCommand,
  A extends readonly unknown[],
  Prefix extends readonly unknown[] = readonly [],
> = A extends readonly [infer H, ...infer R]
  ? [H] extends [readonly ['--']]
    ? false
    : [H] extends [UsageExitToken<C>]
      ? UsagePrefixFits<C, readonly [...Prefix, H]> extends true
        ? UsageTailFits<C, R>
        : false
      : UsageArgumentsFit<C, R, readonly [...Prefix, H]>
  : false;
/** Ignored words are admitted only after every possible prefix reaches native usage. */
export type CheckedUsageArguments<
  C extends UsageCommand,
  A extends readonly unknown[],
> = ArgumentsHaveLiteralNul<A> extends true
  ? never
  : UsageArgumentsFit<C, A> extends true
    ? A
    : never;

/** Typed CLI access for commands without a parsed convenience API. */
export interface GitCommandClient {
  command<C extends UsageCommand, const A extends readonly unknown[]>(
    command: C,
    args: A & NoInfer<CheckedUsageArguments<C, A>>,
    opts: GitCommandExecOpts<'bytes'> & { stdout: 'bytes' },
  ): Promise<RawResult<Uint8Array>>;
  command<C extends UsageCommand, const A extends readonly unknown[]>(
    command: C,
    args: A & NoInfer<CheckedUsageArguments<C, A>>,
    opts?: GitCommandExecOpts,
  ): Promise<RawResult>;
  command<C extends UsageCommand, const A extends readonly unknown[]>(
    command: C,
    args: A & NoInfer<CheckedUsageArguments<C, A>>,
    opts: GitCommandExecOpts<GitOutputMode>,
  ): Promise<RawResult<string | Uint8Array>>;

  command<C extends DocumentationCommand, const A extends DocumentationPrefix>(
    command: C,
    args: A & NoInfer<CheckedDocumentationArguments<C, A>>,
    opts: GitCommandExecOpts<'bytes'> & { stdout: 'bytes' },
  ): Promise<RawResult<Uint8Array>>;
  command<C extends DocumentationCommand, const A extends DocumentationPrefix>(
    command: C,
    args: A & NoInfer<CheckedDocumentationArguments<C, A>>,
    opts?: GitCommandExecOpts,
  ): Promise<RawResult>;
  command<C extends DocumentationCommand, const A extends DocumentationPrefix>(
    command: C,
    args: A & NoInfer<CheckedDocumentationArguments<C, A>>,
    opts: GitCommandExecOpts<GitOutputMode>,
  ): Promise<RawResult<string | Uint8Array>>;
  command<C extends GitCommandName, const A extends readonly GitCommandArgument<NoInfer<C>>[]>(
    command: C,
    args: A & NoInfer<CheckedCommandArguments<C, A>>,
    opts: GitCommandExecOpts<'bytes'> & { stdout: 'bytes' },
  ): Promise<RawResult<Uint8Array>>;
  command<C extends GitCommandName, const A extends readonly GitCommandArgument<NoInfer<C>>[]>(
    command: C,
    args: A & NoInfer<CheckedCommandArguments<C, A>>,
    opts?: GitCommandExecOpts,
  ): Promise<RawResult>;
  command<C extends GitCommandName, const A extends readonly GitCommandArgument<NoInfer<C>>[]>(
    command: C,
    args: A & NoInfer<CheckedCommandArguments<C, A>>,
    opts: GitCommandExecOpts<GitOutputMode>,
  ): Promise<RawResult<string | Uint8Array>>;
}

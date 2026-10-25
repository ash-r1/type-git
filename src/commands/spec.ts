import type { GitScalarParser } from '../constraints/git-scalars.js';
import type { Constraint, Evidence, Predicate } from '../constraints/model.js';

/** Representation boundary shared by every command before Git-specific interpretation. */
export const ARGV_STRING_CONSTRAINT = {
  id: 'argv.nul-free',
  origin: 'type-git',
  forbiddenCharacter: '\0',
  reason: 'OS argv cannot represent embedded NUL characters.',
  source: 'docs/design/typed-command-api.md#cli-string-representation',
} as const satisfies Evidence & { id: string; forbiddenCharacter: string };

/** Additional audited help spellings, including old listing negations and internal usage flags. */
export const GLOBAL_HELP_DISPATCH_OPTIONS = {
  '--all': { key: 'all', value: 'flag' },
  '-a': { key: 'all', value: 'flag' },
  '--no-all': { key: 'all', value: 'flag', set: false },
  '--guides': { key: 'guides', value: 'flag' },
  '-g': { key: 'guides', value: 'flag' },
  '--no-guides': { key: 'guides', value: 'flag', set: false },
  '-h': { key: 'help', value: 'flag' },
  '--help-all': { key: 'help', value: 'flag' },
  '--man': { key: 'format', value: 'flag', set: 'man' },
  '-m': { key: 'format', value: 'flag', set: 'man' },
  '--no-man': { key: 'format', value: 'flag', set: false },
} as const satisfies Readonly<Record<string, OptionSpec>>;

/** One CLI spelling; aliases share a normalized key. */
export type OptionSpec = {
  key: string;
  value: 'flag' | 'boolean' | 'string' | 'integer' | 'optional-string' | 'optional-integer';
  /** The value assigned by a value-less flag (e.g. --no-foo). */
  set?: string | number | boolean;
  /** Repeated values accumulate, rather than replacing the preceding value. */
  repeat?: boolean;
  /** Negation clears a string option instead of assigning a boolean. */
  clear?: boolean;
  /** Some negated callbacks/filename options leave their previous value untouched. */
  ignore?: boolean;
  /** XOR-style flags such as revision --reverse. */
  toggle?: boolean;
  /** Manual parsers such as revision --default require a detached value. */
  separateValue?: boolean;
  /** PARSE_OPT_LASTARG_DEFAULT consumes a next word, defaulting only at end of argv. */
  lastArgDefault?: boolean;
  /** Delegating parsers can require a short value in the same argv word. */
  attachedValue?: boolean;
  /** An empty optional short argument needs its equivalent long equals spelling. */
  emptyValueFlag?: string;
  /** Git PARSE_OPT_CMDMODE rejects a change to an already selected mode immediately. */
  modeGroup?: string;
  /** Native mode identity; aliases can select the same enum value. */
  modeValue?: string;
  /** A callback can select distinct modes through its argument. */
  modeFromValue?: boolean;
  /** Cobra StringSlice treats an empty value as no entries. */
  skipEmpty?: boolean;
  /** Git's filename parser maps an empty filename to an unset pointer. */
  emptyIsUnset?: boolean;
  /** Insert parent options before this fixed command word. */
  before?: number;
  /** Values rejected immediately by the upstream option parser, even if later overwritten. */
  parser?: GitScalarParser;
  /** Record a failed scalar parse for a later source-ordered rule instead of throwing immediately. */
  parserErrorKey?: string;
  /** Selected Git may validate conflict style immediately or after parsing all options. */
  /** Empty patterns are rejected only by the observed modern pickaxe callback. */
  nativeEmptyPickaxe?: boolean;
  nativeEnumCallback?: 'conflict-style';
  /** Selected native callback timing before an actual internal help exit. */
  nativeIntegerTiming?: 'repack-max-pack-size';
  /** Selected exclude callback family, used only before a reached read-tree help exit. */
  nativeReadTreeExclude?: boolean;
  /** A source-audited helper alias whose availability is observed on the selected executable. */
  nativeCapability?: 'submodule-init-alias';
  /** Finite supplied values accepted by both literal types and runtime validation. */
  allowed?: readonly (string | number | boolean)[];
  /** Git callbacks using ASCII case-insensitive enum matching. */
  caseInsensitive?: boolean;
  /** Match enum names without changing the spelling stored by the callback. */
  preserveCase?: boolean;
  /** A global dispatcher accepts this option only as the first command argument. */
  firstOnly?: boolean;
  /** The native callback consumes all remaining words as literal operands. */
  consumesRest?: boolean;
  /** Before-token constraints: $value is incoming; $remaining contains subsequent API tokens. */
  checks?: readonly Constraint[];
  /** Ordered callback side effects after assigning the option. `all` tests the current state. */
  effects?: readonly {
    key: string;
    when?:
      | { equals: string | number | boolean }
      | { notEquals: string | number | boolean }
      | { all: readonly Predicate[] };
    set: string | number | boolean;
  }[];
};
export type CompanionExecutable = 'scalar' | 'gitk' | 'gitweb';
export type ConditionalCommand = Evidence & {
  when: { refExists: string };
  invoke: {
    command: string;
    prepend: readonly string[];
    append: readonly string[];
    exitStatus: 'boolean' | 'preserve';
  };
  otherwise: { exitCode: 0 };
};
export type CommandSpec = {
  /** Git GUI has a raw-word Tcl grammar, independently versioned from Git. */
  guiScript?: boolean;
  /** Standalone upstream program instead of a git subcommand. */
  executable?: CompanionExecutable;
  argv: readonly string[];
  /** Dispatch only an exact first operand; otherwise use this scope's fallback grammar. */
  dispatch?: Readonly<Record<string, string>>;
  /** Global options consumed before selecting a dispatched operation. */
  dispatchOptions?: readonly string[];
  /** Parser defaults supplied by the command before consuming user options. */
  initial?: Readonly<Record<string, string | number | boolean>>;
  options: Readonly<Record<string, OptionSpec>>;
  /** Native OPTION_NUMBER callback for a token such as -12. */
  numericOption?: OptionSpec;
  rules: readonly Constraint[];
  source: string;
  /** Whether `--` is recognized as an end-of-options marker. */
  separator: boolean;
  /** Native parser dispatch can stop at the first operand or treat all words as operands. */
  optionParsing?: 'stop-at-operand' | 'none';
  /** After the empty first parser, repository state selects a child command or success. */
  conditionalCommand?: ConditionalCommand;
  /** Audited parser exits; ignored words are serialized but not interpreted. */
  parserExit?: Evidence & {
    flags: readonly string[];
    /** A first --help is rewritten by Git's dispatcher before this parser runs. */
    exceptFirst?: readonly string[];
    /** Native lone-help or completion exits only when this parser invocation has exactly one word. */
    singleWordExits?: readonly string[];
    /** ONE_SHOT diff parsing can exit on the final retained option word. */
    remainingSingleWordExits?: readonly string[];
    /** KEEP_UNKNOWN_OPT pass: only these options execute before an exit in this pass. */
    firstPassOptions?: readonly string[];
    /** Native long names used by the initial parser's single-dash typo check. */
    firstPassLongNames?: readonly string[];
    /** PARSE_OPT_KEEP_DASHDASH: retain -- for the next phase. */
    keepDashDash?: boolean;
    /** Ordinary parsers consume --end-of-options; KEEP_UNKNOWN_OPT retains it. */
    keepEndOfOptions?: boolean;
    unknownOptions?: 'error' | 'keep';
    /** OPTION_SUBCOMMAND is required; selection stops this pass and invokes dispatch. */
    mandatorySubcommand?: true;
    /** Serialization shapes for parent and child tuples; not parent option recognition. */
    argumentOptions?: Readonly<Record<string, OptionSpec>>;
    stopAtOperand?: boolean;
    /** Compiled native long spellings; null denotes ambiguity. */
    longForms?: {
      plain: Readonly<Record<string, string | null>>;
      attached: Readonly<Record<string, string | null>>;
    };
    /** Native diff long-name resolution before the final unknown-word check. */
    remainingLongForms?: {
      plain: Readonly<Record<string, string | null>>;
      attached: Readonly<Record<string, string | null>>;
    };
    /** Commands which consume the retained argv as operands, without a revision parser. */
    remainingOperands?: 'all' | 'drop-leading-dashdash';
    /** Native operand phase recognizes its own -- boundary at selected positions. */
    remainingSeparator?: Evidence & { maxIndex?: number };
    /** Partition retained words before revision parsing; nonmatching words are separate operands. */
    remainingPartition?: Evidence & {
      optionPrefix: string;
      operandKey: string;
    };
    /** Stop at the first unknown option or operand (SUBCOMMAND_OPTIONAL fallback). */
    stopAtUnknown?: boolean;
    /** Ordered native wrappers with no option callbacks, before the first value parser. */
    wrappers?: readonly (Evidence & {
      kind: 'empty-options';
      keepDashDash?: boolean;
      stopAtUnknown?: boolean;
      /** Native subcommand names also participate in check_typos. */
      firstPassLongNames?: readonly string[];
    })[];
    /** Separate option definitions for the subsequent revision/diff parser. */
    remainingOptions?: Readonly<Record<string, OptionSpec>>;
    /** setup_revisions searches for -- before consuming values, unless assume_dashdash. */
    splitRemainingPaths?: boolean;
    /** Sequencer translates a leading retained - into the previous checkout. */
    leadingDashReplacement?: string;
    /** Single-letter diff options recognized while decoding retained clusters. */
    remainingShortOptions?: readonly string[];
    /** Native long names used by the later parser's single-dash typo check. */
    remainingLongNames?: readonly string[];
    /** Later-phase options whose values may occupy the next argv word. */
    remainingDetachedOptions?: readonly string[];
  };
};

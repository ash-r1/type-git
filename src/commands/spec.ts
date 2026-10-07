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
  allowed?: readonly (string | number | boolean)[];
  /** Git callbacks using ASCII case-insensitive enum matching. */
  caseInsensitive?: boolean;
  /** Match enum names without changing the spelling stored by the callback. */
  preserveCase?: boolean;
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
export type CommandSpec = {
  /** Standalone upstream program instead of a git subcommand. */
  executable?: CompanionExecutable;
  argv: readonly string[];
  /** Dispatch only an exact first operand; otherwise use this scope's fallback grammar. */
  dispatch?: Readonly<Record<string, string>>;
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
  /** Audited parser exits; ignored words are serialized but not interpreted. */
  parserExit?: Evidence & {
    flags: readonly string[];
    /** A first --help is rewritten by Git's dispatcher before this parser runs. */
    exceptFirst?: readonly string[];
    /** KEEP_UNKNOWN_OPT pass: only these options execute before an exit in this pass. */
    firstPassOptions?: readonly string[];
    /** Native long names used by the initial parser's single-dash typo check. */
    firstPassLongNames?: readonly string[];
  };
};

import type { GitScalarParser } from '../constraints/git-scalars.js';
import type { Constraint } from '../constraints/model.js';

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
  /** Git PARSE_OPT_CMDMODE rejects a change to an already selected mode immediately. */
  modeGroup?: string;
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
  /** Constraints evaluated before this token changes parser state; $value is the incoming value. */
  checks?: readonly Constraint[];
  /** Ordered callback side effects on other parser variables. */
  effects?: readonly {
    key: string;
    when?: { equals: string | number | boolean } | { notEquals: string | number | boolean };
    set: string | number | boolean;
  }[];
};
export type CommandSpec = {
  argv: readonly string[];
  /** Parser defaults supplied by the command before consuming user options. */
  initial?: Readonly<Record<string, string | number | boolean>>;
  options: Readonly<Record<string, OptionSpec>>;
  rules: readonly Constraint[];
  source: string;
  /** Whether `--` is recognized as an end-of-options marker. */
  separator: boolean;
  /** Native parser dispatch can stop at the first operand or treat all words as operands. */
  optionParsing?: 'stop-at-operand' | 'none';
};

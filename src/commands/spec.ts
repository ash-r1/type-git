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
  /** Finite supplied values accepted by both literal types and runtime validation. */
  allowed?: readonly (string | number | boolean)[];
  /** Ordered callback side effects on other parser variables. */
  effects?: readonly {
    key: string;
    when?: { equals: string | number | boolean } | { notEquals: string | number | boolean };
    set: string | number | boolean;
  }[];
};
export type CommandSpec = {
  argv: readonly string[];
  options: Readonly<Record<string, OptionSpec>>;
  rules: readonly Constraint[];
  source: string;
  /** Whether `--` is recognized as an end-of-options marker. */
  separator: boolean;
};

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
  /** Cobra StringSlice treats an empty value as no entries. */
  skipEmpty?: boolean;
  /** Insert parent options before this fixed command word. */
  before?: number;
};
export type CommandSpec = {
  argv: readonly string[];
  options: Readonly<Record<string, OptionSpec>>;
  rules: readonly Constraint[];
  source: string;
  /** Whether `--` is recognized as an end-of-options marker. */
  separator: boolean;
};

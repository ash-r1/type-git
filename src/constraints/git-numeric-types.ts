import type { GitDecimalParser } from './git-decimal.js';
import type { GitDecimalLiteral, GitDecimalValue } from './git-decimal-types.js';
import type { GitIntegerParser } from './git-integer.js';
import type { GitIntegerLiteral, GitIntegerValue } from './git-integer-types.js';

import type { GitTimestampParser } from './git-timestamp.js';
import type { GitTimestampLiteral, GitTimestampValue } from './git-timestamp-types.js';

export type GitNumericParser = GitIntegerParser | GitDecimalParser | GitTimestampParser;
export type GitNumericLiteral<V, P extends GitNumericParser> = P extends GitTimestampParser
  ? GitTimestampLiteral<V, P>
  : P extends GitDecimalParser
    ? GitDecimalLiteral<V, P>
    : P extends GitIntegerParser
      ? GitIntegerLiteral<V, P>
      : never;
export type GitNumericValue<V, P extends GitNumericParser> = P extends GitTimestampParser
  ? GitTimestampValue<V, P>
  : P extends GitDecimalParser
    ? GitDecimalValue<V, P>
    : P extends GitIntegerParser
      ? GitIntegerValue<V, P>
      : never;

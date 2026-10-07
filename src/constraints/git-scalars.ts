import { asciiLower } from './ascii.js';
import { validCompoundDecimal } from './compound-decimal.js';
import {
  type GitBooleanCallback,
  gitBoolean,
  isBooleanCallback,
  parseBooleanCallback,
} from './git-boolean.js';
import { type GitDecimalParser, parseGitDecimal } from './git-decimal.js';
import { type GitIntegerParser, integerState, parseGitInteger } from './git-integer.js';
import { validObjectFilter } from './object-filter.js';
import {
  isStringCallback,
  parseStringCallback,
  type StringCallbackParser,
} from './string-callback.js';

export { asciiLower } from './ascii.js';
export { gitBoolean } from './git-boolean.js';

/** Signed configuration integers use the same parser with an int storage width. */
export function gitInteger(value: string): bigint | undefined {
  return parseGitInteger(value, { kind: 'integer', signed: true, bits: 32 });
}

export type GitScalarParser =
  | GitIntegerParser
  | GitDecimalParser
  | GitBooleanCallback
  | 'depth-initial'
  | 'object-filter'
  | 'object-filter-auto'
  | StringCallbackParser
  | 'shortlog-group'
  | 'shortlog-wrap'
  | 'show-branch-reflog'
  | 'rev-list-missing'
  | 'config-type';
export function parseGitScalar(
  parser: GitScalarParser,
  value: unknown,
  previous?: unknown,
): { valid: boolean; value?: unknown } {
  if (typeof parser === 'object' && parser.kind === 'decimal') {
    return parseGitDecimal(value, parser, previous);
  }
  if (typeof parser === 'object') {
    const parsed = parseGitInteger(value, parser);
    return parsed === undefined ? { valid: false } : { valid: true, value: integerState(parsed) };
  }
  if (isBooleanCallback(parser)) {
    return parseBooleanCallback(parser, value, previous);
  }
  if (parser === 'depth-initial') {
    // Git clone/fetch call atoi before transport-specific validation. The pinned
    // 64-bit libc clamps strtol overflow, then atoi converts to a signed int.
    const match = /^[ \t\r\n\v\f]*([+-]?\d+)/.exec(String(value));
    if (!match) {
      return { valid: false };
    }
    const parsed = BigInt(match[1]!);
    const clamped =
      parsed < -9223372036854775808n
        ? -9223372036854775808n
        : parsed > 9223372036854775807n
          ? 9223372036854775807n
          : parsed;
    return { valid: BigInt.asIntN(32, clamped) > 0n, value };
  }
  if (parser === 'object-filter' || parser === 'object-filter-auto') {
    return {
      valid:
        value === undefined ||
        (typeof value === 'string' && validObjectFilter(value, parser === 'object-filter-auto')),
      value,
    };
  }
  if (isStringCallback(parser)) {
    return parseStringCallback(parser, value);
  }
  if (parser === 'shortlog-group') {
    return {
      valid:
        typeof value === 'string' &&
        (['author', 'committer'].includes(asciiLower(value)) ||
          value.startsWith('trailer:') ||
          value.startsWith('format:') ||
          value.includes('%')),
      value,
    };
  }
  if (parser === 'shortlog-wrap' || parser === 'show-branch-reflog') {
    return { valid: validCompoundDecimal(parser, value), value };
  }
  if (parser === 'rev-list-missing') {
    return {
      valid: typeof value === 'string',
      value: ['error', 'allow-any', 'print', 'print-info', 'allow-promisor'].includes(String(value))
        ? value
        : previous,
    };
  }
  if (parser === 'config-type') {
    if (value === undefined) {
      return { valid: true, value };
    }
    return {
      valid:
        ['bool', 'int', 'bool-or-int', 'bool-or-str', 'path', 'expiry-date', 'color'].includes(
          String(value),
        ) &&
        (previous === undefined || previous === value),
      value,
    };
  }
  const boolean = gitBoolean(value);
  return boolean === undefined ? { valid: false } : { valid: true, value: boolean };
}

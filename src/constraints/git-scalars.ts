import { type GitDecimalParser, parseGitDecimal } from './git-decimal.js';
import { type GitIntegerParser, integerState, parseGitInteger } from './git-integer.js';
import { validObjectFilter } from './object-filter.js';

const ASCII_UPPERCASE = /[A-Z]/g;
export function asciiLower(value: string): string {
  return value.replace(ASCII_UPPERCASE, (character) => character.toLowerCase());
}

/** Signed configuration integers use the same parser with an int storage width. */
export function gitInteger(value: string): bigint | undefined {
  return parseGitInteger(value, { kind: 'integer', signed: true, bits: 32 });
}

/** Undefined means an invalid spelling, not false. An absent option value is handled by its schema. */
export function gitBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const text = value.toLowerCase();
  if (['true', 'yes', 'on'].includes(text)) {
    return true;
  }
  if (['', 'false', 'no', 'off'].includes(text)) {
    return false;
  }
  const integer = gitInteger(value);
  return integer === undefined ? undefined : integer !== 0n;
}

export type GitScalarParser =
  | GitIntegerParser
  | GitDecimalParser
  | 'depth-initial'
  | 'object-filter'
  | 'object-filter-auto'
  | 'fast-import-sign'
  | 'fast-export-reencode'
  | 'anonymize-map'
  | 'pull-rebase'
  | 'shortlog-group'
  | 'shortlog-wrap'
  | 'show-branch-reflog'
  | 'rev-list-missing'
  | 'git-bool'
  | 'fetch-recurse'
  | 'push-recurse'
  | 'push-signed'
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
  if (parser === 'fast-import-sign') {
    const text = String(value);
    return {
      valid:
        [
          'abort',
          'verbatim',
          'ignore',
          'warn-verbatim',
          'warn',
          'warn-strip',
          'strip',
          'abort-if-invalid',
          'strip-if-invalid',
          'sign-if-invalid',
        ].includes(text) || text.startsWith('sign-if-invalid='),
      value,
    };
  }
  if (parser === 'anonymize-map') {
    const text = String(value);
    const colon = text.indexOf(':');
    return { valid: text.length > 0 && colon !== 0 && colon !== text.length - 1, value };
  }
  if (parser === 'fast-export-reencode' && asciiLower(String(value)) === 'abort') {
    return { valid: true, value: 'abort' };
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
  if (parser === 'shortlog-wrap') {
    if (value === true) {
      return { valid: true, value };
    }
    if (typeof value !== 'string') {
      return { valid: false };
    }
    const parts = value.split(',');
    if (parts.length > 3) {
      return { valid: false };
    }
    const parsed: number[] = [];
    for (let index = 0; index < 3; index++) {
      const part = parts[index] ?? '';
      if (part === '') {
        parsed.push([76, 6, 9][index]!);
        continue;
      }
      if (!/^[ \t\r\n\v\f]*[+-]?\d+$/.test(part)) {
        return { valid: false };
      }
      const number = BigInt(part.trimStart());
      if (number < 0n || number > 2147483647n) {
        return { valid: false };
      }
      parsed.push(Number(number));
    }
    const [width, first, rest] = parsed as [number, number, number];
    return { valid: width === 0 || (width > first && width > rest), value };
  }
  if (parser === 'show-branch-reflog') {
    return {
      valid:
        value === true ||
        (typeof value === 'string' && /^(?:[ \t\r\n\v\f]*[+-]?\d+)?(?:,[\s\S]*)?$/.test(value)),
      value,
    };
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
  if (parser === 'push-recurse' && value === 'only-is-on-demand') {
    return { valid: true, value: previous === 'only' ? 'on-demand' : previous };
  }
  const boolean = gitBoolean(value);
  if (boolean !== undefined) {
    return { valid: parser !== 'push-recurse' || !boolean, value: boolean };
  }
  if (parser === 'fetch-recurse' && value === 'on-demand') {
    return { valid: true, value };
  }
  if (parser === 'pull-rebase' && ['merges', 'm', 'interactive', 'i'].includes(String(value))) {
    return { valid: true, value: value === 'm' ? 'merges' : value === 'i' ? 'interactive' : value };
  }
  if (parser === 'push-recurse' && ['on-demand', 'check', 'only'].includes(String(value))) {
    return { valid: true, value };
  }
  if (parser === 'push-signed' && typeof value === 'string' && value.toLowerCase() === 'if-asked') {
    return { valid: true, value: 'if-asked' };
  }
  return { valid: false };
}

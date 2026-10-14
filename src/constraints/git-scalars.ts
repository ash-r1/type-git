import { type GitIntegerParser, integerState, parseGitInteger } from './git-integer.js';
import process from 'node:process';
import { nativeCLongBits, nativeSizeTBits } from './c-abi.js';
import { validObjectFilter } from './object-filter.js';

const ASCII_UPPERCASE = /[A-Z]/g;
/** Unicode integer tables belong to the selected Python interpreter. */
export const PYTHON_INTEGER_DEFERRED = Symbol('python-integer-deferred');

/** Python optparse._parse_num selects its radix before int trims whitespace/signs. */
export function pythonInteger(value: unknown): bigint | typeof PYTHON_INTEGER_DEFERRED | undefined {
  if (!['string', 'number', 'bigint'].includes(typeof value)) {
    return undefined;
  }
  const original = String(value);
  if (original.includes('\0')) {
    return undefined;
  }
  if ([...original].some((character) => character.charCodeAt(0) > 127)) {
    return PYTHON_INTEGER_DEFERRED;
  }
  let radix = 10;
  let text = original;
  if (/^0x/i.test(text)) {
    radix = 16;
  } else if (/^0b/i.test(text)) {
    radix = 2;
    // optparse removes this prefix and maps a bare 0b to 0 before calling int.
    text = text.slice(2) || '0';
  } else if (text.startsWith('0')) {
    radix = 8;
  }
  text = text.replace(/^[ \t\r\n\v\f]+|[ \t\r\n\v\f]+$/g, '');
  const negative = text.startsWith('-');
  if (/^[+-]/.test(text)) {
    text = text.slice(1);
  }
  const prefix = radix === 16 ? /^0x/i : radix === 8 ? /^0o/i : /^0b/i;
  if (radix !== 10 && prefix.test(text)) {
    text = text.slice(2).replace(/^_/, '');
  }
  const digit =
    radix === 16 ? '[0-9a-fA-F]' : radix === 8 ? '[0-7]' : radix === 2 ? '[01]' : '[0-9]';
  if (!new RegExp(`^${digit}(?:_?${digit})*$`).test(text)) {
    return undefined;
  }
  const digits = text.replaceAll('_', '');
  const parsed = BigInt(
    (radix === 16 ? '0x' : radix === 8 ? '0o' : radix === 2 ? '0b' : '') + digits,
  );
  return negative ? -parsed : parsed;
}
/** Fold only ASCII uppercase letters, matching Git's case-insensitive option languages. */
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
  | 'python-int'
  | 'perl-int'
  | 'perl-int-gnu'
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
  | 'abbrev'
  | 'mainline'
  | 'revision-count'
  | 'unsigned-int'
  | 'unsigned-size'
  | 'git-bool'
  | 'fetch-recurse'
  | 'push-recurse'
  | 'push-signed'
  | 'config-type';
/** Validate a schema-selected scalar using native widths; leave foreign integer text uncoerced. */
export function parseGitScalar(
  parser: GitScalarParser,
  value: unknown,
  previous?: unknown,
  cLongBits: 32 | 64 = nativeCLongBits(process.platform, process.arch),
  sizeTBits: 32 | 64 = nativeSizeTBits(process.arch),
  binaryIntegers = true,
): { valid: boolean; value?: unknown } {
  if (typeof parser === 'object') {
    const bits =
      parser.nativeWidth === 'long'
        ? cLongBits
        : parser.nativeWidth === 'size_t'
          ? sizeTBits
          : parser.bits;
    const parsed = parseGitInteger(value, { ...parser, bits }, binaryIntegers);
    return parsed === undefined ? { valid: false } : { valid: true, value: integerState(parsed) };
  }
  if (parser === 'perl-int' || parser === 'perl-int-gnu') {
    if (value === true || (parser === 'perl-int-gnu' && value === '')) {
      return { valid: true, value: 0 };
    }
    // Getopt::Long PAT_INT; Perl's dollar anchor accepts one final LF.
    return {
      valid:
        ['number', 'string', 'bigint'].includes(typeof value) &&
        /^[-+]?_*[0-9][0-9_]*\n?(?![\s\S])/.test(String(value)),
      value,
    };
  }
  if (parser === 'python-int') {
    const parsed = pythonInteger(value);
    return { valid: parsed !== undefined, value: parsed };
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
        (typeof value === 'string' &&
          validObjectFilter(value, parser === 'object-filter-auto', cLongBits, binaryIntegers)),
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
      const modulus = 1n << BigInt(cLongBits);
      // strtoul applies unsigned negation only within ULONG_MAX. Overflow
      // saturates to ULONG_MAX, which exceeds parse_uint's INT_MAX limit.
      if (number > modulus - 1n || number < -(modulus - 1n)) {
        return { valid: false };
      }
      const converted = number < 0n ? modulus + number : number;
      if (converted > 2147483647n) {
        return { valid: false };
      }
      parsed.push(Number(converted));
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
  if (parser === 'abbrev') {
    if (value === true) {
      return { valid: true, value };
    }
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
      return { valid: false };
    }
    const converted =
      (cLongBits === 32 ? Math.min(2147483647, Math.max(-2147483648, value)) : value) | 0;
    return { valid: true, value: converted !== 0 && converted < 4 ? 4 : converted };
  }
  if (parser === 'mainline') {
    // builtin/revert.c narrows strtol's long result to int before checking
    // positivity. LLP64 Git saturates at LONG_MAX/MIN before that narrowing.
    const converted =
      typeof value === 'number' && Number.isSafeInteger(value)
        ? cLongBits === 32
          ? Math.min(2147483647, Math.max(-2147483648, value))
          : value
        : 0;
    const mainline = converted | 0;
    return { valid: mainline > 0, value: mainline };
  }
  if (parser === 'unsigned-size') {
    return {
      valid:
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 0 &&
        (sizeTBits === 64 || value <= 4294967295),
      value,
    };
  }
  if (parser === 'revision-count' || parser === 'unsigned-int') {
    return {
      valid:
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= (parser === 'unsigned-int' ? 0 : -2147483648) &&
        value <= (parser === 'unsigned-int' ? 4294967295 : 2147483647),
      value,
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

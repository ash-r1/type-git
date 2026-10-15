import { type FastImportUnsignedParser, validFastImportUnsigned } from './fast-import-unsigned.js';
import {
  isStringCallback,
  type StringCallbackParser,
  parseStringCallback,
} from './string-callback.js';
import { asciiLower } from './ascii.js';
import { validCompoundDecimal } from './compound-decimal.js';
import {
  type GitBooleanCallback,
  type GitBooleanSource,
  type GitBooleanCapabilities,
  gitBoolean,
  isBooleanCallback,
  parseBooleanCallback,
} from './git-boolean.js';
export { asciiLower } from './ascii.js';
export { gitBoolean } from './git-boolean.js';
import {
  type GitDecimalParser,
  type GitDecimalCallbacks,
  parseGitDecimal,
  selectedGitDecimal,
} from './git-decimal.js';
import {
  type GitIntegerParser,
  integerState,
  parseGitInteger,
  parseLegacyGitInteger,
  type GitIntegerProfile,
} from './git-integer.js';
import process from 'node:process';
import { nativeCLongBits, nativeSizeTBits } from './c-abi.js';
import { validObjectFilter } from './object-filter.js';

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
/** Signed configuration integers use the same parser with an int storage width. */
export function gitInteger(value: string): bigint | undefined {
  return parseGitInteger(value, { kind: 'integer', signed: true, bits: 32 });
}

export type GitScalarParser =
  | FastImportUnsignedParser
  | GitBooleanCallback
  | GitDecimalParser
  | GitIntegerParser
  | 'python-int'
  | 'perl-int'
  | 'perl-int-gnu'
  | 'depth-initial'
  | 'object-filter'
  | 'object-filter-auto'
  | StringCallbackParser
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
/** Decimal-prefix atoi saturation precedes signed-int storage and the final positivity check. */
export function validInitialDepth(value: unknown, conversionBits: 32 | 64 = 64): boolean {
  const match = /^[ \t\r\n\v\f]*([+-]?\d+)/.exec(String(value));
  if (!match) {
    return false;
  }
  const parsed = BigInt(match[1]!);
  const minimum = -(1n << BigInt(conversionBits - 1));
  const maximum = (1n << BigInt(conversionBits - 1)) - 1n;
  const clamped = parsed < minimum ? minimum : parsed > maximum ? maximum : parsed;
  return BigInt.asIntN(32, clamped) > 0n;
}

/** Validate a schema-selected scalar using native widths; leave foreign integer text uncoerced. */
export function parseGitScalar(
  parser: GitScalarParser,
  value: unknown,
  previous?: unknown,
  cLongBits: 32 | 64 = nativeCLongBits(process.platform, process.arch),
  sizeTBits: 32 | 64 = nativeSizeTBits(process.arch),
  binaryIntegers = true,
  integerProfile?: GitIntegerProfile,
  negativeMagnitudes = false,
  decimalCallbacks?: GitDecimalCallbacks,
  unsignedChar = true,
  booleanSource: GitBooleanSource = 'modern',
  booleanBinaryIntegers = true,
  booleanCapabilities?: GitBooleanCapabilities,
  compoundNegatedOverflow = false,
  depthAtoiBits: 32 | 64 = 64,
): { valid: boolean; value?: unknown } {
  if (typeof parser === 'object' && parser.kind === 'decimal') {
    return parseGitDecimal(
      value,
      selectedGitDecimal(parser, decimalCallbacks),
      previous,
      cLongBits,
    );
  }
  if (typeof parser === 'object') {
    const bits =
      parser.nativeWidth === 'long'
        ? cLongBits
        : parser.nativeWidth === 'size_t'
          ? sizeTBits
          : parser.bits;
    const parsed =
      (integerProfile ?? parser.integerProfile) === 'decimal-cast' &&
      parser.bits === 32 &&
      !parser.nativeWidth
        ? parseLegacyGitInteger(value, parser, cLongBits)
        : parseGitInteger(
            value,
            { ...parser, bits },
            binaryIntegers,
            parser.negativeMagnitudes === false
              ? false
              : negativeMagnitudes || parser.negativeMagnitudes === true,
          );
    return parsed === undefined ? { valid: false } : { valid: true, value: integerState(parsed) };
  }
  if (isBooleanCallback(parser)) {
    return parseBooleanCallback(
      parser,
      value,
      previous,
      booleanSource,
      booleanBinaryIntegers,
      booleanCapabilities,
    );
  }
  if (
    parser === 'fast-import-active-branches' ||
    parser === 'fast-import-depth' ||
    parser === 'fast-import-cat-blob-fd'
  ) {
    return { valid: validFastImportUnsigned(parser, value), value };
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
    return { valid: validInitialDepth(value, depthAtoiBits), value };
  }
  if (parser === 'object-filter' || parser === 'object-filter-auto') {
    return {
      valid:
        value === undefined ||
        (typeof value === 'string' &&
          validObjectFilter(
            value,
            parser === 'object-filter-auto',
            cLongBits,
            binaryIntegers,
            negativeMagnitudes,
            unsignedChar,
          )),
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
    return {
      valid: validCompoundDecimal(parser, value, cLongBits, compoundNegatedOverflow),
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
  const boolean = gitBoolean(value);
  return boolean === undefined ? { valid: false } : { valid: true, value: boolean };
}

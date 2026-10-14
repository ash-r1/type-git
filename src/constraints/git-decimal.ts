import { integerState } from './git-integer.js';

/** Independently changed numeric callbacks, observed on the selected executable. */
export type GitDecimalCallback =
  | 'unified-context'
  | 'revision-count'
  | 'strip-count'
  | 'daemon-count'
  | 'daemon-timeout'
  | 'daemon-init-timeout';
export type GitDecimalCallbacks = Partial<Record<GitDecimalCallback, 'modern' | 'legacy'>>;

/** Each command fails or prints usage before doing repository or daemon work. */
export const DECIMAL_CALLBACK_PROBES: Record<GitDecimalCallback, readonly string[]> = {
  'unified-context': ['diff', '--no-index', '--unified=-1', '-h'],
  'revision-count': ['rev-list', '--max-count=1k', '-h'],
  'strip-count': ['apply', '-p', '1k', '-h'],
  'daemon-count': ['daemon', '--max-connections=1k', '-h'],
  'daemon-timeout': ['daemon', '--timeout=1k', '-h'],
  'daemon-init-timeout': ['daemon', '--init-timeout=1k', '-h'],
};

/** Unrecognized output leaves validation to the original native command. */
export function decimalCallbackFamily(
  callback: GitDecimalCallback,
  result: { exitCode: number; stdout: string; stderr: string },
): 'modern' | 'legacy' | undefined {
  const strict = {
    'unified-context': /expects a non-negative integer/,
    'revision-count': /not an integer/,
    'strip-count': /option -p expects a non-negative integer/,
    'daemon-count': /invalid max-connections .*expecting an integer/,
    'daemon-timeout': /invalid timeout .*expecting a non-negative integer/,
    'daemon-init-timeout': /invalid init-timeout .*expecting a non-negative integer/,
  }[callback];
  if (
    result.exitCode === (callback === 'unified-context' ? 129 : 128) &&
    strict.test(result.stderr)
  ) {
    return 'modern';
  }
  if (
    result.exitCode === 129 &&
    (result.stdout + result.stderr).includes('usage:') &&
    !/error:|fatal:/.test(result.stderr)
  ) {
    return 'legacy';
  }
  return undefined;
}

/** Ordered strtol/strtoul conversion stages using the selected executable’s C long width. */
export type GitDecimalParser = {
  kind: 'decimal';
  longBits: 32 | 64;
  bits: 32;
  signed: boolean;
  conversion: 'checked' | 'cast' | 'atoi';
  /** strtoul saturates ULONG_MAX before unsigned negation and int storage. */
  unsignedLong?: true;
  /** Some C runtimes negate a saturated unsigned result for negative overflow. */
  negateUnsignedOverflow?: true;
  nativeCallback?: GitDecimalCallback;
  clampNegativeToZero?: true;
  rejectMinus?: true;
  empty?: true;
  beforeNonnegative?: true;
  positive?: true;
  nonzeroMinimum?: 4;
  default?: 'unknown' | 'previous';
};

/** Older unified context stores signed int; older count callbacks consume an atoi prefix. */
export type LegacyGitDecimal<P extends GitDecimalParser> = P extends {
  nativeCallback: 'unified-context';
}
  ? Omit<P, 'beforeNonnegative' | 'signed'> & { signed: true }
  : P extends {
        nativeCallback:
          | 'revision-count'
          | 'strip-count'
          | 'daemon-count'
          | 'daemon-timeout'
          | 'daemon-init-timeout';
      }
    ? Omit<P, 'conversion' | 'beforeNonnegative' | 'empty' | 'rejectMinus'> & {
        conversion: 'atoi';
        empty: true;
      }
    : P;

/** Apply one independently observed callback implementation without changing other parsers. */
export function selectedGitDecimal(
  parser: GitDecimalParser,
  callbacks?: GitDecimalCallbacks,
): GitDecimalParser {
  if (!parser.nativeCallback || callbacks?.[parser.nativeCallback] !== 'legacy') {
    return parser;
  }
  const { beforeNonnegative: _before, rejectMinus: _minus, ...rest } = parser;
  return parser.nativeCallback === 'unified-context'
    ? { ...rest, signed: true }
    : { ...rest, conversion: 'atoi', empty: true };
}

/** Apply lexical, strtol, cast and semantic checks in native source order. */
export function parseGitDecimal(
  value: unknown,
  parser: GitDecimalParser,
  previous?: unknown,
  selectedLongBits: 32 | 64 = parser.longBits,
  compoundNegatedOverflow = false,
): { valid: boolean; value?: unknown } {
  if (value === true && parser.default) {
    return { valid: true, value: parser.default === 'previous' ? previous : true };
  }
  if (
    typeof value === 'number' &&
    (parser.conversion === 'atoi'
      ? !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER
      : !Number.isSafeInteger(value))
  ) {
    return { valid: false };
  }
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    return { valid: false };
  }
  const text = String(value);
  if (text.includes('\0')) {
    return { valid: false };
  }
  if (parser.rejectMinus && text.includes('-')) {
    return { valid: false };
  }
  const match =
    parser.conversion === 'atoi'
      ? /^[ \t\r\n\v\f]*([+-]?\d+)/.exec(text)
      : /^[ \t\r\n\v\f]*([+-]?\d+)$/.exec(text);
  if (
    parser.conversion !== 'atoi' &&
    !(text === '' && parser.empty) &&
    (!match || match[0] !== text)
  ) {
    return { valid: false };
  }
  let parsed = match ? BigInt(match[1]!) : 0n;
  if (parser.unsignedLong) {
    const maximum = (1n << BigInt(selectedLongBits)) - 1n;
    const magnitude = parsed < 0n ? -parsed : parsed;
    parsed =
      magnitude > maximum
        ? parsed < 0n && (compoundNegatedOverflow || parser.negateUnsignedOverflow)
          ? 1n
          : maximum
        : BigInt.asUintN(selectedLongBits, parsed);
  }
  if (parser.beforeNonnegative && parsed < 0n) {
    return { valid: false };
  }
  if (parser.conversion === 'checked') {
    const limit = 1n << BigInt(parser.bits - (parser.signed ? 1 : 0));
    if (parsed < (parser.signed ? -limit : 0n) || parsed >= limit) {
      return { valid: false };
    }
  } else {
    if (!parser.unsignedLong) {
      const longLimit = 1n << BigInt(selectedLongBits - 1);
      parsed = parsed < -longLimit ? -longLimit : parsed >= longLimit ? longLimit - 1n : parsed;
    }
    parsed = parser.signed
      ? BigInt.asIntN(parser.bits, parsed)
      : BigInt.asUintN(parser.bits, parsed);
  }
  if (parser.positive && parsed <= 0n) {
    return { valid: false };
  }
  if (parser.nonzeroMinimum && parsed !== 0n && parsed < BigInt(parser.nonzeroMinimum)) {
    parsed = BigInt(parser.nonzeroMinimum);
  }
  if (parser.clampNegativeToZero && parsed < 0n) {
    parsed = 0n;
  }
  return { valid: true, value: integerState(parsed) };
}

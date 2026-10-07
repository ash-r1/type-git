import { integerState } from './git-integer.js';

/** Ordered strtol conversion stages on the pinned LP64 Git profile. */
export type GitDecimalParser = {
  kind: 'decimal';
  longBits: 64;
  bits: 32;
  signed: boolean;
  conversion: 'checked' | 'cast';
  empty?: true;
  beforeNonnegative?: true;
  positive?: true;
  nonzeroMinimum?: 4;
  default?: 'unknown' | 'previous';
};

export function parseGitDecimal(
  value: unknown,
  parser: GitDecimalParser,
  previous?: unknown,
): { valid: boolean; value?: unknown } {
  if (value === true && parser.default) {
    return { valid: true, value: parser.default === 'previous' ? previous : true };
  }
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    return { valid: false };
  }
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    return { valid: false };
  }
  const text = String(value);
  const match = /^[ \t\r\n\v\f]*([+-]?\d+)$/.exec(text);
  if (!(text === '' && parser.empty) && (!match || match[0] !== text)) {
    return { valid: false };
  }
  let parsed = text === '' ? 0n : BigInt(match![1]!);
  if (parser.beforeNonnegative && parsed < 0n) {
    return { valid: false };
  }
  if (parser.conversion === 'checked') {
    const limit = 1n << BigInt(parser.bits - (parser.signed ? 1 : 0));
    if (parsed < (parser.signed ? -limit : 0n) || parsed >= limit) {
      return { valid: false };
    }
  } else {
    const longLimit = 1n << BigInt(parser.longBits - 1);
    parsed = parsed < -longLimit ? -longLimit : parsed >= longLimit ? longLimit - 1n : parsed;
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
  return { valid: true, value: integerState(parsed) };
}

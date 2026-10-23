import { DECIMAL_CALLBACK_PROBES, decimalCallbackFamily, parseGitDecimal } from './git-decimal.js';
import { integerState } from './git-integer.js';

/** Revision age uses uintmax seconds; old Git first converts an atoi signed int. */
export type GitTimestampParser = {
  kind: 'timestamp';
  nativeCallback?: 'revision-age';
  conversion: 'checked' | 'atoi';
  longBits: 32 | 64;
};

/** rev-list parses the age before -h without walking revisions or modifying files. */
export const TIMESTAMP_CALLBACK_PROBE = DECIMAL_CALLBACK_PROBES['revision-age'];

/** Unknown diagnostics leave the original executable responsible for validation. */
export function timestampCallbackFamily(result: {
  exitCode: number;
  stdout: string;
  stderr: string;
}): 'modern' | 'legacy' | undefined {
  return decimalCallbackFamily('revision-age', result);
}

const DECIMAL_TIMESTAMP = /^[ \t\r\n\v\f]*([+-]?)(\d+)$/;
/** Git initializes revision age filters to the timestamp_t all-ones sentinel. */
export const TIMESTAMP_DEFAULT = 18446744073709551615n;

/** Preserve decimal strtoumax sign/overflow order and legacy int-to-uintmax promotion. */
export function parseGitTimestamp(
  value: unknown,
  parser: GitTimestampParser,
): { valid: boolean; value?: number | bigint } {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    return { valid: false };
  }
  const text = String(value);
  if (text.includes('\0')) {
    return { valid: false };
  }
  if (parser.conversion === 'atoi') {
    const parsed = parseGitDecimal(text, {
      kind: 'decimal',
      conversion: 'atoi',
      empty: true,
      signed: true,
      bits: 32,
      longBits: parser.longBits,
    });
    return parsed.valid
      ? { valid: true, value: integerState(BigInt.asUintN(64, BigInt(parsed.value as number))) }
      : { valid: false };
  }
  const match = DECIMAL_TIMESTAMP.exec(text);
  if (!match || match[0] !== text) {
    return { valid: false };
  }
  const magnitude = BigInt(match[2]!);
  // strtoumax diagnoses magnitude overflow before applying unsigned negation.
  if (magnitude > TIMESTAMP_DEFAULT) {
    return { valid: false };
  }
  const parsed = match[1] === '-' ? BigInt.asUintN(64, -magnitude) : magnitude;
  return { valid: true, value: integerState(parsed) };
}

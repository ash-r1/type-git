export type GitIntegerProfile = 'bounded' | 'decimal-cast';

/** Compiler-recorded storage width used by Git's parse-options integer handlers. */
export type GitIntegerParser = {
  kind: 'integer';
  signed: boolean;
  bits: 8 | 16 | 32 | 64;
  /** Source-declared width resolved from the selected Git build. */
  nativeWidth?: 'long' | 'size_t';
  /** Explicit source family; public command clients consider supported alternatives. */
  integerProfile?: GitIntegerProfile;
  /** Older strtoumax magnitude parsing permits a minus sign before uintmax conversion. */
  negativeMagnitudes?: boolean;
};

/** Git 2.55 parse.c, base 0 and k/m/g units, on the recorded C23 libc profile. */
export function parseGitInteger(
  value: unknown,
  parser: GitIntegerParser,
  binaryIntegers = true,
  negativeMagnitudes = false,
): bigint | undefined {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    return undefined;
  }
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    return undefined;
  }
  const text = String(value);
  const match =
    /^[ \t\r\n\v\f]*([+-]?)(0[xX][\da-fA-F]+|0[bB][01]+|0[0-7]*|[1-9]\d*)([kKmMgG]?)$/.exec(text);
  // Require the match to consume the entire numeric value, as Git does.
  if (!match || match[0] !== text || (!parser.signed && match[1] === '-' && !negativeMagnitudes)) {
    return undefined;
  }
  const digits = match[2]!;
  if (!binaryIntegers && /^0[bB]/.test(digits)) {
    return undefined;
  }
  const magnitude = /^0[xXbB]/.test(digits)
    ? BigInt(digits)
    : digits.startsWith('0')
      ? BigInt(`0o${digits}`)
      : BigInt(digits);
  const power = { '': 0n, k: 10n, m: 20n, g: 30n }[(match[3] ?? '').toLowerCase()]!;
  if (!parser.signed && magnitude > 18446744073709551615n) {
    return undefined;
  }
  const signed = match[1] === '-' ? -magnitude : magnitude;
  // Git 2.25 config.c: strtoumax checks ERANGE before unsigned conversion;
  // the unit multiplication and destination maximum are checked afterwards.
  const base = !parser.signed && negativeMagnitudes ? BigInt.asUintN(64, signed) : signed;
  const number = base * (1n << power);
  const limit = 1n << BigInt(parser.bits - (parser.signed ? 1 : 0));
  return number >= (parser.signed ? -limit : 0n) && number < limit ? number : undefined;
}

/** Git 2.25 parse-options: decimal strtol with ignored errno, then int assignment. */
export function parseLegacyGitInteger(
  value: unknown,
  parser: GitIntegerParser,
  longBits: 32 | 64,
): bigint | undefined {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    return undefined;
  }
  if (!['number', 'string', 'bigint'].includes(typeof value)) {
    return undefined;
  }
  const text = String(value);
  const match = /^[ \t\r\n\v\f]*[+-]?[0-9]+$/.exec(text);
  if (!match || match[0] !== text) {
    return undefined;
  }
  const number = BigInt(text.trim());
  const minimum = -(1n << BigInt(longBits - 1));
  const maximum = (1n << BigInt(longBits - 1)) - 1n;
  const clamped = number < minimum ? minimum : number > maximum ? maximum : number;
  return parser.signed ? BigInt.asIntN(32, clamped) : BigInt.asUintN(32, clamped);
}

/** Keep small states comparable to schema literals without losing large unsigned integers. */
export function integerState(value: bigint): number | bigint {
  return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(value)
    : value;
}

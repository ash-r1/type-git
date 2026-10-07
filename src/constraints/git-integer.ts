/** Compiler-recorded storage width used by Git's parse-options integer handlers. */
export type GitIntegerParser = {
  kind: 'integer';
  signed: boolean;
  bits: 8 | 16 | 32 | 64;
};

/** Git 2.55 parse.c, base 0 and k/m/g units, on the recorded C23 libc profile. */
export function parseGitInteger(value: unknown, parser: GitIntegerParser): bigint | undefined {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    return undefined;
  }
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    return undefined;
  }
  const text = String(value);
  const match =
    /^[ \t\r\n\v\f]*([+-]?)(0[xX][\da-fA-F]+|0[bB][01]+|0[0-7]*|[1-9]\d*)([kKmMgG]?)$/.exec(text);
  // JavaScript's $ also matches before a final line break; Git requires the entire value.
  if (!match || match[0] !== text || (!parser.signed && match[1] === '-')) {
    return undefined;
  }
  const digits = match[2]!;
  const magnitude = /^0[xXbB]/.test(digits)
    ? BigInt(digits)
    : digits.startsWith('0')
      ? BigInt(`0o${digits}`)
      : BigInt(digits);
  const power = { '': 0n, k: 10n, m: 20n, g: 30n }[(match[3] ?? '').toLowerCase()]!;
  const number = (match[1] === '-' ? -magnitude : magnitude) * (1n << power);
  const limit = 1n << BigInt(parser.bits - (parser.signed ? 1 : 0));
  return number >= (parser.signed ? -limit : 0n) && number < limit ? number : undefined;
}

/** Keep small states comparable to schema literals without losing large unsigned integers. */
export function integerState(value: bigint): number | bigint {
  return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(value)
    : value;
}

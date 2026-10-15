/** fast-import ulong_arg callbacks share a base-zero language but distinct bounds. */
export type FastImportUnsignedParser =
  | 'fast-import-active-branches'
  | 'fast-import-depth'
  | 'fast-import-cat-blob-fd';

/**
 * Validate callback acceptance, retaining the original value for argv serialization.
 * strtoul ignores ERANGE here: saturation cannot violate the unbounded branch count,
 * and both supported long widths saturate above the two bounded callbacks' limits.
 * Binary prefixes are a portable C23 grammar arm; the selected native executable
 * still rejects them itself when its C runtime does not support that arm.
 */
export function validFastImportUnsigned(parser: FastImportUnsignedParser, value: unknown): boolean {
  if (!['number', 'string', 'bigint'].includes(typeof value)) {
    return false;
  }
  const original = String(value);
  if (
    !/^[ \t\r\n\v\f]*\+?(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[0-7]*|[1-9][0-9]*)(?![\s\S])/.test(
      original,
    )
  ) {
    return false;
  }
  if (parser === 'fast-import-active-branches') {
    return true;
  }
  const text = original.replace(/^[ \t\r\n\v\f]*\+?/, '');
  const magnitude = BigInt(/^0[0-7]+$/.test(text) ? `0o${text}` : text);
  return magnitude <= (parser === 'fast-import-depth' ? 8191n : 2147483647n);
}

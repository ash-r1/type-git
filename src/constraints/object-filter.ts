/** Git 2.55 list-objects-filter-options.c, parse.c and url.c; caller supplies the selected C long width. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: Git reserves every ASCII control byte.
const RESERVED = /[\x00-\x20~`!@#$^&*()[\]{}\\;'",<>?]/;

/** Match git_parse_ulong's spelling, unit multiplier and unsigned-long maximum. */
function unsignedLong(text: string, longBits: 32 | 64): boolean {
  const match = /^[ \t\r\n\v\f]*\+?(0[xX][\da-fA-F]+|0[bB][01]+|0[0-7]*|[1-9]\d*)([kKmMgG]?)$/.exec(
    text,
  );
  if (!match) {
    return false;
  }
  const digits = match[1]!;
  const value = /^0[xXbB]/.test(digits)
    ? BigInt(digits)
    : digits.startsWith('0')
      ? BigInt(`0o${digits}`)
      : BigInt(digits);
  const power = { '': 0n, k: 10n, m: 20n, g: 30n }[(match[2] ?? '').toLowerCase()]!;
  return value << power <= (1n << BigInt(longBits)) - 1n;
}

// Git preserves malformed escapes and %00; it decodes bytes, not UTF-8 characters.
/** Decode nonzero percent-encoded bytes while retaining malformed escapes and %00. */
function decode(text: string): string {
  return text.replace(/%([\da-fA-F]{2})/g, (encoded, hex: string) => {
    const byte = Number.parseInt(hex, 16);
    return byte === 0 ? encoded : String.fromCharCode(byte);
  });
}

/** Iterative traversal avoids imposing a JavaScript call-stack limit on nested combine filters. */
export function validObjectFilter(
  value: string,
  allowAuto = false,
  longBits: 32 | 64 = 64,
): boolean {
  const pending = [{ text: value, auto: allowAuto }];
  while (pending.length > 0) {
    const { text, auto } = pending.pop()!;
    if (text === 'blob:none' || (auto && text === 'auto') || text.startsWith('sparse:oid=')) {
      continue;
    }
    if (text.startsWith('blob:limit=') || text.startsWith('tree:')) {
      if (!unsignedLong(text.slice(text.startsWith('tree:') ? 5 : 11), longBits)) {
        return false;
      }
    } else if (text.startsWith('object:type=')) {
      if (!['commit', 'tree', 'blob', 'tag'].includes(text.slice(12))) {
        return false;
      }
    } else if (text.startsWith('combine:')) {
      const combined = text.slice(8);
      if (combined === '') {
        return false;
      }
      for (const child of combined.split('+')) {
        if (!child) {
          continue;
        }
        if (RESERVED.test(child)) {
          return false;
        }
        pending.push({ text: decode(child), auto: false });
      }
    } else {
      return false;
    }
  }
  return true;
}

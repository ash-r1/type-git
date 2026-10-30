import { parseGitInteger } from './git-integer.js';

/** Git 2.55 list-objects-filter-options.c, parse.c and url.c; caller supplies the selected C long width. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: Git reserves every ASCII control byte.
const RESERVED = /[\x00-\x20~`!@#$^&*()[\]{}\\;'",<>?]/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: The complement of ASCII identifies UTF-8 high bytes and decoded byte escapes.
const HIGH_BYTE = /[^\x00-\x7f]/;

/** Match git_parse_ulong's spelling, unit multiplier and unsigned-long maximum. */
function unsignedLong(
  text: string,
  longBits: 32 | 64,
  binaryIntegers: boolean,
  negativeMagnitudes: boolean,
): boolean {
  return (
    parseGitInteger(
      text,
      { kind: 'integer', signed: false, bits: longBits },
      binaryIntegers,
      negativeMagnitudes,
    ) !== undefined
  );
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
  binaryIntegers = true,
  negativeMagnitudes = false,
  unsignedChar = true,
  combineEmptyComponents = true,
): boolean {
  const pending = [{ text: value, auto: allowAuto }];
  while (pending.length > 0) {
    const { text, auto } = pending.pop()!;
    if (text === 'blob:none' || (auto && text === 'auto') || text.startsWith('sparse:oid=')) {
      continue;
    }
    if (text.startsWith('blob:limit=') || text.startsWith('tree:')) {
      if (
        !unsignedLong(
          text.slice(text.startsWith('tree:') ? 5 : 11),
          longBits,
          binaryIntegers,
          negativeMagnitudes,
        )
      ) {
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
          // Git 2.54+ skips empty components; older Git parses them and rejects the remainder.
          if (combineEmptyComponents) {
            continue;
          }
          return false;
        }
        if (RESERVED.test(child) || (!unsignedChar && HIGH_BYTE.test(child))) {
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

/** Detect numeric binary prefixes, including decoded nested filter components. */
export function objectFilterUsesBinary(value: string): boolean {
  const pending = [value];
  while (pending.length > 0) {
    const text = pending.pop()!;
    if (text.startsWith('blob:limit=') || text.startsWith('tree:')) {
      if (/^[ \t\r\n\v\f]*[+-]?0[bB]/.test(text.slice(text.startsWith('tree:') ? 5 : 11))) {
        return true;
      }
    } else if (text.startsWith('combine:')) {
      for (const child of text.slice(8).split('+')) {
        pending.push(decode(child));
      }
    }
  }
  return false;
}

/** Detect unsigned numeric minus signs without interpreting sparse object payloads. */
export function objectFilterUsesNegativeMagnitude(value: string): boolean {
  const pending = [value];
  while (pending.length > 0) {
    const text = pending.pop()!;
    if (text.startsWith('blob:limit=') || text.startsWith('tree:')) {
      if (/^[ \t\r\n\v\f]*-/.test(text.slice(text.startsWith('tree:') ? 5 : 11))) {
        return true;
      }
    } else if (text.startsWith('combine:')) {
      for (const child of text.slice(8).split('+')) {
        pending.push(decode(child));
      }
    }
  }
  return false;
}

/** Observe whether raw combined components can expose high bytes to C char validation. */
export function objectFilterUsesHighBytes(value: string): boolean {
  const pending = [value];
  while (pending.length > 0) {
    const text = pending.pop()!;
    if (!text.startsWith('combine:')) {
      continue;
    }
    for (const child of text.slice(8).split('+')) {
      if (HIGH_BYTE.test(child)) {
        return true;
      }
      pending.push(decode(child));
    }
  }
  return false;
}

/** Detect empty combined components, including decoded nested combined filters. */
export function objectFilterUsesEmptyComponent(value: string): boolean {
  const pending = [value];
  while (pending.length > 0) {
    const text = pending.pop()!;
    if (!text.startsWith('combine:')) {
      continue;
    }
    for (const child of text.slice(8).split('+')) {
      if (!child) {
        return true;
      }
      pending.push(decode(child));
    }
  }
  return false;
}

/** Readonly clone parser probe for empty combined components, without a URL or transport. */
export const OBJECT_FILTER_EMPTY_PROBE = ['clone', '--filter=combine:blob:none+', '-h'] as const;

/** Return only recognized empty-component outcomes; unknown frontends retain native validation. */
export function objectFilterCombineEmptyComponents(result: {
  exitCode: number;
  stdout: string;
  stderr: string;
}): boolean | undefined {
  if (result.exitCode === 128 && result.stderr.includes("invalid filter-spec 'blob:none+'")) {
    return false;
  }
  if (
    result.exitCode === 129 &&
    (result.stdout + result.stderr).includes('usage:') &&
    !/error:|fatal:/.test(result.stderr)
  ) {
    return true;
  }
  return undefined;
}

/** Readonly clone parser probe, without a URL or transport operation. */
export const OBJECT_FILTER_CHAR_PROBE = ['clone', '--filter=combine:sparse:oid=é', '-h'] as const;

/** Return only recognized native C char outcomes; unknown frontends retain native validation. */
export function objectFilterUnsignedChar(result: {
  exitCode: number;
  stdout: string;
  stderr: string;
}): boolean | undefined {
  if (result.exitCode === 128 && result.stderr.includes('must escape char in sub-filter-spec')) {
    return false;
  }
  if (
    result.exitCode === 129 &&
    (result.stdout + result.stderr).includes('usage:') &&
    !/error:|fatal:/.test(result.stderr)
  ) {
    return true;
  }
  return undefined;
}

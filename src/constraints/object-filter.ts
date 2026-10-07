import { parseGitInteger } from './git-integer.js';

/** Git 2.55 list-objects-filter-options.c, parse.c and url.c (64-bit unsigned long profile). */
// biome-ignore lint/suspicious/noControlCharactersInRegex: Git reserves every ASCII control byte.
const RESERVED = /[\x00-\x20~`!@#$^&*()[\]{}\\;'",<>?]/;

function unsignedLong(text: string): boolean {
  return parseGitInteger(text, { kind: 'integer', signed: false, bits: 64 }) !== undefined;
}

// Git preserves malformed escapes and %00; it decodes bytes, not UTF-8 characters.
function decode(text: string): string {
  return text.replace(/%([\da-fA-F]{2})/g, (encoded, hex: string) => {
    const byte = Number.parseInt(hex, 16);
    return byte === 0 ? encoded : String.fromCharCode(byte);
  });
}

/** Iterative traversal avoids imposing a JavaScript call-stack limit on nested combine filters. */
export function validObjectFilter(value: string, allowAuto = false): boolean {
  const pending = [{ text: value, auto: allowAuto }];
  while (pending.length > 0) {
    const { text, auto } = pending.pop()!;
    if (text === 'blob:none' || (auto && text === 'auto') || text.startsWith('sparse:oid=')) {
      continue;
    }
    if (text.startsWith('blob:limit=') || text.startsWith('tree:')) {
      if (!unsignedLong(text.slice(text.startsWith('tree:') ? 5 : 11))) {
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

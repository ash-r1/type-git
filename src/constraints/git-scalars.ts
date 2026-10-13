import process from 'node:process';
import { nativeCLongBits } from './c-abi.js';

const ASCII_UPPERCASE = /[A-Z]/g;
export function asciiLower(value: string): string {
  return value.replace(ASCII_UPPERCASE, (character) => character.toLowerCase());
}

/** Git 2.55 parse.c: signed 32-bit configuration integers with base-0 (including C23 binary literals) and k/m/g units. */
export function gitInteger(value: string): bigint | undefined {
  const match =
    /^[ \t\r\n\v\f]*([+-]?)(0[xX][\da-fA-F]+|0[bB][01]+|0[0-7]*|[1-9]\d*)([kKmMgG]?)$/.exec(value);
  if (!match) {
    return undefined;
  }
  const digits = match[2]!;
  const magnitude = /^0[xXbB]/.test(digits)
    ? BigInt(digits)
    : digits.startsWith('0')
      ? BigInt(`0o${digits}`)
      : BigInt(digits);
  const power = { '': 0n, k: 10n, m: 20n, g: 30n }[asciiLower(match[3] ?? '')]!;
  const number = (match[1] === '-' ? -magnitude : magnitude) * (1n << power);
  return number >= -2147483648n && number <= 2147483647n ? number : undefined;
}

/** Undefined means an invalid spelling, not false. An absent option value is handled by its schema. */
export function gitBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const text = value.toLowerCase();
  if (['true', 'yes', 'on'].includes(text)) {
    return true;
  }
  if (['', 'false', 'no', 'off'].includes(text)) {
    return false;
  }
  const integer = gitInteger(value);
  return integer === undefined ? undefined : integer !== 0n;
}

export type GitScalarParser =
  | 'abbrev'
  | 'mainline'
  | 'revision-count'
  | 'unsigned-int'
  | 'git-bool'
  | 'fetch-recurse'
  | 'push-recurse'
  | 'push-signed'
  | 'config-type';
export function parseGitScalar(
  parser: GitScalarParser,
  value: unknown,
  previous?: unknown,
  cLongBits: 32 | 64 = nativeCLongBits(process.platform, process.arch),
): { valid: boolean; value?: unknown } {
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
  if (parser === 'push-recurse' && value === 'only-is-on-demand') {
    return { valid: true, value: previous === 'only' ? 'on-demand' : previous };
  }
  const boolean = gitBoolean(value);
  if (boolean !== undefined) {
    return { valid: parser !== 'push-recurse' || !boolean, value: boolean };
  }
  if (parser === 'fetch-recurse' && value === 'on-demand') {
    return { valid: true, value };
  }
  if (parser === 'push-recurse' && ['on-demand', 'check', 'only'].includes(String(value))) {
    return { valid: true, value };
  }
  if (parser === 'push-signed' && typeof value === 'string' && value.toLowerCase() === 'if-asked') {
    return { valid: true, value: 'if-asked' };
  }
  return { valid: false };
}

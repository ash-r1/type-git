import { STRING_CALLBACKS } from './string-callbacks.generated.js';

export type StringCallbackProfile = { source: string } & (
  | { kind: 'rename-score'; parts: 1 | 2 }
  | { kind: 'character-set'; characters: string }
  | { kind: 'trailing-token-list'; separator: string; exact: readonly string[] }
  | {
      kind: 'resetting-token-list';
      separator: string;
      reset: string;
      trimAscii: true;
      ordinary: readonly string[];
      exclusive: readonly string[];
    }
  | { kind: 'byte-character'; emptyIsNative: true }
  | { kind: 'choice'; exact: readonly string[]; prefixes: readonly string[] }
  | {
      kind: 'token-list';
      separators: readonly string[];
      exact: readonly string[];
      projection: { initial: string; values: Readonly<Record<string, string>> };
    }
  | { kind: 'first-separator'; separator: string; allowUnseparated: boolean }
);
export type StringCallbackParser = keyof typeof STRING_CALLBACKS;
/** Recognize only profiles declared by the source-audited callback registry. */
/** Recognize only parsers registered in the pinned source-backed callback schema. */
export function isStringCallback(parser: string): parser is StringCallbackParser {
  return Object.hasOwn(STRING_CALLBACKS, parser);
}
/** Apply the case-sensitive choices or first-separator grammar without rewriting the value. */
/** Validate callback text while keeping projection available to callers that store state. */
export function validStringCallback(parser: StringCallbackParser, value: unknown): boolean {
  return parseStringCallback(parser, value).valid;
}
/** Apply the source token grammar and its ordered projection without changing emitted argv. */
export function parseStringCallback(
  parser: StringCallbackParser,
  value: unknown,
): { valid: boolean; value?: unknown } {
  const profile: StringCallbackProfile = STRING_CALLBACKS[parser];
  if (value === true && profile.kind === 'rename-score') {
    return { valid: true, value };
  }
  if (typeof value !== 'string') {
    return { valid: false };
  }
  if (profile.kind === 'trailing-token-list') {
    const tokens = value.split(profile.separator);
    if (tokens[tokens.length - 1] === '') {
      tokens.pop();
    }
    return { valid: tokens.every((token) => profile.exact.includes(token)), value };
  }
  if (profile.kind === 'resetting-token-list') {
    let ordinary = false;
    let exclusive = false;
    let invalid = false;
    for (const raw of value.split(profile.separator)) {
      let start = 0;
      let end = raw.length;
      const whitespace = ' \t\n\r\v\f';
      while (start < end && whitespace.includes(raw[start]!)) {
        start++;
      }
      while (end > start && whitespace.includes(raw[end - 1]!)) {
        end--;
      }
      const token = raw.slice(start, end);
      if (token === profile.reset) {
        ordinary = false;
        exclusive = false;
        invalid = false;
      } else if (profile.ordinary.includes(token)) {
        ordinary = true;
      } else if (profile.exclusive.includes(token)) {
        exclusive = true;
      } else {
        invalid = true;
      }
    }
    return { valid: !invalid && !(ordinary && exclusive), value };
  }
  if (profile.kind === 'character-set') {
    return {
      valid: [...value].every((character) => profile.characters.includes(character)),
      value,
    };
  }
  if (profile.kind === 'rename-score') {
    const parts = value.split('/');
    const valid =
      parts.length <= profile.parts &&
      parts.every((part) => {
        let dot = false;
        for (let index = 0; index < part.length; index++) {
          const character = part[index];
          if (character !== undefined && character >= '0' && character <= '9') {
            continue;
          }
          if (character === '.' && !dot) {
            dot = true;
            continue;
          }
          if (character === '%' && index === part.length - 1) {
            return true;
          }
          return false;
        }
        return true;
      });
    return { valid, value };
  }
  if (profile.kind === 'byte-character') {
    return { valid: value === '' || (value.length === 1 && value.charCodeAt(0) < 128), value };
  }
  if (profile.kind === 'choice') {
    return {
      valid:
        profile.exact.includes(value) ||
        profile.prefixes.some((prefix) => value.startsWith(prefix)),
      value,
    };
  }
  if (profile.kind === 'token-list') {
    let token = '';
    let projected = profile.projection.initial;
    for (const character of [...value, profile.separators[0]!]) {
      if (!profile.separators.includes(character)) {
        token += character;
        continue;
      }
      if (token) {
        if (!profile.exact.includes(token)) {
          return { valid: false };
        }
        if (Object.hasOwn(profile.projection.values, token)) {
          projected = profile.projection.values[token]!;
        }
        token = '';
      }
    }
    return { valid: true, value: projected };
  }
  const index = value.indexOf(profile.separator);
  return {
    valid:
      index < 0
        ? profile.allowUnseparated && value.length > 0
        : index > 0 && index + profile.separator.length < value.length,
    value,
  };
}

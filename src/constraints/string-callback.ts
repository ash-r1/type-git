import { STRING_CALLBACKS } from './string-callbacks.generated.js';

export type StringCallbackProfile = { source: string } & (
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
export function isStringCallback(parser: string): parser is StringCallbackParser {
  return Object.hasOwn(STRING_CALLBACKS, parser);
}
export function validStringCallback(parser: StringCallbackParser, value: unknown): boolean {
  return parseStringCallback(parser, value).valid;
}
export function parseStringCallback(
  parser: StringCallbackParser,
  value: unknown,
): { valid: boolean; value?: unknown } {
  if (typeof value !== 'string') {
    return { valid: false };
  }
  const profile: StringCallbackProfile = STRING_CALLBACKS[parser];
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

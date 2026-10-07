import { STRING_CALLBACKS } from './string-callbacks.generated.js';

export type StringCallbackProfile = { source: string } & (
  | { kind: 'choice'; exact: readonly string[]; prefixes: readonly string[] }
  | { kind: 'first-separator'; separator: string; allowUnseparated: boolean }
);
export type StringCallbackParser = keyof typeof STRING_CALLBACKS;
export function isStringCallback(parser: string): parser is StringCallbackParser {
  return Object.hasOwn(STRING_CALLBACKS, parser);
}
export function validStringCallback(parser: StringCallbackParser, value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const profile: StringCallbackProfile = STRING_CALLBACKS[parser];
  if (profile.kind === 'choice') {
    return (
      profile.exact.includes(value) || profile.prefixes.some((prefix) => value.startsWith(prefix))
    );
  }
  const index = value.indexOf(profile.separator);
  return index < 0
    ? profile.allowUnseparated && value.length > 0
    : index > 0 && index + profile.separator.length < value.length;
}

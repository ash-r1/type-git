import { asciiLower } from './ascii.js';
import { BOOLEAN_CALLBACKS, BOOLEAN_GRAMMAR } from './boolean-callbacks.generated.js';
import { parseGitInteger } from './git-integer.js';

/** Recorded parser families: 2.25 permits bare units; 2.47 rejects INT_MIN; 2.55 supports it. */
export type GitBooleanSource = 'legacy-units' | 'symmetric' | 'modern';

export type GitBooleanProfile = {
  allowTrue: boolean;
  names: Readonly<Record<string, string>>;
  caseInsensitive?: boolean;
  transitions?: Readonly<Record<string, { from: string; to: string }>>;
  source: string;
};
export type GitBooleanCallback = keyof typeof BOOLEAN_CALLBACKS;

/** Undefined means invalid; omitted CLI values are supplied by their option schema. */
export function gitBoolean(
  value: unknown,
  source: GitBooleanSource = 'modern',
  binaryIntegers = true,
): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const text = asciiLower(value);
  if ((BOOLEAN_GRAMMAR.true as readonly string[]).includes(text)) {
    return true;
  }
  if ((BOOLEAN_GRAMMAR.false as readonly string[]).includes(text)) {
    return false;
  }
  if (source === 'legacy-units' && /^[kmgKMG]$/.test(value)) {
    return false;
  }
  const integer = parseGitInteger(value, BOOLEAN_GRAMMAR.integer, binaryIntegers);
  if (source !== 'modern' && integer === -2147483648n) {
    return undefined;
  }
  return integer === undefined ? undefined : integer !== 0n;
}

export function isBooleanCallback(parser: string): parser is GitBooleanCallback {
  return Object.hasOwn(BOOLEAN_CALLBACKS, parser);
}

export function parseBooleanCallback(
  parser: GitBooleanCallback,
  value: unknown,
  previous?: unknown,
  source: GitBooleanSource = 'modern',
  binaryIntegers = true,
): { valid: boolean; value?: unknown } {
  const profile: GitBooleanProfile = BOOLEAN_CALLBACKS[parser];
  if (
    typeof value === 'string' &&
    profile.transitions &&
    Object.hasOwn(profile.transitions, value)
  ) {
    if (source === 'legacy-units') {
      return { valid: false };
    }
    const transition = profile.transitions[value]!;
    return { valid: true, value: previous === transition.from ? transition.to : previous };
  }
  const boolean = gitBoolean(value, source, binaryIntegers);
  if (boolean !== undefined) {
    return { valid: !boolean || profile.allowTrue, value: boolean };
  }
  if (typeof value !== 'string') {
    return { valid: false };
  }
  if (
    source === 'legacy-units' &&
    parser === 'pull-rebase' &&
    (value === 'preserve' || value === 'p')
  ) {
    return { valid: true, value: 'preserve' };
  }
  const name = profile.caseInsensitive ? asciiLower(value) : value;
  return Object.hasOwn(profile.names, name)
    ? { valid: true, value: profile.names[name] }
    : { valid: false };
}

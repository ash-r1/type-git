import { COMPOUND_DECIMALS } from './compound-decimals.generated.js';
import { type GitDecimalParser, parseGitDecimal } from './git-decimal.js';

export type CompoundDecimalProfile = {
  separator: ',';
  decimal: GitDecimalParser;
  source: string;
} & (
  | { kind: 'prefix' }
  | {
      kind: 'tuple';
      defaults: readonly number[];
      nonzeroGreaterThan: { index: number; others: readonly number[] };
    }
);
export type CompoundDecimalParser = keyof typeof COMPOUND_DECIMALS;

/** Recognize the registered source-audited compound callback profiles. */
export function isCompoundDecimal(value: unknown): value is CompoundDecimalParser {
  return typeof value === 'string' && Object.hasOwn(COMPOUND_DECIMALS, value);
}

/** Validate each reached strtoul field using the selected executable's C long width. */
export function validCompoundDecimal(
  parser: CompoundDecimalParser,
  value: unknown,
  longBits: 32 | 64 = 64,
  compoundNegatedOverflow = false,
): boolean {
  if (value === true) {
    return true;
  }
  if (typeof value !== 'string') {
    return false;
  }
  const profile: CompoundDecimalProfile = COMPOUND_DECIMALS[parser];
  if (profile.kind === 'prefix') {
    const separator = value.indexOf(profile.separator);
    return parseGitDecimal(
      separator < 0 ? value : value.slice(0, separator),
      profile.decimal,
      undefined,
      longBits,
      compoundNegatedOverflow,
    ).valid;
  }
  const parts = value.split(profile.separator);
  if (parts.length > profile.defaults.length) {
    return false;
  }
  const values: number[] = [];
  for (const [index, fallback] of profile.defaults.entries()) {
    const part = parts[index] ?? '';
    if (part === '') {
      values.push(fallback);
      continue;
    }
    const parsed = parseGitDecimal(
      part,
      profile.decimal,
      undefined,
      longBits,
      compoundNegatedOverflow,
    );
    if (!parsed.valid || typeof parsed.value !== 'number') {
      return false;
    }
    values.push(parsed.value);
  }
  const pivot = values[profile.nonzeroGreaterThan.index]!;
  return pivot === 0 || profile.nonzeroGreaterThan.others.every((index) => pivot > values[index]!);
}

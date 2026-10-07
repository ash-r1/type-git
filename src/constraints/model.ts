import { type GitScalarParser, gitBoolean, parseGitScalar } from './git-scalars.js';
import { lfsBytes } from './scalars.js';
/** Declarative constraints: no Git processes, TypeScript compiler, or repository state. */
export type Evidence = {
  /** Git restrictions and wrapper exceptions must remain distinguishable. */
  origin: 'git' | 'type-git';
  reason: string;
  /** Version-pinned upstream source, or a documented wrapper contract. */
  source: string;
};
export type Predicate =
  | {
      key: string;
      test:
        | 'gitEnabled'
        | 'gitDisabled'
        | 'active'
        | 'inactive'
        | 'present'
        | 'nonzero'
        | 'nonblank'
        | 'nonempty'
        | 'positive'
        | 'bytesPositive';
    }
  | { key: string; test: 'equals' | 'notEquals'; value: string | number | boolean }
  | { key: string; test: 'startsWith'; value: string }
  | { key: string; test: 'includes' | 'equalsKey'; valueKey: string }
  | { key: string; test: 'lengthEquals'; value: number };
export type Constraint = Evidence & { id: string; guard?: readonly Predicate[] } & (
    | {
        kind: 'arity';
        key: string;
        min: number;
        max?: number;
        when?: Predicate | readonly Predicate[];
      }
    | { kind: 'required'; required: readonly Predicate[] }
    | { kind: 'exclusive'; keys: readonly string[] }
    | { kind: 'exclusiveGroups'; groups: readonly (readonly Predicate[])[] }
    | { kind: 'requiresAny'; when: Predicate; choices: readonly Predicate[] }
    | { kind: 'requires'; when: Predicate; required: readonly Predicate[] }
    | { kind: 'conflicts'; when: Predicate; others: readonly Predicate[] }
    | { kind: 'forbid'; when: readonly Predicate[] }
    | { kind: 'unsupported'; keys: readonly string[] }
    | { kind: 'scalar'; key: string; parser: GitScalarParser }
    | { kind: 'value' | 'elements'; key: string; allowed: readonly (string | number | boolean)[] }
    | { kind: 'range'; key: string; min: number; max?: number; when?: Predicate }
    | { kind: 'eachInteger'; key: string; min: number }
    | { kind: 'integer'; key: string; min: number; allowBoolean?: boolean }
  );

export function matches(predicate: Predicate, options: Readonly<Record<string, unknown>>): boolean {
  const value = options[predicate.key];
  switch (predicate.test) {
    case 'lengthEquals':
      return Array.isArray(value) && value.length === predicate.value;
    case 'equalsKey':
      return value === options[predicate.valueKey];
    case 'includes':
      return Array.isArray(value) && value.includes(options[predicate.valueKey]);
    case 'gitDisabled':
      return gitBoolean(value) === false;
    case 'gitEnabled':
      return gitBoolean(value) === true || value === 'on-demand';
    case 'inactive':
      return value === undefined || value === false;
    case 'active':
      return value !== undefined && value !== false;
    case 'nonzero':
      return value !== undefined && value !== false && value !== 0 && value !== 0n;
    case 'nonblank':
      return (
        (typeof value === 'string' ? value : Array.isArray(value) ? value.join(',') : '').trim()
          .length > 0
      );
    case 'nonempty':
      return (typeof value === 'string' || Array.isArray(value)) && value.length > 0;
    case 'bytesPositive':
      return (lfsBytes(value) ?? 0) > 0;
    case 'positive':
      return (typeof value === 'number' || typeof value === 'bigint') && value > 0;
    case 'present':
      return value !== undefined;
    case 'equals':
      return value === predicate.value;
    case 'notEquals':
      return value !== predicate.value;
    case 'startsWith':
      return typeof value === 'string' && value.startsWith(predicate.value);
  }
}

/** All violations, in declaration order, retain their evidence and stable identifiers. */
export function violations(
  rules: readonly Constraint[],
  options: Readonly<Record<string, unknown>>,
): Constraint[] {
  return rules.filter((rule) => violates(rule, options));
}

function violates(rule: Constraint, options: Readonly<Record<string, unknown>>): boolean {
  if (rule.guard && !rule.guard.every((p) => matches(p, options))) {
    return false;
  }
  switch (rule.kind) {
    case 'arity': {
      if (rule.when && !conditions(rule.when).every((p) => matches(p, options))) {
        return false;
      }
      const value = options[rule.key];
      const count = value === undefined ? 0 : Array.isArray(value) ? value.length : 1;
      return count < rule.min || (rule.max !== undefined && count > rule.max);
    }
    case 'required':
      return !rule.required.every((p) => matches(p, options));
    case 'exclusive':
      return rule.keys.filter((key) => matches({ key, test: 'active' }, options)).length > 1;
    case 'exclusiveGroups':
      return rule.groups.filter((group) => group.some((p) => matches(p, options))).length > 1;
    case 'requiresAny':
      return matches(rule.when, options) && !rule.choices.some((p) => matches(p, options));
    case 'requires':
      return matches(rule.when, options) && !rule.required.every((p) => matches(p, options));
    case 'conflicts':
      return matches(rule.when, options) && rule.others.some((p) => matches(p, options));
    case 'forbid':
      return rule.when.every((p) => matches(p, options));
    case 'unsupported':
      return rule.keys.some((key) => options[key] !== undefined);
    case 'eachInteger': {
      const items = options[rule.key];
      return (
        items !== undefined &&
        (!Array.isArray(items) ||
          items.some((item) => !Number.isSafeInteger(item) || item < rule.min))
      );
    }
    case 'elements': {
      const items = options[rule.key];
      return (
        items !== undefined &&
        (!Array.isArray(items) || items.some((item) => !rule.allowed.includes(item)))
      );
    }
    case 'scalar':
      return (
        options[rule.key] !== undefined && !parseGitScalar(rule.parser, options[rule.key]).valid
      );
    case 'value':
      return options[rule.key] !== undefined && !rule.allowed.some((v) => v === options[rule.key]);
    case 'range':
      return (
        (!rule.when || matches(rule.when, options)) &&
        typeof options[rule.key] === 'number' &&
        ((options[rule.key] as number) < rule.min ||
          (rule.max !== undefined && (options[rule.key] as number) > rule.max))
      );
    case 'integer': {
      const value = options[rule.key];
      return (
        value !== undefined &&
        !(rule.allowBoolean && typeof value === 'boolean') &&
        (!Number.isSafeInteger(value) || (value as number) < rule.min)
      );
    }
  }
}

/** State fields read by one predicate, including relational operands. */
export function predicateKeys(predicate: Predicate): string[] {
  return predicate.test === 'includes' || predicate.test === 'equalsKey'
    ? [predicate.key, predicate.valueKey]
    : [predicate.key];
}

export function referencedKeys(rule: Constraint): string[] {
  return [...(rule.guard ?? []).flatMap(predicateKeys), ...bodyKeys(rule)];
}

function bodyKeys(rule: Constraint): string[] {
  switch (rule.kind) {
    case 'arity':
      return [rule.key, ...conditions(rule.when).flatMap(predicateKeys)];
    case 'required':
      return rule.required.flatMap(predicateKeys);
    case 'exclusiveGroups':
      return rule.groups.flatMap((group) => group.flatMap(predicateKeys));
    case 'exclusive':
    case 'unsupported':
      return [...rule.keys];
    case 'requiresAny':
      return [...predicateKeys(rule.when), ...rule.choices.flatMap(predicateKeys)];
    case 'requires':
      return [...predicateKeys(rule.when), ...rule.required.flatMap(predicateKeys)];
    case 'conflicts':
      return [...predicateKeys(rule.when), ...rule.others.flatMap(predicateKeys)];
    case 'forbid':
      return rule.when.flatMap(predicateKeys);
    case 'range':
      return rule.when ? [rule.key, ...predicateKeys(rule.when)] : [rule.key];
    case 'scalar':
    case 'value':
    case 'elements':
    case 'eachInteger':
    case 'integer':
      return [rule.key];
  }
}

export function conditions(
  when: Predicate | readonly Predicate[] | undefined,
): readonly Predicate[] {
  return when === undefined ? [] : Array.isArray(when) ? when : [when as Predicate];
}

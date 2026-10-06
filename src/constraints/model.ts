import { gitBoolean } from './git-scalars.js';
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
  | { key: string; test: 'startsWith'; value: string };
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
    | { kind: 'value'; key: string; allowed: readonly (string | number | boolean)[] }
    | { kind: 'range'; key: string; min: number; when?: Predicate }
    | { kind: 'integer'; key: string; min: number; allowBoolean?: boolean }
  );

export function matches(predicate: Predicate, options: Readonly<Record<string, unknown>>): boolean {
  const value = options[predicate.key];
  switch (predicate.test) {
    case 'gitEnabled':
      return gitBoolean(value) === true || value === 'on-demand';
    case 'inactive':
      return value === undefined || value === false;
    case 'active':
      return value !== undefined && value !== false;
    case 'nonzero':
      return value !== undefined && value !== false && value !== 0;
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
      return typeof value === 'number' && value > 0;
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
    case 'value':
      return options[rule.key] !== undefined && !rule.allowed.some((v) => v === options[rule.key]);
    case 'range':
      return (
        (!rule.when || matches(rule.when, options)) &&
        typeof options[rule.key] === 'number' &&
        (options[rule.key] as number) < rule.min
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

export function referencedKeys(rule: Constraint): string[] {
  return [...(rule.guard ?? []).map((p) => p.key), ...bodyKeys(rule)];
}

function bodyKeys(rule: Constraint): string[] {
  switch (rule.kind) {
    case 'arity':
      return [rule.key, ...conditions(rule.when).map((p) => p.key)];
    case 'required':
      return rule.required.map((p) => p.key);
    case 'exclusiveGroups':
      return rule.groups.flatMap((group) => group.map((p) => p.key));
    case 'exclusive':
    case 'unsupported':
      return [...rule.keys];
    case 'requiresAny':
      return [rule.when.key, ...rule.choices.map((p) => p.key)];
    case 'requires':
      return [rule.when.key, ...rule.required.map((p) => p.key)];
    case 'conflicts':
      return [rule.when.key, ...rule.others.map((p) => p.key)];
    case 'forbid':
      return rule.when.map((p) => p.key);
    case 'range':
      return rule.when ? [rule.key, rule.when.key] : [rule.key];
    case 'value':
    case 'integer':
      return [rule.key];
  }
}

export function conditions(
  when: Predicate | readonly Predicate[] | undefined,
): readonly Predicate[] {
  return when === undefined ? [] : Array.isArray(when) ? when : [when as Predicate];
}

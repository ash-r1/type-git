/** Declarative constraints: no Git processes, TypeScript compiler, or repository state. */
export type Evidence = {
  /** Git restrictions and wrapper exceptions must remain distinguishable. */
  origin: 'git' | 'type-git';
  reason: string;
  /** Version-pinned upstream source, or a documented wrapper contract. */
  source: string;
};
export type Predicate =
  | { key: string; test: 'active' | 'present' | 'nonzero' }
  | { key: string; test: 'equals'; value: string | number | boolean };
export type Constraint = Evidence & { id: string } & (
    | { kind: 'exclusive'; keys: readonly string[] }
    | { kind: 'requires'; when: Predicate; required: readonly Predicate[] }
    | { kind: 'conflicts'; when: Predicate; others: readonly Predicate[] }
    | { kind: 'forbid'; when: readonly Predicate[] }
    | { kind: 'unsupported'; keys: readonly string[] }
    | { kind: 'value'; key: string; allowed: readonly (string | number | boolean)[] }
    | { kind: 'range'; key: string; min: number }
    | { kind: 'integer'; key: string; min: number; allowBoolean?: boolean }
  );

export function matches(predicate: Predicate, options: Readonly<Record<string, unknown>>): boolean {
  const value = options[predicate.key];
  switch (predicate.test) {
    case 'active':
      return value !== undefined && value !== false;
    case 'nonzero':
      return value !== undefined && value !== false && value !== 0;
    case 'present':
      return value !== undefined;
    case 'equals':
      return value === predicate.value;
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
  switch (rule.kind) {
    case 'exclusive':
      return rule.keys.filter((key) => matches({ key, test: 'active' }, options)).length > 1;
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
      return typeof options[rule.key] === 'number' && (options[rule.key] as number) < rule.min;
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
  switch (rule.kind) {
    case 'exclusive':
    case 'unsupported':
      return [...rule.keys];
    case 'requires':
      return [rule.when.key, ...rule.required.map((p) => p.key)];
    case 'conflicts':
      return [rule.when.key, ...rule.others.map((p) => p.key)];
    case 'forbid':
      return rule.when.map((p) => p.key);
    case 'value':
    case 'integer':
    case 'range':
      return [rule.key];
  }
}

import { type Constraint, referencedKeys, violations } from './model.js';

/** Explicit finite domains. undefined denotes an omitted option, not a CLI argument. */
export type Domains = Readonly<Record<string, readonly unknown[]>>;
export type Assignment = Readonly<Record<string, unknown>>;

/** Stable exhaustive enumeration. No sampling, randomness, environment, or Git invocation. */
export function* assignments(domains: Domains): Generator<Assignment> {
  const keys = Object.keys(domains).sort();
  const current: Record<string, unknown> = {};
  function* visit(index: number): Generator<Assignment> {
    if (index === keys.length) {
      yield { ...current };
      return;
    }
    const key = keys[index]!;
    const values = domains[key]!;
    if (values.length === 0) {
      throw new Error(`Empty domain: ${key}`);
    }
    for (const value of values) {
      if (value === undefined) {
        delete current[key];
      } else {
        current[key] = value;
      }
      yield* visit(index + 1);
    }
    delete current[key];
  }
  yield* visit(0);
}

/**
 * Connected components of the constraint hypergraph. Each component is exhaustive;
 * the full solution set is exactly the Cartesian product of its accepted assignments.
 * This avoids enumerating combinations of unrelated options. Domain choice still bounds
 * the guarantee: it does not prove the completeness of the model against Git itself.
 */
export function components(rules: readonly Constraint[], domains: Domains): string[][] {
  const remaining = new Set(Object.keys(domains).sort());
  const edges = rules.map(referencedKeys);
  if (edges.some((edge) => edge.length === 0)) {
    throw new Error('Every explored constraint must reference at least one option');
  }
  for (const key of edges.flat()) {
    if (!(key in domains)) {
      throw new Error(`Missing domain: ${key}`);
    }
  }
  const result: string[][] = [];
  for (const first of [...remaining]) {
    if (!remaining.has(first)) {
      continue;
    }
    const group = new Set([first]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of edges) {
        if (!edge.some((key) => group.has(key))) {
          continue;
        }
        for (const key of edge) {
          if (!group.has(key)) {
            group.add(key);
            changed = true;
          }
        }
      }
    }
    const keys = [...group].sort();
    for (const key of keys) {
      remaining.delete(key);
    }
    result.push(keys);
  }
  return result;
}

export function explore(rules: readonly Constraint[], domains: Domains) {
  return components(rules, domains).map((keys) => {
    const localRules = rules.filter((rule) =>
      referencedKeys(rule).some((key) => keys.includes(key)),
    );
    return {
      keys,
      cases: [...assignments(Object.fromEntries(keys.map((key) => [key, domains[key]!])))].map(
        (options) => ({ options, violations: violations(localRules, options).map((r) => r.id) }),
      ),
    };
  });
}

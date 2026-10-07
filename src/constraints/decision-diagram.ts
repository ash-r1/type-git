import type { Assignment, Domains } from './explore.js';
import {
  type Constraint,
  conditions,
  matches,
  type Predicate,
  predicateKeys,
  referencedKeys,
  violations,
} from './model.js';

/** A reduced ordered multi-valued decision diagram over explicitly bounded domains. */
export type DecisionNode = { key: string; edges: readonly number[] };
export type Exploration = {
  keys: readonly string[];
  /** IDs 0 and 1 are false and true; other IDs index nodes[id - 2]. */
  nodes: readonly DecisionNode[];
  root: number;
  total: bigint;
  accepted: bigint;
  witness: Assignment | undefined;
  /** An assignment violating exactly this rule, or undefined if no such witness exists. */
  counterexamples: Readonly<Record<string, Assignment | undefined>>;
};

/**
 * Exact within the supplied finite domains. Variables and branches have stable order;
 * no sampling, Git invocation, or heuristic cutoff is involved. Reduction shares equal
 * residual functions. Worst-case space remains exponential for arbitrary constraints.
 * This proves properties of a model, not that its rules cover every upstream behavior.
 */
export function solve(rules: readonly Constraint[], domains: Domains): Exploration {
  const keys = Object.keys(domains).sort();
  const levels = new Map(keys.map((key, i) => [key, i]));
  for (const key of keys) {
    if (domains[key]?.length === 0) {
      throw new Error(`Empty domain: ${key}`);
    }
  }
  const ids = new Set<string>();
  for (const rule of rules) {
    if (ids.has(rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    ids.add(rule.id);
    for (const key of referencedKeys(rule)) {
      if (!levels.has(key)) {
        throw new Error(`Missing domain: ${key}`);
      }
    }
  }
  const nodes: DecisionNode[] = [];
  const unique = new Map<string, number>();
  const cache = new Map<string, number>();
  const negated = new Map<number, number>([
    [0, 1],
    [1, 0],
  ]);
  function node(key: string, edges: number[]): number {
    if (edges.every((edge) => edge === edges[0])) {
      return edges[0]!;
    }
    const signature = `${levels.get(key)}:${edges.join(',')}`;
    const old = unique.get(signature);
    if (old !== undefined) {
      return old;
    }
    const id = nodes.push({ key, edges }) + 1;
    unique.set(signature, id);
    return id;
  }
  function not(id: number): number {
    const old = negated.get(id);
    if (old !== undefined) {
      return old;
    }
    const n = nodes[id - 2]!;
    const result = node(n.key, n.edges.map(not));
    negated.set(id, result);
    negated.set(result, id);
    return result;
  }
  function and(a: number, b: number): number {
    if (a === 0 || b === 0) {
      return 0;
    }
    if (a === 1 || a === b) {
      return b;
    }
    if (b === 1) {
      return a;
    }
    if (a > b) {
      return and(b, a);
    }
    const signature = `${a}&${b}`;
    const old = cache.get(signature);
    if (old !== undefined) {
      return old;
    }
    const left = nodes[a - 2]!;
    const right = nodes[b - 2]!;
    const level = Math.min(levels.get(left.key)!, levels.get(right.key)!);
    const key = keys[level]!;
    const result = node(
      key,
      domains[key]!.map((_, i) =>
        and(left.key === key ? left.edges[i]! : a, right.key === key ? right.edges[i]! : b),
      ),
    );
    cache.set(signature, result);
    return result;
  }
  const or = (a: number, b: number) => not(and(not(a), not(b)));
  const all = (items: readonly number[]) => items.reduce(and, 1);
  const any = (items: readonly number[]) => items.reduce(or, 0);
  function atom(p: Predicate): number {
    const inputs = [...new Set(predicateKeys(p))].sort();
    function branch(index: number, state: Assignment): number {
      const key = inputs[index];
      return key === undefined
        ? Number(matches(p, state))
        : node(
            key,
            domains[key]!.map((value) => branch(index + 1, { ...state, [key]: value })),
          );
    }
    return branch(0, {});
  }
  function compile(rule: Constraint): number {
    if (rule.guard) {
      return or(not(all(rule.guard.map(atom))), compile({ ...rule, guard: undefined }));
    }
    switch (rule.kind) {
      case 'range':
      case 'arity': {
        const unconditional = { ...rule, when: undefined };
        const cardinality = node(
          rule.key,
          domains[rule.key]!.map((value) =>
            Number(violations([unconditional], { [rule.key]: value }).length === 0),
          ),
        );
        return rule.when ? or(not(all(conditions(rule.when).map(atom))), cardinality) : cardinality;
      }
      case 'required':
        return all(rule.required.map(atom));
      case 'requires':
        return or(not(atom(rule.when)), all(rule.required.map(atom)));
      case 'requiresAny':
        return or(not(atom(rule.when)), any(rule.choices.map(atom)));
      case 'conflicts':
        return not(and(atom(rule.when), any(rule.others.map(atom))));
      case 'forbid':
        return not(all(rule.when.map(atom)));
      case 'exclusive':
      case 'exclusiveGroups': {
        let none = 1;
        let atMostOne = 1;
        const groups =
          rule.kind === 'exclusive'
            ? [...rule.keys].sort().map((key) => atom({ key, test: 'active' }))
            : rule.groups.map((group) => any(group.map(atom)));
        for (const active of groups) {
          atMostOne = and(atMostOne, or(not(active), none));
          none = and(none, not(active));
        }
        return atMostOne;
      }
      case 'unsupported':
        return not(any(rule.keys.map((key) => atom({ key, test: 'present' }))));
      case 'scalar':
      case 'value':
      case 'elements':
      case 'eachInteger':
      case 'integer':
        return node(
          rule.key,
          domains[rule.key]!.map((value) =>
            Number(violations([rule], { [rule.key]: value }).length === 0),
          ),
        );
    }
  }
  const compiled = rules.map(compile);
  const prefixes = [1];
  for (const rule of compiled) {
    prefixes.push(and(prefixes.at(-1)!, rule));
  }
  const suffixes = Array<number>(compiled.length + 1).fill(1);
  for (let i = compiled.length - 1; i >= 0; i--) {
    suffixes[i] = and(compiled[i]!, suffixes[i + 1]!);
  }
  const root = prefixes.at(-1)!;
  const products = Array<bigint>(keys.length + 1).fill(1n);
  for (let i = keys.length - 1; i >= 0; i--) {
    products[i] = products[i + 1]! * BigInt(domains[keys[i]!]!.length);
  }
  const counts = new Map<number, bigint>();
  function count(id: number, level: number): bigint {
    if (id < 2) {
      return id === 0 ? 0n : products[level]!;
    }
    const n = nodes[id - 2]!;
    const ownLevel = levels.get(n.key)!;
    let own = counts.get(id);
    if (own === undefined) {
      own = n.edges.reduce((sum, edge) => sum + count(edge, ownLevel + 1), 0n);
      counts.set(id, own);
    }
    return (products[level]! / products[ownLevel]!) * own;
  }
  function witness(id: number): Assignment | undefined {
    if (id === 0) {
      return undefined;
    }
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      let index = 0;
      if (id > 1) {
        const n = nodes[id - 2]!;
        if (n.key === key) {
          index = n.edges.findIndex((edge) => edge !== 0);
          id = n.edges[index]!;
        }
      }
      const value = domains[key]![index];
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }
  const counterexamples = Object.fromEntries(
    rules.map((rule, i) => [
      rule.id,
      witness(and(and(prefixes[i]!, suffixes[i + 1]!), not(compiled[i]!))),
    ]),
  );
  return {
    keys,
    nodes,
    root,
    total: products[0]!,
    accepted: count(root, 0),
    witness: witness(root),
    counterexamples,
  };
}

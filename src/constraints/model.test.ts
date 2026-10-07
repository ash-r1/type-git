import { describe, expect, it } from 'vitest';
import { CLONE_DOMAINS } from './clone-domains.js';
import { COMMAND_CONSTRAINTS } from './commands.js';
import { assignments, components, explore } from './explore.js';
import { type Constraint, violations } from './model.js';

const evidence = { origin: 'git', reason: 'Test constraint', source: 'fixture' } as const;

describe('finite constraint exploration', () => {
  it('decomposes the solution space without losing higher-order or independent interactions', () => {
    const rules: Constraint[] = [
      {
        ...evidence,
        id: 'requires',
        kind: 'requires',
        when: { key: 'a', test: 'active' },
        required: [
          { key: 'b', test: 'active' },
          { key: 'c', test: 'active' },
        ],
      },
      { ...evidence, id: 'exclusive', kind: 'exclusive', keys: ['d', 'e'] },
    ];
    const domain = [undefined, false, true];
    const domains = { a: domain, b: domain, c: domain, d: domain, e: domain };
    const monolithic = [...assignments(domains)].filter((o) => violations(rules, o).length === 0);
    const partitioned = explore(rules, domains);
    const combined = partitioned.reduce<Record<string, unknown>[]>(
      (acc, group) =>
        acc.flatMap((base) =>
          group.cases
            .filter((c) => c.violations.length === 0)
            .map((c) => ({ ...base, ...c.options })),
        ),
      [{}],
    );
    const canonical = (values: readonly Record<string, unknown>[]) =>
      values.map((v) => JSON.stringify(Object.fromEntries(Object.entries(v).sort()))).sort();
    expect(canonical(combined)).toEqual(canonical(monolithic));
    expect(monolithic).toHaveLength(152);
    expect(components(rules, domains)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ]);
    expect(explore(rules, { e: domain, c: domain, a: domain, d: domain, b: domain })).toEqual(
      partitioned,
    );
  });

  it('finds an unsatisfiable component and reports stable rule identifiers', () => {
    const rules: Constraint[] = [
      { ...evidence, id: 'must-be-true', kind: 'value', key: 'a', allowed: [true] },
      { ...evidence, id: 'must-be-false', kind: 'value', key: 'a', allowed: [false] },
    ];
    const result = explore(rules, { a: [false, true] })[0]!;
    expect(result.cases.every((c) => c.violations.length > 0)).toBe(true);
    expect(result.cases.map((c) => c.violations)).toEqual([['must-be-true'], ['must-be-false']]);
  });

  it('fails explicitly when a domain is omitted or empty', () => {
    expect(() => explore(COMMAND_CONSTRAINTS.clone, {})).toThrow('Missing domain');
    expect(() => [...assignments({ a: [] })]).toThrow('Empty domain');
    expect(() => explore([{ ...evidence, id: 'empty', kind: 'forbid', when: [] }], {})).toThrow(
      'must reference',
    );
  });

  it('preserves omitted, false, zero, and present values as different semantic states', () => {
    expect(violations(COMMAND_CONSTRAINTS.clone, { alsoFilterSubmodules: false })).toEqual([]);
    expect(
      violations(COMMAND_CONSTRAINTS.clone, {
        alsoFilterSubmodules: true,
        filter: 'blob:none',
        recurseSubmodules: false,
      }).map((r) => r.id),
    ).toEqual(['clone.submodule-filter']);
    expect(violations(COMMAND_CONSTRAINTS.fetch, { depth: 1, deepen: 0 })).toEqual([]);
    expect(violations(COMMAND_CONSTRAINTS.fetch, { depth: 1, deepen: 1 }).map((r) => r.id)).toEqual(
      ['fetch.deepen-depth'],
    );
    expect(
      violations(COMMAND_CONSTRAINTS.revert, { abort: true, rerereAutoupdate: false }).map(
        (r) => r.id,
      ),
    ).toEqual(['revert.abort-options']);
    expect(
      violations(COMMAND_CONSTRAINTS.merge, { squash: true, ff: false }).map((r) => r.id),
    ).toEqual(['merge.squash-no-ff-false']);
    expect(violations(COMMAND_CONSTRAINTS.clone, { jobs: 0 })).toEqual([]);
  });

  it('requires unique, documented constraints and makes every clone rule observable', () => {
    const all = Object.values(COMMAND_CONSTRAINTS).flat();
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    for (const rule of all) {
      expect(rule.reason.length).toBeGreaterThan(20);
      expect(rule.source).toMatch(/^(https:\/\/github.com\/.*\/blob\/v|docs\/design\/)/);
    }
    const groups = explore(COMMAND_CONSTRAINTS.clone, CLONE_DOMAINS);
    for (const rule of COMMAND_CONSTRAINTS.clone) {
      // A witness that violates ONLY this rule detects redundant/masked constraints.
      expect(
        groups.some((g) =>
          g.cases.some((c) => c.violations.length === 1 && c.violations[0] === rule.id),
        ),
        rule.id,
      ).toBe(true);
    }
  });
});

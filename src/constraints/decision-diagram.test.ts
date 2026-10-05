import { describe, expect, it } from 'vitest';
import { solve } from './decision-diagram.js';
import { assignments } from './explore.js';
import { INPUT_CONSTRAINTS, INPUT_DOMAINS } from './inputs.js';
import { type Constraint, violations } from './model.js';

const evidence = {
  origin: 'git',
  reason: 'Independent exploration test',
  source: 'fixture',
} as const;
const p = (key: string) => ({ key, test: 'active' }) as const;
const domains = {
  a: [undefined, false, true],
  b: [undefined, false, true],
  c: [undefined, 0, 1, -1, 0.5],
};
const mixedRules: Constraint[] = [
  { ...evidence, id: 'exclusive', kind: 'exclusive', keys: ['a', 'b'] },
  { ...evidence, id: 'requires', kind: 'requires', when: p('a'), required: [p('b')] },
  { ...evidence, id: 'any', kind: 'requiresAny', when: p('a'), choices: [p('b'), p('c')] },
  { ...evidence, id: 'required', kind: 'required', required: [p('b')] },
  { ...evidence, id: 'forbid', kind: 'forbid', when: [p('a'), p('b'), p('c')] },
  { ...evidence, id: 'conflicts', kind: 'conflicts', when: p('a'), others: [p('b'), p('c')] },
  { ...evidence, id: 'unsupported', kind: 'unsupported', keys: ['a'] },
  { ...evidence, id: 'value', kind: 'value', key: 'b', allowed: [true] },
  { ...evidence, id: 'integer', kind: 'integer', key: 'c', min: -1 },
  { ...evidence, id: 'range', kind: 'range', key: 'c', min: 0 },
];

describe('reduced ordered decision diagrams', () => {
  it('agrees with full enumeration for every subset of a mixed constraint system', () => {
    const inputs = [...assignments(domains)];
    for (let mask = 0; mask < 2 ** mixedRules.length; mask++) {
      const selected = mixedRules.filter((_, i) => mask & (1 << i));
      const expected = inputs.filter((input) => violations(selected, input).length === 0);
      const result = solve(selected, domains);
      expect(result.total).toBe(45n);
      expect(result.accepted, `subset ${mask}`).toBe(BigInt(expected.length));
      if (result.witness) {
        expect(violations(selected, result.witness)).toEqual([]);
      } else {
        expect(expected).toHaveLength(0);
      }
      for (const rule of selected) {
        const witness = result.counterexamples[rule.id];
        const possible = inputs.some((input) => {
          const failed = violations(selected, input);
          return failed.length === 1 && failed[0]!.id === rule.id;
        });
        expect(witness !== undefined).toBe(possible);
        if (witness) {
          expect(violations(selected, witness).map((r) => r.id)).toEqual([rule.id]);
        }
      }
    }
  });

  it('evaluates guarded constraints without changing inactive modes', () => {
    const guarded = mixedRules.map(
      (rule) => ({ ...rule, guard: [{ key: 'mode', test: 'notEquals', value: 'skip' }] }) as const,
    );
    const domain = { ...domains, mode: [undefined, 'run', 'skip'] };
    const expected = [...assignments(domain)].filter(
      (input) => violations(guarded, input).length === 0,
    );
    expect(solve(guarded, domain).accepted).toBe(BigInt(expected.length));
    expect(solve(guarded, { ...domains, mode: ['skip'] }).accepted).toBe(45n);
  });

  it('counts 80 interacting boolean variables exactly without enumerating 2^80 assignments', () => {
    const keys = Array.from({ length: 80 }, (_, i) => `flag${i.toString().padStart(2, '0')}`);
    const result = solve(
      [{ ...evidence, id: 'one', kind: 'exclusive', keys }],
      Object.fromEntries(keys.map((key) => [key, [false, true]])),
    );
    expect(result.total).toBe(2n ** 80n);
    expect(result.accepted).toBe(81n);
    expect(result.nodes.length).toBeLessThan(20000);
  });

  it('handles operand cardinality and value predicates at their boundaries', () => {
    for (const name of ['lfsCheckout', 'pathspec'] as const) {
      const rules = INPUT_CONSTRAINTS[name];
      const domain = INPUT_DOMAINS[name];
      expect(solve(rules, domain).accepted).toBe(
        BigInt(
          [...assignments(domain)].filter((input) => violations(rules, input).length === 0).length,
        ),
      );
    }
    const conditional: Constraint[] = [
      { ...evidence, id: 'conditional', kind: 'range', key: 'c', min: 0, when: p('a') },
    ];
    expect(solve(conditional, domains).accepted).toBe(
      BigInt(
        [...assignments(domains)].filter((input) => violations(conditional, input).length === 0)
          .length,
      ),
    );
    for (const test of [
      'inactive',
      'nonzero',
      'nonempty',
      'nonblank',
      'positive',
      'bytesPositive',
      'present',
    ] as const) {
      const rules: Constraint[] = [
        { ...evidence, id: test, kind: 'forbid', when: [{ key: 'value', test }] },
      ];
      const domain = {
        value: [undefined, false, true, -1, 0, 0.5, 1, '', ' ', '0.5b', '1kb', [], [''], ['file']],
      };
      expect(solve(rules, domain).accepted).toBe(
        BigInt(
          [...assignments(domain)].filter((input) => violations(rules, input).length === 0).length,
        ),
      );
    }
  });

  it('is deterministic and handles unconstrained, empty, and contradictory spaces', () => {
    const result = solve(mixedRules, domains);
    expect(solve(mixedRules, { c: domains.c, b: domains.b, a: domains.a })).toEqual(result);
    expect(solve([], {}).accepted).toBe(1n);
    expect(solve([], { x: [undefined, false, true] }).accepted).toBe(3n);
    expect(() => solve([], { x: [] })).toThrow('Empty domain');
    expect(() => solve(mixedRules, {})).toThrow('Missing domain');
    expect(() => solve([mixedRules[0]!, mixedRules[0]!], domains)).toThrow('Duplicate rule');
    expect(solve([{ ...evidence, id: 'impossible', kind: 'forbid', when: [] }], {}).accepted).toBe(
      0n,
    );
  });
});

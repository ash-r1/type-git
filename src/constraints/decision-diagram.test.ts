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
  {
    ...evidence,
    id: 'groups',
    kind: 'exclusiveGroups',
    groups: [[p('a'), p('b')], [{ key: 'c', test: 'positive' }]],
  },
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

  it('solves cross-field membership exactly in either variable order', () => {
    for (const [key, valueKey] of [
      ['a', 'z'],
      ['z', 'a'],
    ]) {
      const rule: Constraint = {
        ...evidence,
        id: 'duplicate',
        kind: 'forbid',
        when: [{ key: key!, test: 'includes', valueKey: valueKey! }],
      };
      const domain = {
        [key!]: [undefined, [], ['gc'], ['GC'], ['gc', 'GC']],
        [valueKey!]: [undefined, 'gc', 'GC', 'other'],
      };
      const result = solve([rule], domain);
      expect(result.total).toBe(20n);
      expect(result.accepted).toBe(16n);
      const witness = result.counterexamples.duplicate!;
      expect((witness[key!] as unknown[]).includes(witness[valueKey!])).toBe(true);
      expect(() => solve([rule], { [key!]: [[]] })).toThrow(`Missing domain: ${valueKey}`);
      const guarded = { ...rule, guard: [p('enabled')] };
      expect(solve([guarded], { ...domain, enabled: [false, true] }).accepted).toBe(36n);
      expect(solve([rule], Object.fromEntries(Object.entries(domain).reverse()))).toEqual(result);
    }
  });

  it('uses operand cardinality as a mode predicate', () => {
    const rules: Constraint[] = [
      {
        ...evidence,
        id: 'trivial',
        kind: 'arity',
        key: 'tokens',
        min: 3,
        max: 3,
        when: { key: 'operands', test: 'lengthEquals', value: 3 },
      },
    ];
    const domain = {
      operands: [undefined, [], ['a'], ['a', 'b'], ['a', 'b', 'c']],
      tokens: [[], ['a', 'b', 'c'], ['a', 'b', 'c', 'd']],
    };
    expect(solve(rules, domain).accepted).toBe(13n);
    const witness = solve(rules, domain).counterexamples.trivial!;
    expect(witness.operands).toHaveLength(3);
    expect(witness.tokens).not.toHaveLength(3);
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

  it('counts relational equality exactly in either variable order', () => {
    for (const [key, valueKey] of [
      ['good', 'bad'],
      ['bad', 'good'],
    ]) {
      const rules: Constraint[] = [
        {
          ...evidence,
          id: 'different',
          kind: 'forbid',
          when: [{ key: key!, test: 'equalsKey', valueKey: valueKey! }],
        },
      ];
      const termDomains = { good: ['a', 'b', 'c'], bad: ['a', 'b', 'c'] };
      const result = solve(rules, termDomains);
      expect(result.total).toBe(9n);
      expect(result.accepted).toBe(6n);
      expect(result.accepted).toBe(
        BigInt(
          [...assignments(termDomains)].filter((input) => violations(rules, input).length === 0)
            .length,
        ),
      );
      expect(result.counterexamples.different!.good).toBe(result.counterexamples.different!.bad);
      expect(solve(rules, { bad: termDomains.bad, good: termDomains.good })).toEqual(result);
    }
  });

  it('includes both numeric range boundaries in exact guarded counts', () => {
    const rules: Constraint[] = [
      {
        ...evidence,
        id: 'bounded',
        kind: 'range',
        key: 'n',
        min: 0,
        max: 2,
        when: { key: 'enabled', test: 'active' },
      },
    ];
    const domain = { n: [-1, 0, 1, 2, 3], enabled: [false, true] };
    const result = solve(rules, domain);
    expect(result.total).toBe(10n);
    expect(result.accepted).toBe(8n);
    expect(violations(rules, { n: 3, enabled: true })).toHaveLength(1);
    expect(violations(rules, { n: 2, enabled: true })).toHaveLength(0);
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

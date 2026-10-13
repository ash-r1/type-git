import { describe, expect, it } from 'vitest';
import { commandDomains } from './command-domains.mjs';
import { solve } from '../src/constraints/decision-diagram.ts';
import { violations } from '../src/constraints/model.ts';

describe('relational command domains', () => {
  it('distinguishes empty positional strings from absent operands when referenced', () => {
    const keys = rule => rule.required.map(predicate => predicate.key);
    const rules = [{ kind: 'required', required: [{ key: 'operand0', test: 'nonempty' }, { key: 'operand1', test: 'nonempty' }] }];
    const domains = commandDomains({ options: {}, rules }, keys);
    expect(new Set(domains.operand0)).toEqual(new Set(['', undefined, 'value']));
    expect(new Set(domains.operand1)).toEqual(new Set(['', undefined, 'value']));
    const unused = commandDomains({ options: {}, rules: [] }, keys);
    expect(unused.operand0).toEqual([undefined, 'value']);
    expect(unused.operand1).toBeUndefined();
  });
  it('propagates defaults and literals across transitive equalities to a fixed point', () => {
    const links = [
      { kind: 'forbid', when: [{ key: 'b', test: 'equalsKey', valueKey: 'c' }] },
      { kind: 'forbid', when: [{ key: 'a', test: 'equalsKey', valueKey: 'b' }] },
    ];
    const literal = { kind: 'forbid', when: [{ key: 'a', test: 'equals', value: 'reserved' }] };
    const initial = { a: 'first', b: 'second', c: 'third' };
    const keys = rule => rule.when.flatMap(p => p.valueKey ? [p.key, p.valueKey] : [p.key]);
    for (const rules of [[...links, literal], [literal, ...links.toReversed()]]) {
      const domains = commandDomains({ initial, options: {}, rules }, keys);
      for (const key of ['a', 'b', 'c']) {
        expect(new Set(domains[key])).toEqual(new Set([undefined, 'first', 'second', 'third', 'reserved']));
      }
      expect(commandDomains({ initial, options: {}, rules }, keys)).toEqual(domains);
    }
  });
});


it('keeps an invalid element witness even when placeholder words are allowed', () => {
  for (const allowed of [['value', 'invalid'], [], ['value', 'invalid', 'invalid-', 'invalid--']]) {
    const rule = { id: 'elements-witness', kind: 'elements', key: 'actions', allowed,
      origin: 'git', reason: 'Independent representative test', source: 'fixture' };
    const domains = commandDomains({ options: {}, rules: [rule] }, r => [r.key]);
    const rejected = domains.actions.filter(items => Array.isArray(items)
      && items.some(item => !allowed.includes(item)));
    expect(rejected.length).toBeGreaterThan(0);
    for (const member of allowed) {
      expect(rejected.some(items => items.includes(member))).toBe(true);
    }
    const result = solve([rule], { actions: domains.actions });
    const witness = result.counterexamples[rule.id];
    expect(witness).toBeDefined();
    expect(violations([rule], witness).map(r => r.id)).toEqual([rule.id]);
  }
});

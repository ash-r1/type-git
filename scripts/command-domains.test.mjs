import { describe, expect, it } from 'vitest';
import { commandDomains } from './command-domains.mjs';

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

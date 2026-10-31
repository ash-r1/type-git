import { describe, expect, it } from 'vitest';
import { TIMESTAMP_DEFAULT } from './git-timestamp.js';
import { type Constraint, matches, violations } from './model.js';

const predicate = { key: 'age', test: 'timestampNotDefault' } as const;
const rule: Constraint = {
  id: 'timestamp',
  kind: 'forbid',
  when: [predicate],
  origin: 'git',
  reason: 'Final timestamp filter',
  source: 'fixture',
};

describe('normalized timestamp predicate', () => {
  it('checks the exact uintmax sentinel without rounding or conflating numeric states', () => {
    expect(matches(predicate, { age: TIMESTAMP_DEFAULT })).toBe(false);
    for (const age of [0, 1, TIMESTAMP_DEFAULT - 1n]) {
      expect(matches(predicate, { age })).toBe(true);
      expect(violations([rule], { age })).toEqual([rule]);
    }
  });
  it('defers undefined and native-owned approxidate text instead of inventing a date parser', () => {
    for (const age of [undefined, 'yesterday', '1970-01-01 00:00:01 +0000']) {
      expect(matches(predicate, { age })).toBe(false);
      expect(violations([rule], { age })).toEqual([]);
    }
  });
});

import type { Constrained } from '../../src/constraints/types.js';
type Range<V> = Constrained<{ value: V }, readonly [{
  id: 'fixture.range'; kind: 'range'; key: 'value'; min: 0; max: 8191;
  origin: 'git'; reason: 'Known native range'; source: 'fixture';
}]>;
const boundary: Range<8191> = { value: 8191 };
// @ts-expect-error The upper bound excludes an overflowing literal.
const overflow: Range<8192> = { value: 8192 };
// @ts-expect-error Every numeric literal alternative must satisfy the upper bound.
const maybeOverflow: Range<8191 | 8192> = { value: 8192 };
declare const dynamicNumber: number;
const dynamic: Range<number> = { value: dynamicNumber };
void [boundary, overflow, maybeOverflow, dynamic];

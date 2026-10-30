import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

const bits = { longBits: 64, sizeTBits: 64, lsTreeModes: 'bits' } as const;
const cmdmode = { ...bits, lsTreeModes: 'cmdmode' } as const;
describe('ls-tree mode families without help', () => {
  it('accepts a legacy combination with a required tree', () => {
    expect(
      commandArguments('ls-tree', [['--long'], ['--name-only'], { operand: 'HEAD' }], true, bits),
    ).toEqual(['ls-tree', '--long', '--name-only', 'HEAD']);
  });
  it('retains modern reached mode conflicts', () => {
    expect(() =>
      commandArguments(
        'ls-tree',
        [['--long'], ['--name-only'], { operand: 'HEAD' }],
        true,
        cmdmode,
      ),
    ).toThrow('incompatible command mode');
  });
  it('retains final tree and reached abbreviation checks', () => {
    expect(() => commandArguments('ls-tree', [['--long'], ['--name-only']], true, bits)).toThrow();
    expect(() =>
      commandArguments(
        'ls-tree',
        [['--long'], ['--name-only'], ['--abbrev', 'bad'], { operand: 'HEAD' }],
        true,
        bits,
      ),
    ).toThrow('invalid integer');
  });
  it('rejects newer-only options under the observed legacy family', () => {
    expect(() =>
      commandArguments('ls-tree', [['--long'], ['--object-only'], { operand: 'HEAD' }], true, bits),
    ).toThrow('unavailable');
  });
});

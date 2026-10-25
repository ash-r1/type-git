import { describe, expect, it } from 'vitest';
import { commandArguments, commandUsesLsTreeModes } from './build.js';
const bits = { longBits: 64, sizeTBits: 64, lsTreeModes: 'bits' } as const;
const cmdmode = { ...bits, lsTreeModes: 'cmdmode' } as const;
describe('ls-tree selected mode callbacks before help', () => {
  it('accepts reached old bit combinations before help', () => {
    expect(commandArguments('ls-tree', [['--long'], ['--name-only'], ['-h']], true, bits)).toEqual([
      'ls-tree',
      '--long',
      '--name-only',
      '-h',
    ]);
  });
  it('retains modern reached mode conflicts', () => {
    expect(() =>
      commandArguments('ls-tree', [['--long'], ['--name-only'], ['-h']], true, cmdmode),
    ).toThrow('incompatible command mode');
  });
  it('retains an ordinary valid non-help command with an explicit bits context', () => {
    expect(commandArguments('ls-tree', [['--long'], { operand: 'HEAD' }], true, bits)).toEqual([
      'ls-tree',
      '--long',
      'HEAD',
    ]);
  });
  it('does not borrow legacy relaxation without help', () => {
    expect(() =>
      commandArguments('ls-tree', [['--long'], ['--name-only'], { operand: 'HEAD' }], true, bits),
    ).toThrow();
  });
  it('does not mix old modes with newer-only options before help', () => {
    expect(() =>
      commandArguments('ls-tree', [['--long'], ['--object-only'], ['-h']], true, bits),
    ).toThrow();
  });
  it('retains newer-only format rejection in the legacy help profile', () => {
    const args = [['--long'], ['--format', '%(path)'], ['-h']];
    expect(() => commandArguments('ls-tree', args, true, bits)).toThrow('unavailable');
    expect(commandArguments('ls-tree', args, true, cmdmode)).toEqual([
      'ls-tree',
      '--long',
      '--format=%(path)',
      '-h',
    ]);
  });
  it('profiles only a reached mode followed by a real help exit', () => {
    expect(commandUsesLsTreeModes('ls-tree', [['--long'], ['-h']])).toBe(true);
    for (const args of [
      [['--help'], ['--long']],
      [['-h'], ['--long']],
      [['--long'], ['--']],
      [['--long'], ['--format', '-h']],
      [['--long'], { operand: '-h' }],
      [['--'], ['--long'], ['-h']],
    ]) {
      expect(commandUsesLsTreeModes('ls-tree', args)).toBe(false);
    }
  });
});

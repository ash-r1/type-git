import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

const UNRECOGNIZED = /Unrecognized (revision|diff) option/;

describe('revision parser pass at --end-of-options', () => {
  it('still rejects unknown words deferred before the end of options', () => {
    for (const first of ['--bogus', '-Q']) {
      expect(() =>
        commandArguments('log', [
          { operand: first },
          { operand: '--end-of-options' },
          { operand: 'HEAD' },
        ]),
      ).toThrow(UNRECOGNIZED);
    }
  });

  it('refuses a literal end-of-options marker but keeps words after an honored separator', () => {
    // Operand objects that Git would read as a boundary marker are refused (#298); the
    // explicit `--` separator keeps later dash words literal.
    expect(() =>
      commandArguments('log', [{ operand: '--end-of-options' }, { operand: '--bogus' }]),
    ).toThrow(/explicit \["--"\] separator/);
    expect(commandArguments('log', [['--'], { operand: '--bogus' }])).toEqual([
      'log',
      '--',
      '--bogus',
    ]);
  });
});

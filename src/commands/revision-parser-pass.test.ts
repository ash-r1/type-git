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

  it('treats dash words after the end of options as operands', () => {
    expect(
      commandArguments('log', [{ operand: '--end-of-options' }, { operand: '--bogus' }]),
    ).toEqual(['log', '--end-of-options', '--bogus']);
  });
});

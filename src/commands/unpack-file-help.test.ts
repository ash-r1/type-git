import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('unpack-file sole help words', () => {
  it('accepts sole help before final blob arity', () => {
    for (const flag of ['-h', '--help-all']) {
      expect(commandArguments('unpack-file', [[flag]])).toEqual(['unpack-file', flag]);
    }
  });
  it('preserves final arity for multiword calls and tagged objects', () => {
    expect(commandArguments('unpack-file', [{ operand: 'missing-blob' }])).toEqual([
      'unpack-file',
      'missing-blob',
    ]);
    expect(commandArguments('unpack-file', [['--help-all'], { operand: 'missing-blob' }])).toEqual([
      'unpack-file',
      '--help-all',
      'missing-blob',
    ]);
    expect(() => commandArguments('unpack-file', [])).toThrow();
    expect(() =>
      commandArguments('unpack-file', [['--help-all'], { operand: 'one' }, { operand: 'two' }]),
    ).toThrow();
  });
  it('retains parser and representation guards', () => {
    expect(commandArguments('unpack-file', [{ operand: '--' }])).toEqual(['unpack-file', '--']);
    expect(() => commandArguments('unpack-file', [['--']])).toThrow();
    expect(() => commandArguments('unpack-file', [['--git-completion-helper']])).toThrow();
    expect(() => commandArguments('unpack-file', [['-h', true]])).toThrow();
    expect(() => commandArguments('unpack-file', [['-h'], { operand: '\0' }])).toThrow('NUL');
  });
});

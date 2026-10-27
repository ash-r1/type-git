import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('unpack-objects sole full usage', () => {
  it('exits before ordinary argument validation constraints', () => {
    expect(commandArguments('unpack-objects', [['--help-all']])).toEqual([
      'unpack-objects',
      '--help-all',
    ]);
  });
  it('retains the sole-word, representation, and ordinary arity boundaries', () => {
    for (const args of [
      [['--help-all'], { operand: 'ignored' }],
      [['-n'], ['--help-all']],
      [['--strict'], ['--help-all']],
      [['--help-all', true]],
      [{ operand: '--help-all' }],
      [{ operand: 'ordinary' }],
    ]) {
      expect(() => commandArguments('unpack-objects', args)).toThrow();
    }
    expect(() => commandArguments('unpack-objects', [['--help-all'], { operand: '\0' }])).toThrow(
      'NUL',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('pack-redundant sole full usage', () => {
  it('exits before pinned opt-in and pack arity constraints', () => {
    expect(commandArguments('pack-redundant', [['--help-all']])).toEqual([
      'pack-redundant',
      '--help-all',
    ]);
  });
  it('retains the sole-word, representation, and ordinary arity boundaries', () => {
    for (const args of [
      [['--help-all'], { operand: 'ignored' }],
      [['--all'], ['--help-all']],
      [['--i-still-use-this'], ['--help-all']],
      [['--help-all', true]],
      [{ operand: '--help-all' }],
      [],
      [['--i-still-use-this']],
    ]) {
      expect(() => commandArguments('pack-redundant', args)).toThrow();
    }
    expect(() => commandArguments('pack-redundant', [['--help-all'], { operand: '\0' }])).toThrow(
      'NUL',
    );
  });
});

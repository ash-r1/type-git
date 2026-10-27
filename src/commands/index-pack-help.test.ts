import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('index-pack sole full usage', () => {
  it('exits before pack-input arity constraints', () => {
    expect(commandArguments('index-pack', [['--help-all']])).toEqual(['index-pack', '--help-all']);
  });
  it('retains the sole-word, representation, and ordinary arity boundaries', () => {
    for (const args of [
      [['--help-all'], { operand: 'ignored' }],
      [['--verify'], ['--help-all']],
      [['--strict'], ['--help-all']],
      [['--help-all', true]],
      [{ operand: '--help-all' }],
      [],
      [['--strict']],
    ]) {
      expect(() => commandArguments('index-pack', args)).toThrow();
    }
    expect(() => commandArguments('index-pack', [['--help-all'], { operand: '\0' }])).toThrow(
      'NUL',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('check-ref-format sole full usage', () => {
  it('exits before refname arity constraints', () => {
    expect(commandArguments('check-ref-format', [['--help-all']])).toEqual([
      'check-ref-format',
      '--help-all',
    ]);
  });
  it('retains the sole-word, representation, and ordinary arity boundaries', () => {
    for (const args of [
      [['--help-all'], { operand: 'ignored' }],
      [['--normalize'], ['--help-all']],
      [['--branch'], ['--help-all']],
      [['--help-all', true]],
      [{ operand: '--help-all' }],
      [],
      [['--branch']],
    ]) {
      expect(() => commandArguments('check-ref-format', args)).toThrow();
    }
    expect(() => commandArguments('check-ref-format', [['--help-all'], { operand: '\0' }])).toThrow(
      'NUL',
    );
  });
});

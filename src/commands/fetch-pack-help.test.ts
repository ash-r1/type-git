import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('fetch-pack sole full usage', () => {
  it('exits before destination arity constraints', () => {
    expect(commandArguments('fetch-pack', [['--help-all']])).toEqual(['fetch-pack', '--help-all']);
  });
  it('retains the sole-word, representation, and ordinary arity boundaries', () => {
    for (const args of [
      [['--help-all'], { operand: 'ignored' }],
      [['--quiet'], ['--help-all']],
      [['--diag-url'], ['--help-all']],
      [['--help-all', true]],
      [{ operand: '--help-all' }],
      [],
      [['--diag-url']],
    ]) {
      expect(() => commandArguments('fetch-pack', args)).toThrow();
    }
    expect(() => commandArguments('fetch-pack', [['--help-all'], { operand: '\0' }])).toThrow(
      'NUL',
    );
  });
});

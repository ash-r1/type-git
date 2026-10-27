import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('mailsplit sole full usage', () => {
  it('exits before output-directory arity constraints', () => {
    expect(commandArguments('mailsplit', [['--help-all']])).toEqual(['mailsplit', '--help-all']);
  });
  it('retains the sole-word, representation, and ordinary arity boundaries', () => {
    for (const args of [
      [['--help-all'], { operand: 'ignored' }],
      [['-b'], ['--help-all']],
      [['--keep-cr'], ['--help-all']],
      [['--help-all', true]],
      [{ operand: '--help-all' }],
      [],
      [['--keep-cr']],
    ]) {
      expect(() => commandArguments('mailsplit', args)).toThrow();
    }
    expect(() => commandArguments('mailsplit', [['--help-all'], { operand: '\0' }])).toThrow('NUL');
  });
});

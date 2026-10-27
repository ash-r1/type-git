import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('diff-index sole full usage', () => {
  it('accepts canonical sole full help and retains ordinary diff arguments', () => {
    expect(commandArguments('diff-index', [['--help-all']])).toEqual(['diff-index', '--help-all']);
    expect(commandArguments('diff-index', [['--name-only'], { operand: 'HEAD' }])).toEqual([
      'diff-index',
      '--name-only',
      'HEAD',
    ]);
  });
  it('retains sole-word, callback, representation, and NUL boundaries', () => {
    for (const args of [
      [['--help-all'], { operand: 'HEAD' }],
      [['--name-only'], ['--help-all']],
      [['--help-all'], ['--diff-algorithm', 'invalid']],
      [['--diff-algorithm', 'invalid'], ['--help-all']],
      [['--help-all', true]],
      [{ operand: '--help-all' }],
      [['--max-count', 4]],
    ]) {
      expect(() => commandArguments('diff-index', args)).toThrow();
    }
    expect(() => commandArguments('diff-index', [['--help-all'], { operand: '\0' }])).toThrow(
      'NUL',
    );
  });
});

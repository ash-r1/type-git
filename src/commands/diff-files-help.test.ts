import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('diff-files sole full usage', () => {
  it('accepts canonical sole full help and retains ordinary diff arguments', () => {
    expect(commandArguments('diff-files', [['--help-all']])).toEqual(['diff-files', '--help-all']);
    expect(commandArguments('diff-files', [['--name-only'], { operand: 'file' }])).toEqual([
      'diff-files',
      '--name-only',
      'file',
    ]);
  });
  it('retains sole-word, callback, representation, and NUL boundaries', () => {
    for (const args of [
      [['--help-all'], { operand: 'file' }],
      [['--name-only'], ['--help-all']],
      [['--help-all'], ['--diff-algorithm', 'invalid']],
      [['--diff-algorithm', 'invalid'], ['--help-all']],
      [['--help-all', true]],
      [{ operand: '--help-all' }],
      [['--max-count', 4]],
    ]) {
      expect(() => commandArguments('diff-files', args)).toThrow();
    }
    expect(() => commandArguments('diff-files', [['--help-all'], { operand: '\0' }])).toThrow(
      'NUL',
    );
  });
});

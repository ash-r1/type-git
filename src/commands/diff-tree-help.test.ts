import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('diff-tree sole full usage', () => {
  it('accepts canonical sole full help and retains ordinary diff arguments', () => {
    expect(commandArguments('diff-tree', [['--help-all']])).toEqual(['diff-tree', '--help-all']);
    expect(commandArguments('diff-tree', [['--name-only'], { operand: 'HEAD' }])).toEqual([
      'diff-tree',
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
      [['--merge-base'], ['--stdin']],
    ]) {
      expect(() => commandArguments('diff-tree', args)).toThrow();
    }
    expect(() => commandArguments('diff-tree', [['--help-all'], { operand: '\0' }])).toThrow('NUL');
  });
});

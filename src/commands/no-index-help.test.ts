import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('diff --no-index canonical sole full usage', () => {
  it('accepts sole full usage and preserves ordinary two-path comparison', () => {
    expect(commandArguments('diff --no-index', [['--help-all']])).toEqual([
      'diff',
      '--no-index',
      '--help-all',
    ]);
    expect(
      commandArguments('diff --no-index', [{ operand: 'left' }, { operand: 'right' }]),
    ).toEqual(['diff', '--no-index', 'left', 'right']);
  });
  it('retains path arity, callback, representation and NUL boundaries', () => {
    for (const args of [
      [],
      [{ operand: 'left' }],
      [['--help-all'], { operand: 'left' }],
      [['--name-only'], ['--help-all']],
      [['--help-all', true]],
      [{ operand: '--help-all' }],
      [['--word-diff', 'invalid'], ['--help-all']],
    ]) {
      expect(() => commandArguments('diff --no-index', args)).toThrow();
    }
    expect(() => commandArguments('diff --no-index', [['--help-all'], { operand: '\0' }])).toThrow(
      'NUL',
    );
  });
});

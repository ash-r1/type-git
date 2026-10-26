import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('merge-index sole help words', () => {
  it('accepts canonical and tagged sole usage words', () => {
    for (const flag of ['-h', '--help-all']) {
      expect(commandArguments('merge-index', [[flag]])).toEqual(['merge-index', flag]);
      expect(commandArguments('merge-index', [{ operand: flag }])).toEqual(['merge-index', flag]);
    }
  });
  it('preserves ordinary arity and tagged program words', () => {
    expect(() => commandArguments('merge-index', [])).toThrow();
    expect(() => commandArguments('merge-index', [{ operand: 'program' }])).toThrow();
    for (const flag of ['-o', '-q', '-a', '--']) {
      expect(() => commandArguments('merge-index', [[flag]])).toThrow();
    }
    expect(commandArguments('merge-index', [{ operand: 'program' }, ['-a']])).toEqual([
      'merge-index',
      'program',
      '-a',
    ]);
    expect(commandArguments('merge-index', [{ operand: '-h' }, { operand: 'file' }])).toEqual([
      'merge-index',
      '-h',
      'file',
    ]);
    for (const flag of ['-h', '--help-all']) {
      expect(() => commandArguments('merge-index', [[flag], { operand: 'file' }])).toThrow();
    }
  });
  it('retains flag shapes, completion and NUL guards', () => {
    expect(() => commandArguments('merge-index', [['--git-completion-helper']])).toThrow();
    expect(() => commandArguments('merge-index', [['-h', true]])).toThrow();
    expect(() => commandArguments('merge-index', [['-h'], { operand: '\0' }])).toThrow('NUL');
  });
});

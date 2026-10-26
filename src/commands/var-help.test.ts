import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('var sole usage words', () => {
  it('accepts canonical and tagged sole usage words', () => {
    for (const flag of ['-h', '--help-all']) {
      expect(commandArguments('var', [[flag]])).toEqual(['var', flag]);
      expect(commandArguments('var', [{ operand: flag }])).toEqual(['var', flag]);
    }
  });
  it('retains listing and variable queries', () => {
    expect(commandArguments('var', [['-l']])).toEqual(['var', '-l']);
    expect(commandArguments('var', [{ operand: 'GIT_EDITOR' }])).toEqual(['var', 'GIT_EDITOR']);
  });
  it('rejects missing, unknown and extra words', () => {
    for (const args of [
      [],
      [{ operand: 'ordinary' }],
      [['-l'], { operand: 'GIT_EDITOR' }],
      [{ operand: 'GIT_EDITOR' }, ['--help']],
    ]) {
      expect(() => commandArguments('var', args)).toThrow();
    }
    for (const flag of ['-h', '--help-all']) {
      expect(() => commandArguments('var', [[flag], { operand: 'GIT_EDITOR' }])).toThrow();
      expect(() =>
        commandArguments('var', [{ operand: flag }, { operand: 'GIT_EDITOR' }]),
      ).toThrow();
    }
  });
  it('retains documentation and structural boundaries', () => {
    expect(commandArguments('var', [['--help'], ['--man']])).toEqual(['var', '--help', '--man']);
    expect(() => commandArguments('var', [['--']])).toThrow();
    expect(() => commandArguments('var', [['--git-completion-helper']])).toThrow();
    expect(() => commandArguments('var', [['-h', true]])).toThrow();
    expect(() => commandArguments('var', [['-h'], { operand: '\0' }])).toThrow('NUL');
  });
});

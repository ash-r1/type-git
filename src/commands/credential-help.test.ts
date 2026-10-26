import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('credential sole usage words', () => {
  it('accepts canonical and tagged sole usage words', () => {
    for (const flag of ['-h', '--help-all']) {
      expect(commandArguments('credential', [[flag]])).toEqual(['credential', flag]);
      expect(commandArguments('credential', [{ operand: flag }])).toEqual(['credential', flag]);
    }
  });
  it('retains ordinary helperless operation shapes', () => {
    expect(commandArguments('credential', [{ operand: 'reject' }])).toEqual([
      'credential',
      'reject',
    ]);
    expect(commandArguments('credential', [{ operand: 'approve' }])).toEqual([
      'credential',
      'approve',
    ]);
  });
  it('rejects missing, unknown and extra words', () => {
    for (const args of [
      [],
      [{ operand: 'ordinary' }],
      [['-l'], { operand: 'approve' }],
      [{ operand: 'approve' }, ['--help']],
    ]) {
      expect(() => commandArguments('credential', args)).toThrow();
    }
    for (const flag of ['-h', '--help-all']) {
      expect(() => commandArguments('credential', [[flag], { operand: 'approve' }])).toThrow();
      expect(() =>
        commandArguments('credential', [{ operand: flag }, { operand: 'approve' }]),
      ).toThrow();
    }
  });
  it('retains documentation and structural boundaries', () => {
    expect(commandArguments('credential', [['--help'], ['--man']])).toEqual([
      'credential',
      '--help',
      '--man',
    ]);
    expect(() => commandArguments('credential', [['--']])).toThrow();
    expect(() => commandArguments('credential', [['--git-completion-helper']])).toThrow();
    expect(() => commandArguments('credential', [['-h', true]])).toThrow();
    expect(() => commandArguments('credential', [['-h'], { operand: '\0' }])).toThrow('NUL');
  });
});

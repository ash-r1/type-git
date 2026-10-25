import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('cherry ordered internal help', () => {
  it('serializes full help and sole completion words', () => {
    for (const flag of ['--help-all', '--git-completion-helper', '--git-completion-helper-all']) {
      expect(commandArguments('cherry', [[flag]])).toEqual(['cherry', flag]);
    }
    expect(commandArguments('cherry', [['--verbose'], ['--help']])).toEqual([
      'cherry',
      '--verbose',
      '--help',
    ]);
  });
  it('preserves abbreviation callback order', () => {
    expect(() => commandArguments('cherry', [['--abbrev', 'bad'], ['--help-all']])).toThrow();
    expect(commandArguments('cherry', [['--help-all'], ['--abbrev', 'bad']])).toEqual([
      'cherry',
      '--help-all',
      '--abbrev=bad',
    ]);
    expect(commandArguments('cherry', [['--abbrev', '-1'], ['--help-all']])).toEqual([
      'cherry',
      '--abbrev=-1',
      '--help-all',
    ]);
    expect(() => commandArguments('cherry', [['--abbrev', '--help-all']])).toThrow();
  });
  it('checks completion position and end-of-options representation', () => {
    expect(() =>
      commandArguments('cherry', [['--git-completion-helper'], ['--help-all']]),
    ).toThrow();
    expect(commandArguments('cherry', [['--help-all'], ['--git-completion-helper']])).toEqual([
      'cherry',
      '--help-all',
      '--git-completion-helper',
    ]);
    expect(commandArguments('cherry', [['--'], { operand: '--help-all' }])).toEqual([
      'cherry',
      '--',
      '--help-all',
    ]);
    expect(() => commandArguments('cherry', [['--'], ['--help-all']])).toThrow();
  });
  it('retains shape and NUL guards after help', () => {
    expect(() => commandArguments('cherry', [['--help-all'], ['--verbose', true]])).toThrow();
    expect(() => commandArguments('cherry', [['--help-all'], { operand: '\0' }])).toThrow('NUL');
  });
});

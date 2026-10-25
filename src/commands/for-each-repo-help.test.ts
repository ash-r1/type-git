import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('for-each-repo ordered internal help', () => {
  it('accepts full help and sole completion words', () => {
    for (const flag of ['--help-all', '--git-completion-helper', '--git-completion-helper-all']) {
      expect(commandArguments('for-each-repo', [[flag]])).toEqual(['for-each-repo', flag]);
    }
    expect(commandArguments('for-each-repo', [['--keep-going'], ['--help']])).toEqual([
      'for-each-repo',
      '--keep-going',
      '--help',
    ]);
  });
  it('keeps config values distinct from actual help', () => {
    expect(commandArguments('for-each-repo', [['--config', '--help-all']])).toEqual([
      'for-each-repo',
      '--config=--help-all',
    ]);
    expect(commandArguments('for-each-repo', [['--config', '--help-all'], ['--help-all']])).toEqual(
      ['for-each-repo', '--config=--help-all', '--help-all'],
    );
  });
  it('preserves stop-at-operand and completion boundaries', () => {
    expect(
      commandArguments('for-each-repo', [
        ['--config', 'typegit.missing'],
        { operand: 'unused' },
        { operand: '--help-all' },
      ]),
    ).toEqual(['for-each-repo', '--config=typegit.missing', 'unused', '--help-all']);
    expect(() =>
      commandArguments('for-each-repo', [
        ['--config', 'typegit.missing'],
        { operand: 'unused' },
        ['--help-all'],
      ]),
    ).toThrow('first operand');
    expect(() =>
      commandArguments('for-each-repo', [['--git-completion-helper'], ['--help-all']]),
    ).toThrow();
    expect(
      commandArguments('for-each-repo', [['--help-all'], ['--git-completion-helper']]),
    ).toEqual(['for-each-repo', '--help-all', '--git-completion-helper']);
  });
  it('retains end-marker, shape and NUL guards', () => {
    expect(() =>
      commandArguments('for-each-repo', [['--config', 'typegit.missing'], ['--'], ['--help-all']]),
    ).toThrow();
    expect(() =>
      commandArguments('for-each-repo', [['--help-all'], ['--keep-going', true]]),
    ).toThrow();
    expect(() => commandArguments('for-each-repo', [['--help-all'], { operand: '\0' }])).toThrow(
      'NUL',
    );
  });
});

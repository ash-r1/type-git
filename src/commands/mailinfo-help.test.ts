import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('mailinfo ordered internal help', () => {
  it('accepts full help and sole completion without output paths', () => {
    for (const flag of ['--help-all', '--git-completion-helper', '--git-completion-helper-all']) {
      expect(commandArguments('mailinfo', [[flag]])).toEqual(['mailinfo', flag]);
    }
    expect(commandArguments('mailinfo', [['--message-id'], ['--help']])).toEqual([
      'mailinfo',
      '--message-id',
      '--help',
    ]);
  });
  it('preserves quoted-CR callback order and allowed values', () => {
    expect(() =>
      commandArguments('mailinfo', [['--quoted-cr', 'invalid-action'], ['--help-all']]),
    ).toThrow();
    expect(
      commandArguments('mailinfo', [['--help-all'], ['--quoted-cr', 'invalid-action']]),
    ).toEqual(['mailinfo', '--help-all', '--quoted-cr=invalid-action']);
    for (const value of ['nowarn', 'warn', 'strip']) {
      expect(commandArguments('mailinfo', [['--quoted-cr', value], ['--help-all']])).toEqual([
        'mailinfo',
        `--quoted-cr=${value}`,
        '--help-all',
      ]);
    }
  });
  it('keeps required encoding values and completion order distinct from exits', () => {
    expect(() => commandArguments('mailinfo', [['--encoding', '--help-all']])).toThrow();
    expect(commandArguments('mailinfo', [['--encoding', '--help-all'], ['--help-all']])).toEqual([
      'mailinfo',
      '--encoding=--help-all',
      '--help-all',
    ]);
    expect(() =>
      commandArguments('mailinfo', [['--git-completion-helper'], ['--help-all']]),
    ).toThrow();
    expect(commandArguments('mailinfo', [['--help-all'], ['--git-completion-helper']])).toEqual([
      'mailinfo',
      '--help-all',
      '--git-completion-helper',
    ]);
  });
  it('retains end-marker, shape and NUL guards', () => {
    expect(() => commandArguments('mailinfo', [['--'], { operand: '--help-all' }])).toThrow();
    expect(() => commandArguments('mailinfo', [['--'], ['--help-all']])).toThrow();
    expect(() => commandArguments('mailinfo', [['--help-all'], ['--message-id', true]])).toThrow();
    expect(() => commandArguments('mailinfo', [['--help-all'], { operand: '\0' }])).toThrow('NUL');
  });
});

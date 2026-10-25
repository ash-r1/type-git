import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('ls-files internal help boundaries', () => {
  it('accepts full help and sole completion words', () => {
    for (const flag of ['--help-all', '--git-completion-helper', '--git-completion-helper-all']) {
      expect(commandArguments('ls-files', [[flag]])).toEqual(['ls-files', flag]);
    }
  });
  it('skips a later numeric callback but retains an earlier callback', () => {
    expect(commandArguments('ls-files', [['-h'], ['--abbrev', 'bad']])).toEqual([
      'ls-files',
      '-h',
      '--abbrev=bad',
    ]);
    expect(() => commandArguments('ls-files', [['--abbrev', 'bad'], ['-h']])).toThrow();
  });
  it('requires sole completion unless an earlier help exits', () => {
    expect(() =>
      commandArguments('ls-files', [['--git-completion-helper'], ['--help-all']]),
    ).toThrow();
    expect(commandArguments('ls-files', [['--help-all'], ['--git-completion-helper']])).toEqual([
      'ls-files',
      '--help-all',
      '--git-completion-helper',
    ]);
  });
  it('does not treat consumed values or tagged operands as help', () => {
    expect(() =>
      commandArguments('ls-files', [
        ['--exclude', '-h'],
        ['--abbrev', 'bad'],
      ]),
    ).toThrow();
    expect(() =>
      commandArguments('ls-files', [{ operand: '-h' }, ['--git-completion-helper']]),
    ).toThrow();
    expect(commandArguments('ls-files', [['--'], { operand: '-h' }])).toEqual([
      'ls-files',
      '--',
      '-h',
    ]);
  });
  it('retains shape and NUL guards after help', () => {
    expect(() => commandArguments('ls-files', [['-h'], ['--cached', true]])).toThrow();
    expect(() => commandArguments('ls-files', [['-h'], ['--exclude', '\0']])).toThrow('NUL');
  });
});

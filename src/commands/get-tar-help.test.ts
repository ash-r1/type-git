import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('get-tar-commit-id sole usage words', () => {
  it('retains zero-argument input and accepts sole canonical/tagged usage words', () => {
    expect(commandArguments('get-tar-commit-id', [])).toEqual(['get-tar-commit-id']);
    for (const flag of ['-h', '--help-all']) {
      expect(commandArguments('get-tar-commit-id', [[flag]])).toEqual(['get-tar-commit-id', flag]);
      expect(commandArguments('get-tar-commit-id', [{ operand: flag }])).toEqual([
        'get-tar-commit-id',
        flag,
      ]);
    }
  });
  it('rejects ordinary operands and multiword usage shapes', () => {
    expect(() => commandArguments('get-tar-commit-id', [{ operand: 'ordinary' }])).toThrow();
    for (const flag of ['-h', '--help-all']) {
      expect(() =>
        commandArguments('get-tar-commit-id', [[flag], { operand: 'ignored' }]),
      ).toThrow();
      expect(() =>
        commandArguments('get-tar-commit-id', [{ operand: flag }, { operand: 'ignored' }]),
      ).toThrow();
    }
  });
  it('rejects later documentation help instead of bypassing final constraints', () => {
    expect(() =>
      commandArguments('get-tar-commit-id', [{ operand: 'ordinary' }, ['--help']]),
    ).toThrow();
  });
  it('retains documentation, shape and NUL boundaries', () => {
    expect(commandArguments('get-tar-commit-id', [['--help'], ['--man']])).toEqual([
      'get-tar-commit-id',
      '--help',
      '--man',
    ]);
    expect(() => commandArguments('get-tar-commit-id', [['--']])).toThrow();
    expect(() => commandArguments('get-tar-commit-id', [['--git-completion-helper']])).toThrow();
    expect(() => commandArguments('get-tar-commit-id', [['-h', true]])).toThrow();
    expect(() => commandArguments('get-tar-commit-id', [['-h'], { operand: '\0' }])).toThrow('NUL');
  });
});

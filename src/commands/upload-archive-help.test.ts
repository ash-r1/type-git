import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('archive frontend sole usage words', () => {
  it('preserves sole usage and ordinary repository words', () => {
    for (const flag of ['-h', '--help-all']) {
      expect(commandArguments('upload-archive', [[flag]])).toEqual(['upload-archive', flag]);
      expect(commandArguments('upload-archive', [{ operand: flag }])).toEqual([
        'upload-archive',
        flag,
      ]);
    }
    expect(commandArguments('upload-archive', [{ operand: '/fixture/repo' }])).toEqual([
      'upload-archive',
      '/fixture/repo',
    ]);
  });
  it('rejects missing and extra words', () => {
    for (const args of [
      [],
      [['-h'], { operand: '/fixture/repo' }],
      [['--help-all'], { operand: '/fixture/repo' }],
      [{ operand: '-h' }, { operand: '/fixture/repo' }],
      [{ operand: '/fixture/repo' }, ['--help']],
    ]) {
      expect(() => commandArguments('upload-archive', args)).toThrow();
    }
  });
  it('retains documentation, shape and NUL boundaries', () => {
    expect(commandArguments('upload-archive', [['--help'], ['--man']])).toEqual([
      'upload-archive',
      '--help',
      '--man',
    ]);
    expect(() => commandArguments('upload-archive', [['--']])).toThrow();
    expect(() => commandArguments('upload-archive', [['--git-completion-helper']])).toThrow();
    expect(() => commandArguments('upload-archive', [['-h', true]])).toThrow();
    expect(() => commandArguments('upload-archive', [['-h'], { operand: '\0' }])).toThrow('NUL');
  });
});

import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('archive writer sole usage words', () => {
  it('preserves sole usage and ordinary repository words', () => {
    for (const flag of ['-h', '--help-all']) {
      expect(commandArguments('upload-archive--writer', [[flag]])).toEqual([
        'upload-archive--writer',
        flag,
      ]);
      expect(commandArguments('upload-archive--writer', [{ operand: flag }])).toEqual([
        'upload-archive--writer',
        flag,
      ]);
    }
    expect(commandArguments('upload-archive--writer', [{ operand: '/fixture/repo' }])).toEqual([
      'upload-archive--writer',
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
      expect(() => commandArguments('upload-archive--writer', args)).toThrow();
    }
  });
  it('retains documentation, shape and NUL boundaries', () => {
    expect(commandArguments('upload-archive--writer', [['--help'], ['--man']])).toEqual([
      'upload-archive--writer',
      '--help',
      '--man',
    ]);
    expect(() => commandArguments('upload-archive--writer', [['--']])).toThrow();
    expect(() =>
      commandArguments('upload-archive--writer', [['--git-completion-helper']]),
    ).toThrow();
    expect(() => commandArguments('upload-archive--writer', [['-h', true]])).toThrow();
    expect(() => commandArguments('upload-archive--writer', [['-h'], { operand: '\0' }])).toThrow(
      'NUL',
    );
  });
});

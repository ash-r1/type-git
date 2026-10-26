import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('merge-one-file first-word help', () => {
  it('accepts exact first raw -h in either representation and ignores later semantic words', () => {
    for (const first of [['-h'], { operand: '-h' }]) {
      expect(commandArguments('merge-one-file', [first])).toEqual(['merge-one-file', '-h']);
      expect(commandArguments('merge-one-file', [first, { operand: 'ignored' }, ['-h']])).toEqual([
        'merge-one-file',
        '-h',
        'ignored',
        '-h',
      ]);
    }
  });
  it('retains ordinary seven-operand arity and first-only canonical help', () => {
    expect(() => commandArguments('merge-one-file', [])).toThrow();
    expect(() => commandArguments('merge-one-file', [{ operand: 'ordinary' }])).toThrow();
    expect(() => commandArguments('merge-one-file', [{ operand: 'ordinary' }, ['-h']])).toThrow(
      'first',
    );
    const words = ['a', '-h', 'c', 'path', '100644', '120000', '100644'];
    expect(
      commandArguments(
        'merge-one-file',
        words.map((operand) => ({ operand })),
      ),
    ).toEqual(['merge-one-file', ...words]);
    expect(() =>
      commandArguments('merge-one-file', [{ operand: 'a' }, { operand: '-h' }]),
    ).toThrow();
    expect(() =>
      commandArguments('unpack-file', [{ operand: '-h' }, { operand: 'ignored' }]),
    ).toThrow();
  });
  it('keeps shape and NUL validation active in ignored tails', () => {
    expect(() => commandArguments('merge-one-file', [['-h', true]])).toThrow();
    expect(() => commandArguments('merge-one-file', [{ operand: '-h' }, ['-h', true]])).toThrow();
    expect(() =>
      commandArguments('merge-one-file', [{ operand: '-h' }, { operand: '\0' }]),
    ).toThrow('NUL');
    expect(() =>
      commandArguments('merge-one-file', [{ operand: '-h' }, ['--git-completion-helper']]),
    ).toThrow();
    expect(commandArguments('merge-one-file', [['--help'], ['--man']])).toEqual([
      'merge-one-file',
      '--help',
      '--man',
    ]);
  });
});

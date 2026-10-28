import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('diff --no-index native usage exits', () => {
  it('accepts native full usage and preserves ordinary two-path comparison', () => {
    expect(commandArguments('diff --no-index', [['--help-all']])).toEqual([
      'diff',
      '--no-index',
      '--help-all',
    ]);
    expect(
      commandArguments('diff --no-index', [{ operand: 'left' }, { operand: 'right' }]),
    ).toEqual(['diff', '--no-index', 'left', 'right']);
  });
  it('retains path arity, callback, representation and NUL boundaries', () => {
    for (const args of [
      [],
      [{ operand: 'left' }],
      [['--help-all', true]],
      [{ operand: '--help-all' }],
      [['--word-diff', 'invalid'], ['--help-all']],
    ]) {
      expect(() => commandArguments('diff --no-index', args)).toThrow();
    }
    expect(() => commandArguments('diff --no-index', [['--help-all'], { operand: '\0' }])).toThrow(
      'NUL',
    );
  });
});

it('preserves known prefixes and ignored unknown and invalid-value tails after native usage', () => {
  expect(
    commandArguments('diff --no-index', [
      ['--name-only'],
      ['--help-all'],
      ['--unknown-native-tail', 'kept'],
      ['--word-diff', 'invalid'],
    ]),
  ).toEqual([
    'diff',
    '--no-index',
    '--name-only',
    '--help-all',
    '--unknown-native-tail',
    'kept',
    '--word-diff=invalid',
  ]);
});

it('validates prefixes and representation guards even around a native usage exit', () => {
  for (const args of [
    [['--unknown-before'], ['--help-all']],
    [['--word-diff', 'invalid'], ['--help-all']],
    [['--help-all'], ['--quiet', 'invalid']],
    [['--help-all'], ['--unknown-tail', 42]],
    [['--help-all'], ['--unknown-tail', '\0']],
  ]) {
    expect(() => commandArguments('diff --no-index', args)).toThrow();
  }
  expect(() => commandArguments('diff-files', [['--help-all'], ['--unknown-tail']])).toThrow();
});

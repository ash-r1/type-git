import { describe, expect, it } from 'vitest';
import { parseGitScalar } from '../constraints/git-scalars.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import type { OptionSpec } from './spec.js';

describe('range-diff maximum memory callback', () => {
  it('preserves raw unknown words after reached help', () => {
    expect(commandArguments('range-diff', [['-h'], ['--type-git-unknown-tail']])).toContain(
      '--type-git-unknown-tail',
    );
    expect(
      commandArguments('range-diff', [
        ['--max-memory', '1k'],
        ['-h'],
        ['--type-git-unknown-tail', 'raw'],
      ]),
    ).toContain('--type-git-unknown-tail');
    expect(() => commandArguments('range-diff', [['--type-git-unknown-tail'], ['-h']])).toThrow();
  });
  it('uses unsigned configuration integers bounded by selected size_t', () => {
    const parser = COMMAND_SPECS['range-diff'].options['--max-memory'].parser;
    expect(parser).toMatchObject({
      kind: 'integer',
      signed: false,
      bits: 64,
      nativeWidth: 'size_t',
      negativeMagnitudes: false,
    });
    for (const value of [
      '0',
      '1',
      '+1',
      ' 1',
      '1k',
      '1K',
      '1g',
      '0x10',
      '010',
      '4294967296',
      '18446744073709551615',
      1,
      4294967296n,
    ]) {
      expect(
        commandArguments('range-diff', [['--max-memory', value], ['-h']], undefined, {
          longBits: 64,
          sizeTBits: 64,
        }),
      ).toContain(`--max-memory=${value}`);
    }
    expect(() =>
      commandArguments('range-diff', [['--max-memory', '4294967296'], ['-h']], undefined, {
        longBits: 32,
        sizeTBits: 32,
      }),
    ).toThrow();
    expect(
      commandArguments('range-diff', [['--max-memory', '4294967295'], ['-h']], undefined, {
        longBits: 32,
        sizeTBits: 32,
      }),
    ).toContain('--max-memory=4294967295');
    expect(parseGitScalar(parser, '4294967296', undefined, 64, 32).valid).toBe(false);
    expect(parseGitScalar(parser, '4294967295', undefined, 64, 32).valid).toBe(true);
    expect(parseGitScalar(parser, '18446744073709551615', undefined, 32, 64).valid).toBe(true);
  });
  it('honors ordered help and keeps negation a native no-op', () => {
    for (const value of [
      '',
      '-1',
      '08',
      '18446744073709551616',
      'bad',
      '1GB',
      '1.0',
      '1\n',
      '+',
      '١',
    ]) {
      for (const help of ['-h', '--help', '--help-all']) {
        expect(() => commandArguments('range-diff', [['--max-memory', value], [help]])).toThrow();
        if (help !== '--help') {
          expect(commandArguments('range-diff', [[help], ['--max-memory', value]])).toContain(help);
        }
      }
    }
    const unset = COMMAND_SPECS['range-diff'].options['--no-max-memory'] as OptionSpec;
    expect(unset.ignore).toBe(true);
    expect(unset.parser).toBeUndefined();
    const actual = commandArguments('range-diff', [
      ['--max-memory', '1k'],
      ['--no-max-memory'],
      ['-h'],
    ]);
    expect(actual).toContain('--max-memory=1k');
    expect(actual).toContain('--no-max-memory');
    expect(() =>
      commandArguments('range-diff', [['--max-memory', 'bad'], ['--no-max-memory'], ['-h']]),
    ).toThrow();
    expect(() =>
      commandArguments('range-diff', [['--max-memory', 'bad'], ['--max-memory', '1k'], ['-h']]),
    ).toThrow();
    expect(() => commandArguments('range-diff', [['-h'], ['--max-memory', '1\0']])).toThrow();
    expect(() => commandArguments('range-diff', [['--max-memory'], ['-h']])).toThrow();
  });
});

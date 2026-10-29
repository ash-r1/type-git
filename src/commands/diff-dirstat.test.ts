import { describe, expect, it } from 'vitest';
import { parseStringCallback, validStringCallback } from '../constraints/string-callback.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import type { OptionSpec } from './spec.js';

const aliases = ['--dirstat', '-X', '--dirstat-by-file'] as const;

describe('shared dirstat parameter grammar', () => {
  it('preserves empty/bare defaults, exact words and native decimal text without numeric clamping', () => {
    for (const value of [
      '',
      'changes',
      'lines',
      'files',
      'cumulative',
      'noncumulative',
      '0',
      '1.',
      '000.000',
      '1000',
      '99999999999999999999999999999999999',
      'files,10.5,cumulative',
    ]) {
      expect(parseStringCallback('diff-dirstat', value), value).toEqual({ valid: true, value });
      for (const flag of aliases) {
        expect(commandArguments('diff', [[flag, value], ['-h']])).toContain(
          flag.startsWith('--') ? `${flag}=${value}` : `${flag}${value}`,
        );
      }
    }
    expect(validStringCallback('diff-dirstat', true)).toBe(true);
    for (const flag of [...aliases, '--cumulative'] as const) {
      expect(commandArguments('diff', [[flag], ['-h']])).toContain(flag);
    }
  });
  it('rejects empty list fields, non-ASCII digits, whitespace and non-decimal suffixes', () => {
    for (const value of [
      ',files',
      'files,',
      'files,,lines',
      'FILES',
      ' files',
      'files ',
      '+1',
      '-1',
      '.5',
      '1..',
      '1e2',
      '1%',
      '1k',
      '1\n',
      '1\r',
      '1 ',
      '١',
      'unknown,files',
    ]) {
      expect(validStringCallback('diff-dirstat', value), value).toBe(false);
      for (const flag of aliases) {
        expect(() => commandArguments('diff', [[flag, value], ['-h']])).toThrow();
      }
    }
    expect(validStringCallback('diff-dirstat', false)).toBe(false);
    expect(() => commandArguments('diff', [['--dirstat', true]])).toThrow();
    expect(() => commandArguments('diff', [['--cumulative', 'files']])).toThrow();
    expect(() =>
      commandArguments('diff', [
        ['--dirstat', 'unknown'],
        ['--dirstat', 'files'],
      ]),
    ).toThrow();
  });
  it('binds all shared aliases in own and retained tables without negations', () => {
    let own = 0;
    let retained = 0;
    for (const spec of Object.values(COMMAND_SPECS)) {
      const current = spec as {
        options: Readonly<Record<string, OptionSpec>>;
        parserExit?: { remainingOptions?: Readonly<Record<string, OptionSpec>> };
      };
      if (current.options['--dirstat']) {
        own++;
        for (const flag of ['--dirstat', '--dirstat-by-file', '--cumulative'] as const) {
          expect(current.options[flag]?.parser).toBe('diff-dirstat');
        }
        if (current.options['-X']?.key === 'dirstat') {
          expect(current.options['-X'].parser).toBe('diff-dirstat');
        } else {
          expect(current.options['-X']?.value).toBe('string');
          expect(current.options['-X']?.parser).toBeUndefined();
        }
        expect(current.options['--cumulative']?.value).toBe('flag');
        expect(current.options['--no-dirstat']).toBeUndefined();
        expect(current.options['--no-cumulative']).toBeUndefined();
      }
      if (current.parserExit?.remainingOptions?.['--dirstat']) {
        retained++;
        for (const flag of [...aliases, '--cumulative'] as const) {
          expect(current.parserExit.remainingOptions[flag]?.parser).toBe('diff-dirstat');
        }
      }
    }
    expect(own).toBe(27);
    expect(retained).toBe(14);
    for (const command of ['cherry-pick', 'revert'] as const) {
      expect(COMMAND_SPECS[command].options['-X'].value).toBe('string');
      expect(commandArguments(command, [['-X', 'BAD'], ['-h']])).toEqual([
        command,
        '-X',
        'BAD',
        '-h',
      ]);
    }
  });
  it('preserves help timing and independent earlier-error, shape and NUL guards', () => {
    expect(() => commandArguments('diff', [['-h'], ['--dirstat', 'BAD']])).toThrow();
    expect(() => commandArguments('blame', [['-X', 'BAD'], ['-h']])).toThrow();
    expect(commandArguments('blame', [['-h'], ['-X', 'BAD']])).toContain('-XBAD');
    expect(commandArguments('log', [['--dirstat', 'BAD'], ['-h']])).toContain('--dirstat=BAD');
    expect(commandArguments('difftool', [['--dirstat', 'BAD'], ['--tool-help']])).toContain(
      '--dirstat=BAD',
    );
    expect(() =>
      commandArguments('difftool', [['--dirstat', 'BAD'], ['--tool-help'], ['--no-tool-help']]),
    ).toThrow();
    expect(() => commandArguments('blame', [['-h'], ['--dirstat', 'files\0']])).toThrow();
    expect(() => commandArguments('blame', [['-h'], ['--dirstat', true]])).toThrow();
  });
});

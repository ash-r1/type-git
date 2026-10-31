import { describe, expect, it } from 'vitest';
import { parseBooleanCallback } from '../constraints/git-boolean.js';
import { validStringCallback } from '../constraints/string-callback.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import type { OptionSpec } from './spec.js';

describe('shared moved-color callbacks', () => {
  it('reuses selected boolean profiles without widening public optional-string shapes', () => {
    for (const value of [
      '',
      'NO',
      'YES',
      '1k',
      'plain',
      'blocks',
      'zebra',
      'default',
      'dimmed_zebra',
    ]) {
      expect(commandArguments('diff', [['--color-moved', value], ['-h']])).toContain(
        `--color-moved=${value}`,
      );
    }
    for (const value of ['PLAIN', 'unknown', '2147483648']) {
      expect(() => commandArguments('diff', [['--color-moved', value], ['-h']])).toThrow();
    }
    expect(commandArguments('diff', [['--color-moved'], ['-h']])).toContain('--color-moved');
    expect(() => commandArguments('diff', [['--color-moved', true]])).toThrow();
    expect(parseBooleanCallback('diff-color-moved', 'k', undefined, 'legacy-units').valid).toBe(
      true,
    );
    expect(parseBooleanCallback('diff-color-moved', 'k', undefined, 'modern').valid).toBe(false);
    expect(parseBooleanCallback('diff-color-moved', '-2147483648', undefined, 'modern').valid).toBe(
      true,
    );
    expect(
      parseBooleanCallback('diff-color-moved', '-2147483648', undefined, 'symmetric').valid,
    ).toBe(false);
  });
  it('resets unknown tokens and checks conflicts only after the complete whitespace list', () => {
    for (const value of [
      'no',
      'unknown,no',
      'no,,no',
      'é,no',
      'ignore-all-space,ignore-space-at-eol',
      'allow-indentation-change',
      'ignore-all-space,no,allow-indentation-change',
      'ignore-all-space,allow-indentation-change,no',
      ' \t\r\n\v\fno \t',
    ]) {
      expect(validStringCallback('diff-color-moved-ws', value), value).toBe(true);
      expect(commandArguments('diff', [['--color-moved-ws', value], ['-h']])).toContain(
        `--color-moved-ws=${value}`,
      );
    }
    for (const value of [
      '',
      'NO',
      'no,unknown',
      'no,',
      'ignore-all-space,allow-indentation-change',
      'allow-indentation-change,ignore-space-change',
      ' no',
      'no,é',
    ]) {
      expect(validStringCallback('diff-color-moved-ws', value), value).toBe(false);
      expect(() => commandArguments('diff', [['--color-moved-ws', value], ['-h']])).toThrow();
    }
    expect(validStringCallback('diff-color-moved-ws', false)).toBe(false);
    expect(commandArguments('diff', [['--no-color-moved-ws'], ['-h']])).toContain(
      '--no-color-moved-ws',
    );
    expect(() => commandArguments('diff', [['--color-moved-ws', false]])).toThrow();
    expect(() =>
      commandArguments('diff', [['--color-moved-ws', 'unknown'], ['--no-color-moved-ws']]),
    ).toThrow();
    expect(() =>
      commandArguments('diff', [
        ['--color-moved-ws', 'unknown'],
        ['--color-moved-ws', 'no'],
      ]),
    ).toThrow();
  });
  it('binds common source callbacks and bypasses parsing on whitespace negation', () => {
    let own = 0;
    let retained = 0;
    for (const spec of Object.values(COMMAND_SPECS)) {
      const current = spec as {
        options: Readonly<Record<string, OptionSpec>>;
        parserExit?: { remainingOptions?: Readonly<Record<string, OptionSpec>> };
      };
      const option = current.options['--color-moved'];
      if (option) {
        own++;
        expect(option.parser).toBe('diff-color-moved');
        expect(current.options['--color-moved-ws']?.parser).toBe('diff-color-moved-ws');
        expect(current.options['--no-color-moved-ws']?.value).toBe('flag');
        expect(current.options['--no-color-moved-ws']?.parser).toBeUndefined();
      }
      if (current.parserExit?.remainingOptions?.['--color-moved']) {
        retained++;
        expect(current.parserExit.remainingOptions['--color-moved']?.parser).toBe(
          'diff-color-moved',
        );
        expect(current.parserExit.remainingOptions['--color-moved-ws']?.parser).toBe(
          'diff-color-moved-ws',
        );
        expect(current.parserExit.remainingOptions['--no-color-moved-ws']?.parser).toBeUndefined();
      }
    }
    expect(own).toBe(27);
    expect(retained).toBe(14);
  });
  it('keeps help preemption, earlier callbacks and NUL/shape guards independent', () => {
    expect(() => commandArguments('diff', [['-h'], ['--color-moved', 'PLAIN']])).toThrow();
    expect(() => commandArguments('blame', [['--color-moved-ws', 'unknown'], ['-h']])).toThrow();
    expect(commandArguments('blame', [['-h'], ['--color-moved-ws', 'unknown']])).toContain(
      '--color-moved-ws=unknown',
    );
    expect(commandArguments('log', [['--color-moved-ws', 'unknown'], ['-h']])).toContain(
      '--color-moved-ws=unknown',
    );
    expect(
      commandArguments('difftool', [['--color-moved-ws', 'unknown'], ['--tool-help']]),
    ).toContain('--color-moved-ws=unknown');
    expect(() =>
      commandArguments('difftool', [
        ['--color-moved-ws', 'unknown'],
        ['--tool-help'],
        ['--no-tool-help'],
      ]),
    ).toThrow();
    expect(() =>
      commandArguments('blame', [['-h'], ['--color-moved-ws', 'unknown\0,no']]),
    ).toThrow();
    expect(() => commandArguments('blame', [['-h'], ['--color-moved-ws', false]])).toThrow();
  });
});

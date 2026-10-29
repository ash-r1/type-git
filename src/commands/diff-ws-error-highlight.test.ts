import { describe, expect, it } from 'vitest';
import { validStringCallback } from '../constraints/string-callback.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import type { OptionSpec } from './spec.js';

describe('shared whitespace-error highlighting callback', () => {
  it('preserves exact tokens, empty full values and one trailing comma', () => {
    for (const value of [
      '',
      'none',
      'default',
      'all',
      'new',
      'old',
      'context',
      'new,',
      'none,none,',
      'new,old,context',
      'all,none,new',
    ]) {
      expect(validStringCallback('diff-ws-error-highlight', value), value).toBe(true);
      expect(commandArguments('diff', [['--ws-error-highlight', value], ['-h']])).toContain(
        `--ws-error-highlight=${value}`,
      );
    }
  });
  it('rejects empty interior tokens, whitespace and earlier unknown tokens immediately', () => {
    for (const value of [
      'NEW',
      ',new',
      'new,,old',
      'new,,',
      ',',
      ' new',
      'new ',
      'new,\told',
      ' new',
      'é',
      'unknown,none',
      'none,unknown',
    ]) {
      expect(validStringCallback('diff-ws-error-highlight', value), value).toBe(false);
      expect(() => commandArguments('diff', [['--ws-error-highlight', value], ['-h']])).toThrow();
    }
    expect(validStringCallback('diff-ws-error-highlight', true)).toBe(false);
    expect(() => commandArguments('diff', [['--ws-error-highlight', true]])).toThrow();
    expect(() =>
      commandArguments('diff', [
        ['--ws-error-highlight', 'unknown'],
        ['--ws-error-highlight', 'none'],
      ]),
    ).toThrow();
  });
  it('binds own and retained callback tables without a negated spelling', () => {
    let own = 0;
    let retained = 0;
    for (const spec of Object.values(COMMAND_SPECS)) {
      const current = spec as {
        options: Readonly<Record<string, OptionSpec>>;
        parserExit?: { remainingOptions?: Readonly<Record<string, OptionSpec>> };
      };
      if (current.options['--ws-error-highlight']) {
        own++;
        expect(current.options['--ws-error-highlight']?.parser).toBe('diff-ws-error-highlight');
        expect(current.options['--no-ws-error-highlight']).toBeUndefined();
      }
      if (current.parserExit?.remainingOptions?.['--ws-error-highlight']) {
        retained++;
        expect(current.parserExit.remainingOptions['--ws-error-highlight']?.parser).toBe(
          'diff-ws-error-highlight',
        );
        expect(current.parserExit.remainingOptions['--no-ws-error-highlight']).toBeUndefined();
      }
    }
    expect(own).toBe(27);
    expect(retained).toBe(14);
  });
  it('keeps help timing, earlier callback failures and argv shape guards independent', () => {
    expect(() => commandArguments('diff', [['-h'], ['--ws-error-highlight', 'NEW']])).toThrow();
    expect(() => commandArguments('blame', [['--ws-error-highlight', 'NEW'], ['-h']])).toThrow();
    expect(commandArguments('blame', [['-h'], ['--ws-error-highlight', 'NEW']])).toContain(
      '--ws-error-highlight=NEW',
    );
    expect(commandArguments('log', [['--ws-error-highlight', 'NEW'], ['-h']])).toContain(
      '--ws-error-highlight=NEW',
    );
    expect(
      commandArguments('difftool', [['--ws-error-highlight', 'NEW'], ['--tool-help']]),
    ).toContain('--ws-error-highlight=NEW');
    expect(() =>
      commandArguments('difftool', [
        ['--ws-error-highlight', 'NEW'],
        ['--tool-help'],
        ['--no-tool-help'],
      ]),
    ).toThrow();
    expect(() => commandArguments('blame', [['-h'], ['--ws-error-highlight', 'new\0']])).toThrow();
    expect(() => commandArguments('blame', [['-h'], ['--ws-error-highlight', false]])).toThrow();
  });
});

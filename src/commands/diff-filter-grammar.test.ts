import { describe, expect, it } from 'vitest';
import { validStringCallback } from '../constraints/string-callback.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import type { OptionSpec } from './spec.js';

describe('shared diff-filter callback letters', () => {
  it('accepts exactly the source classes without normalizing raw text', () => {
    for (const value of [
      '',
      'ACDMRTUXB',
      'acdmrtuxb',
      '*',
      'bad',
      'Aa*',
      'AAaa**',
      'A'.repeat(256),
    ]) {
      expect(validStringCallback('diff-filter-letters', value)).toBe(true);
      expect(commandArguments('diff', [['--diff-filter', value], ['-h']])).toContain(
        `--diff-filter=${value}`,
      );
    }
    for (const value of [
      'S',
      's',
      'Z',
      'z',
      '0',
      '-',
      '+',
      ' A',
      'A ',
      'A,D',
      'A\n',
      'A\t',
      'é',
      '😀',
      `${'A'.repeat(256)}Z`,
      `Z${'A'.repeat(256)}`,
    ]) {
      expect(validStringCallback('diff-filter-letters', value)).toBe(false);
      expect(() => commandArguments('diff', [['--diff-filter', value], ['-h']])).toThrow();
    }
    expect(validStringCallback('diff-filter-letters', true)).toBe(false);
    expect(() => commandArguments('diff', [['--diff-filter']])).toThrow();
    expect(() => commandArguments('diff', [['--diff-filter', true]])).toThrow();
  });
  it('covers every own and retained definition by the shared callback', () => {
    let own = 0;
    let rawCollectors = 0;
    let retained = 0;
    let rawRetained = 0;
    for (const [command, spec] of Object.entries(COMMAND_SPECS)) {
      const current = spec as {
        options: Readonly<Record<string, OptionSpec>>;
        parserExit?: { remainingOptions?: Readonly<Record<string, OptionSpec>> };
      };
      const option = current.options['--diff-filter'];
      if (option) {
        own++;
        if (command === 'backfill') {
          rawCollectors++;
          expect(option.parser).toBeUndefined();
          expect(option.repeat).toBe(true);
          expect(option.skipEmpty).toBe(true);
        } else {
          expect(option.parser).toBe('diff-filter-letters');
        }
      }
      const remaining = current.parserExit?.remainingOptions?.['--diff-filter'];
      if (remaining) {
        retained++;
        if (command === 'backfill') {
          rawRetained++;
          expect(remaining.parser).toBeUndefined();
          expect(remaining.repeat).toBe(true);
          expect(remaining.skipEmpty).toBe(true);
        } else {
          expect(remaining.parser).toBe('diff-filter-letters');
        }
      }
    }
    expect(own).toBe(27);
    expect(rawCollectors).toBe(1);
    expect(retained).toBe(14);
    expect(rawRetained).toBe(1);
  });
  it('preserves help placement, earlier errors and ignored-tail shape checks', () => {
    expect(() => commandArguments('diff', [['-h'], ['--diff-filter', 'Z']])).toThrow();
    expect(() =>
      commandArguments('diff', [
        ['--diff-filter', 'Z'],
        ['--diff-filter', 'A'],
      ]),
    ).toThrow();
    expect(() => commandArguments('blame', [['--diff-filter', 'Z'], ['-h']])).toThrow();
    expect(commandArguments('blame', [['-h'], ['--diff-filter', 'Z']])).toContain(
      '--diff-filter=Z',
    );
    expect(commandArguments('log', [['--diff-filter', 'Z'], ['-h']])).toContain('--diff-filter=Z');
    expect(commandArguments('difftool', [['--diff-filter', 'Z'], ['--tool-help']])).toContain(
      '--diff-filter=Z',
    );
    expect(() =>
      commandArguments('difftool', [['--diff-filter', 'Z'], ['--tool-help'], ['--no-tool-help']]),
    ).toThrow();
    expect(() => commandArguments('blame', [['-h'], ['--diff-filter', true]])).toThrow();
    expect(() => commandArguments('blame', [['-h'], ['--diff-filter', 'A\0']])).toThrow();
  });
});

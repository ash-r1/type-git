import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/branch-format-corpus.json';
import { validGitColor, validRefFormat, validRefSortKey } from '../constraints/ref-format.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

type Row = (typeof corpus.cases)[number];

/** The argv the oracle ran: two-word tokens joined as option=value, operands as they are. */
function argv(row: Row): string[] {
  return [
    'branch',
    ...row.tokens.flatMap((token) =>
      Array.isArray(token)
        ? token.length === 2
          ? [`${token[0]}=${token[1]}`]
          : (token as string[])
        : [(token as { operand: string }).operand],
    ),
  ];
}

/** Whether the strict API accepts a corpus row, checking the serialized argv when it does. */
function accepts(row: Row): boolean {
  try {
    expect(commandArguments('branch', row.tokens as never, true)).toEqual(argv(row));
    return true;
  } catch (error) {
    if (error instanceof GitArgumentError) {
      return false;
    }
    throw error;
  }
}

describe('branch --format and --sort corpus', () => {
  it('matches every independent Git 2.55.0 outcome', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      // Refusals that only formatting a ref or the repository reaches are left to Git.
      const expected = row.valid || row.state;
      if (accepts(row) !== expected) {
        mismatches.push(`${JSON.stringify(argv(row))}: native=${row.valid}, ${row.diagnostic}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('delegates only refusals that formatting a ref or a commit lookup reaches', () => {
    const delegated = corpus.cases.filter((row) => row.state);
    expect(delegated.length).toBeGreaterThan(0);
    for (const row of delegated) {
      const parsed =
        row.option === 'format' ? validRefFormat(row.value) : validRefSortKey(row.value);
      expect(parsed, JSON.stringify(argv(row))).toBe(true);
    }
  });

  it('parses the color grammar of color.c', () => {
    expect(validGitColor('bold red  blue reset')).toBe(true);
    expect(validGitColor('red blue green')).toBe(false);
    expect(validGitColor('\v5')).toBe(true);
    expect(validGitColor('#ggg')).toBe(false);
  });

  it('checks --sort and --format only in list mode', () => {
    expect(() => commandArguments('branch', [['--sort', 'foo']], true)).toThrow(
      '[cli.branch.sort-implicit]',
    );
    expect(() => commandArguments('branch', [['--format', '%(foo)'], ['-r']], true)).toThrow(
      '[cli.branch.format-implicit]',
    );
    expect(() =>
      commandArguments(
        'branch',
        [
          ['--format', '%(foo)'],
          ['--merged', 'main'],
        ],
        true,
      ),
    ).toThrow('[cli.branch.format-merged]');
    expect(commandArguments('branch', [['--show-current'], ['--format', '%(foo)']], true)).toEqual([
      'branch',
      '--show-current',
      '--format=%(foo)',
    ]);
  });
});

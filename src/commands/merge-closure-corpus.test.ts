import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/merge-closure-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

type Row = (typeof corpus.cases)[number];

/** Whether the strict API accepts a corpus row, checking the serialized argv when it does. */
function accepts(row: Row): boolean {
  try {
    expect(commandArguments('merge', row.tokens as never, true)).toEqual(row.argv);
    return true;
  } catch (error) {
    if (error instanceof GitArgumentError) {
      return false;
    }
    throw error;
  }
}

describe('merge completion closure corpus', () => {
  it('matches every independent Git 2.55.0 outcome and preserves serialized argv', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      const accepted = accepts(row);
      // Refusals that depend on repository state, signatures or upstream configuration are left to native Git.
      const expected = row.valid || row.state;
      if (accepted !== expected) {
        mismatches.push(
          `${JSON.stringify(row.argv)}: native=${row.valid}, wrapper=${accepted}, ${row.diagnostic}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('refuses a second custom strategy before a later help word', () => {
    // Git 2.55.0 with git-merge-bogus on PATH: the -s callback resolves each name in order, so
    // the second custom name exits 1 before -h; help reached first exits 129 with usage.
    const refused = (tokens: unknown[]) => {
      try {
        commandArguments('merge', tokens as never, true);
        return false;
      } catch (error) {
        if (error instanceof GitArgumentError) {
          return true;
        }
        throw error;
      }
    };
    expect(refused([['-s', 'bogus'], ['--strategy', 'bogus'], ['-h']])).toBe(true);
    expect(
      refused([
        ['-s', 'bogus'],
        ['-s', 'bogus'],
      ]),
    ).toBe(true);
    expect(refused([['-s', 'bogus'], ['-h'], ['-s', 'bogus']])).toBe(false);
    expect(refused([['-s', 'ours'], ['-s', 'bogus'], ['-h']])).toBe(false);
    expect(refused([['-h'], ['-s', 'bogus'], ['-s', 'bogus']])).toBe(false);
  });
});

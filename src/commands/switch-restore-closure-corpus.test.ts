import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/switch-restore-closure-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

type Command = 'switch' | 'restore';

/** Run the strict builder and report acceptance, keeping serialization in the comparison. */
function accepts(command: Command, tokens: unknown[], argv: string[]): boolean | string {
  try {
    expect(commandArguments(command, tokens, true)).toEqual(argv);
    return true;
  } catch (error) {
    if (!(error instanceof GitArgumentError)) {
      throw error;
    }
    return String(error.message);
  }
}

describe('switch and restore completion closure corpus', () => {
  it('matches every argv-decided Git 2.55.0 outcome and preserves serialized argv', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      const result = accepts(row.command as Command, row.tokens, row.argv);
      // Repository-state refusals are delegated to Git, so only accepted argv is compared.
      if (row.delegated) {
        continue;
      }
      if ((result === true) !== row.valid) {
        mismatches.push(`${JSON.stringify(row.argv)}: native=${row.valid}, ${row.diagnostic}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('accepts every argv that Git accepted, including delegated state checks', () => {
    for (const row of corpus.cases.filter((candidate) => candidate.valid)) {
      expect(accepts(row.command as Command, row.tokens, row.argv), JSON.stringify(row.argv)).toBe(
        true,
      );
    }
  });

  it('refuses the derived --track branch name through its own rule', () => {
    const rows = corpus.cases.filter((row) => /missing branch name; try -c/.test(row.diagnostic));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(accepts('switch', row.tokens, row.argv)).toMatch(/switch-track-start-point/);
    }
  });

  it('refuses invalid new branch names through the name rules', () => {
    const rows = corpus.cases.filter((row) => /is not a valid branch name$/.test(row.diagnostic));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(accepts('switch', row.tokens, row.argv)).toMatch(
        /switch-(create|force-create|orphan)-name|switch-track-start-point/,
      );
    }
  });
});

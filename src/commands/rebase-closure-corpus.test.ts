import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/rebase-closure-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

type Row = (typeof corpus.cases)[number];

/** Whether the strict API accepts a corpus row, checking the serialized argv when it does. */
function accepts(row: Row): boolean {
  try {
    expect(commandArguments('rebase', row.tokens as never, true)).toEqual(row.argv);
    return true;
  } catch (error) {
    if (error instanceof GitArgumentError) {
      return false;
    }
    throw error;
  }
}

describe('rebase completion closure corpus', () => {
  it('matches every independent Git 2.55.0 outcome and preserves serialized argv', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      const accepted = accepts(row);
      // Refusals that depend on repository state, signing keys or strategy executables are left to native Git.
      const expected = row.valid || row.state;
      if (accepted !== expected) {
        mismatches.push(
          `${JSON.stringify(row.argv)}: native=${row.valid}, wrapper=${accepted}, ${row.diagnostic}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});

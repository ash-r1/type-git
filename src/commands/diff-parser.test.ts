import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/diff-parser-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

/** Evaluate one corpus row through the production builder, keeping only argument rejections. */
function wrapperAccepts(row: (typeof corpus.cases)[number]): boolean {
  try {
    expect(commandArguments(row.command as GitCommandName, row.tokens, true)).toEqual(row.argv);
    return true;
  } catch (error) {
    if (!(error instanceof GitArgumentError)) {
      throw error;
    }
    return false;
  }
}

describe('native diff residual dispatch and raw-word scans', () => {
  it('matches the independent native corpus and preserves serialized argv', () => {
    const mismatches = corpus.cases
      .filter((row) => wrapperAccepts(row) !== row.valid)
      .map((row) => `${JSON.stringify(row.argv)}: native=${row.valid}, ${row.diagnostic}`);
    expect(mismatches).toEqual([]);
  });

  it('never accepts a long-name prefix that Git rejects', () => {
    const unsound = corpus.prefixes
      .filter((row) => wrapperAccepts(row) && !row.valid)
      .map((row) => `${JSON.stringify(row.argv)}: ${row.diagnostic}`);
    // Abbreviations that Git resolves stay outside the canonical-spelling API. These rows
    // witness soundness only; abbreviation support is not claimed as modeled.
    expect(unsound).toEqual([]);
  });
});

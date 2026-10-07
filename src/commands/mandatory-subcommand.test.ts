import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/mandatory-subcommand-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

describe('mandatory native subcommand selection', () => {
  it('matches the independent native dispatch and child grammar outcomes', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      let accepted = false;
      try {
        expect(commandArguments('refs', row.tokens, true)).toEqual(row.argv);
        accepted = true;
      } catch (error) {
        if (!(error instanceof GitArgumentError)) throw error;
      }
      if (accepted !== row.valid) {
        mismatches.push(
          `${JSON.stringify(row.argv)}: native=${row.valid}, wrapper=${accepted}, ${row.diagnostic}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});

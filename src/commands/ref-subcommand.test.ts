import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/ref-subcommand-corpus.json';
import { isLiteralOperandRefusal } from '../../test/support/literal-operand.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

describe('native reference subcommand and signature parsers', () => {
  it('matches the independent native corpus and preserves serialized argv', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      let accepted = false;
      let refused = false;
      try {
        const argv = commandArguments(row.command as GitCommandName, row.tokens, true);
        expect(argv).toEqual(row.argv);
        accepted = true;
      } catch (error) {
        if (!(error instanceof GitArgumentError)) {
          throw error;
        }
        refused = isLiteralOperandRefusal(row.tokens, error);
      }
      // Native acceptance of an operand object read as an option is a deliberate refusal.
      if (accepted !== row.valid && !(row.valid && refused)) {
        mismatches.push(
          `${JSON.stringify(row.argv)}: native=${row.valid}, wrapper=${accepted}, ${row.diagnostic}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});

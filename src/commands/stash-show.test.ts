import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/stash-show-corpus.json';
import { isLiteralOperandRefusal } from '../../test/support/literal-operand.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import { partitionRemainingArguments } from './revision-parser-pass.js';
import type { GitCommandName } from './types.js';

describe('native stash show parser partition', () => {
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
  it('partitions every retained word before revision end-marker handling', () => {
    const spec = COMMAND_SPECS['stash show'];
    const pass = initialParserPass(spec, ['-u', '--', 'foo', '-h', '-unknown']);
    expect(pass).toEqual({
      exited: false,
      tokens: [['-u']],
      remaining: ['--', 'foo', '-h', '-unknown'],
    });
    expect(partitionRemainingArguments(spec, pass.remaining)).toEqual({
      words: ['--', '-h', '-unknown'],
      state: { 'stash-operands': ['foo'] },
    });
  });
});

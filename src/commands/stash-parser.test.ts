import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/stash-parser-corpus.json';
import { isLiteralOperandRefusal } from '../../test/support/literal-operand.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import type { GitCommandName } from './types.js';

describe('native stash option parsers', () => {
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
  it('retains each command-specific operand boundary', () => {
    expect(initialParserPass(COMMAND_SPECS.stash, ['--patch', 'file', '--', '-h'])).toEqual({
      exited: false,
      tokens: [['--patch']],
      remaining: ['file', '--', '-h'],
    });
    expect(initialParserPass(COMMAND_SPECS.stash, ['--', 'file', '-h'])).toEqual({
      exited: false,
      tokens: [],
      remaining: ['--', 'file', '-h'],
    });
    expect(initialParserPass(COMMAND_SPECS['stash clear'], ['file', '-h'])).toEqual({
      exited: false,
      tokens: [],
      remaining: ['file', '-h'],
    });
    expect(initialParserPass(COMMAND_SPECS['stash store'], ['--unknown', '-h'])).toEqual({
      exited: true,
      tokens: [['-h']],
      remaining: ['--unknown'],
    });
    expect(initialParserPass(COMMAND_SPECS['stash push'], ['--', 'file'])).toEqual({
      exited: false,
      tokens: [],
      remaining: ['--', 'file'],
    });
    expect(initialParserPass(COMMAND_SPECS['stash save'], ['--end-of-options', '-h'])).toEqual({
      exited: false,
      tokens: [],
      remaining: ['-h'],
    });
  });
});

import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/stash-parser-corpus.json';
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
      try {
        const argv = commandArguments(row.command as GitCommandName, row.tokens, true);
        expect(argv).toEqual(row.argv);
        accepted = true;
      } catch (error) {
        if (!(error instanceof GitArgumentError)) {
          throw error;
        }
      }
      if (accepted !== row.valid) {
        mismatches.push(
          `${JSON.stringify(row.argv)}: native=${row.valid}, wrapper=${accepted}, ${row.diagnostic}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
  it('retains each command-specific operand boundary', () => {
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

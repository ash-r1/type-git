import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/stash-transfer-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import type { GitCommandName } from './types.js';

describe('native stash transfer parsers', () => {
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
  it('retains -- but consumes --end-of-options before literal revision operands', () => {
    for (const command of ['stash import', 'stash export'] as const) {
      expect(initialParserPass(COMMAND_SPECS[command], ['--', '-h'])).toEqual({
        exited: false,
        tokens: [],
        remaining: ['--', '-h'],
      });
      expect(initialParserPass(COMMAND_SPECS[command], ['--end-of-options', '-h'])).toEqual({
        exited: false,
        tokens: [],
        remaining: ['-h'],
      });
    }
  });
});

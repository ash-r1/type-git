import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/worktree-parser-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import type { GitCommandName } from './types.js';

describe('native worktree option parsers', () => {
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
  it('consumes end markers and retains all following path words literally', () => {
    for (const command of ['add', 'rm', 'mv', 'clean'] as const) {
      for (const marker of ['--', '--end-of-options']) {
        expect(initialParserPass(COMMAND_SPECS[command], [marker, '-h'])).toEqual({
          exited: false,
          tokens: [],
          remaining: ['-h'],
        });
      }
      expect(initialParserPass(COMMAND_SPECS[command], ['file', '-h']).exited).toBe(true);
    }
  });
});

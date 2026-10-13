import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/reference-parser-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import type { GitCommandName } from './types.js';

describe('native reference and status parsers', () => {
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
  it('uses LASTARG_DEFAULT only when no following word exists', () => {
    expect(initialParserPass(COMMAND_SPECS.branch, ['--contains', '-h', '--color=bad'])).toEqual({
      exited: false,
      tokens: [
        ['--contains', '-h'],
        ['--color', 'bad'],
      ],
      remaining: [],
    });
    expect(initialParserPass(COMMAND_SPECS.branch, ['--contains'])).toEqual({
      exited: false,
      tokens: [['--contains']],
      remaining: [],
    });
    expect(initialParserPass(COMMAND_SPECS.branch, ['--track', '-h'])).toEqual({
      exited: true,
      tokens: [['--track'], ['-h']],
      remaining: [],
    });
  });
});

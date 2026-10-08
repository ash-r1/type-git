import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/format-patch-parser-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import type { GitCommandName } from './types.js';

describe('format-patch parser phases', () => {
  it('matches independent native results without changing the emitted argv', () => {
    for (const row of corpus.cases) {
      const build = (): string[] =>
        commandArguments(row.command as GitCommandName, row.tokens, true);
      if (row.valid) {
        expect(build(), JSON.stringify(row.argv)).toEqual(row.argv);
      } else {
        expect(build, JSON.stringify(row.argv)).toThrow(GitArgumentError);
      }
    }
  });
  it('keeps native meanings in the initial option pass', () => {
    expect(initialParserPass(COMMAND_SPECS['format-patch'], ['-nh'])).toEqual({
      exited: true,
      tokens: [['-n'], ['-h']],
      remaining: [],
    });
    expect(initialParserPass(COMMAND_SPECS['format-patch'], ['-G', '-o', '-h'])).toEqual({
      exited: false,
      tokens: [['-o', '-h']],
      remaining: ['-G'],
    });
  });
});

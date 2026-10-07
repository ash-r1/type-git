import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/wrapper-parser-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import type { GitCommandName } from './types.js';

describe('ordered reflog wrapper parsers', () => {
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
  it('distinguishes the optional-subcommand fallback from the empty show wrapper', () => {
    expect(initialParserPass(COMMAND_SPECS.reflog, ['--decorate=bad', '-h'])).toEqual({
      exited: true,
      tokens: [['--decorate', 'bad'], ['-h']],
      remaining: [],
    });
    expect(initialParserPass(COMMAND_SPECS['reflog show'], ['--decorate=bad', '-h'])).toEqual({
      exited: true,
      tokens: [['-h']],
      remaining: ['--decorate=bad'],
    });
    expect(initialParserPass(COMMAND_SPECS['reflog show'], ['-G', '-L', '-h'])).toEqual({
      exited: true,
      tokens: [['-h']],
      remaining: ['-G', '-L'],
    });
    expect(initialParserPass(COMMAND_SPECS['reflog show'], ['--', '--color=bad'])).toEqual({
      exited: false,
      tokens: [],
      remaining: ['--', '--color=bad'],
    });
  });
});

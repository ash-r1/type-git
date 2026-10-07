import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/residual-argv-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import type { GitCommandName } from './types.js';

describe('residual argv after the initial parser', () => {
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
  it('retains partially consumed short clusters and respects each native dash-dash policy', () => {
    expect(initialParserPass(COMMAND_SPECS.log, ['-qSx', '--', '--color=bad'])).toEqual({
      exited: false,
      tokens: [['-q']],
      remaining: ['-Sx', '--', '--color=bad'],
    });
    expect(
      initialParserPass(COMMAND_SPECS['fast-export'], ['--no-data', '--', '--color=bad']),
    ).toEqual({ exited: false, tokens: [['--no-data']], remaining: ['--color=bad'] });
    expect(initialParserPass(COMMAND_SPECS.log, ['-G', '-L', '-h'])).toEqual({
      exited: false,
      tokens: [['-L', '-h']],
      remaining: ['-G'],
    });
  });
});

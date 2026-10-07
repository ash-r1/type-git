import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/string-callback-corpus.json';
import { parseGitScalar } from '../constraints/git-scalars.js';
import type { StringCallbackParser } from '../constraints/string-callback.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

describe('declarative string callback languages', () => {
  it('matches independent native callback results and preserves argv', () => {
    for (const row of corpus.cases) {
      expect(
        parseGitScalar(row.parser as StringCallbackParser, row.value).valid,
        JSON.stringify(row),
      ).toBe(row.valid);
      const build = (): string[] =>
        commandArguments(row.command as GitCommandName, row.tokens, true);
      if (row.valid) {
        expect(build()).toEqual(row.argv);
      } else {
        expect(build, JSON.stringify(row)).toThrow(GitArgumentError);
      }
    }
  });

  it('applies the string grammar only if Git reaches the callback', () => {
    expect(commandArguments('fast-export', [['-h'], ['--anonymize-map', ':']])).toEqual([
      'fast-export',
      '-h',
      '--anonymize-map=:',
    ]);
    expect(() => commandArguments('fast-export', [['--anonymize-map', ':'], ['-h']])).toThrow(
      GitArgumentError,
    );
    expect(() => commandArguments('fast-export', [['-h'], ['--anonymize-map', 'a\0b']])).toThrow(
      GitArgumentError,
    );
  });
});

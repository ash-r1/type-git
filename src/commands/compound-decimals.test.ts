import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/compound-decimal-corpus.json';
import type { CompoundDecimalParser } from '../constraints/compound-decimal.js';
import { parseGitScalar } from '../constraints/git-scalars.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

describe('compound decimal callback grammar', () => {
  it('agrees with the independent native corpus in scalar and command validation', () => {
    for (const row of corpus.cases) {
      expect(
        parseGitScalar(row.parser as CompoundDecimalParser, row.value).valid,
        JSON.stringify(row),
      ).toBe(row.valid);
      const build = (): string[] =>
        commandArguments(row.command as GitCommandName, [[row.flag, row.value], ['-h']], true);
      if (row.valid) {
        expect(build()).toEqual([
          row.command,
          row.flag.startsWith('--') ? `${row.flag}=${row.value}` : `${row.flag}${row.value}`,
          '-h',
        ]);
      } else {
        expect(build, JSON.stringify(row)).toThrow(GitArgumentError);
      }
    }
    for (const row of corpus.exits) {
      const build = (): string[] => commandArguments('shortlog', row.tokens, true);
      if (row.valid) {
        expect(build()).toEqual(row.argv);
      } else {
        expect(build).toThrow(GitArgumentError);
      }
    }
  });

  it('keeps shortlog parser callbacks on the correct side of help', () => {
    expect(commandArguments('shortlog', [['-h'], ['-w', '76\n']])).toEqual([
      'shortlog',
      '-h',
      '-w76\n',
    ]);
    expect(commandArguments('shortlog', [['-h'], ['--color', 'invalid']])).toEqual([
      'shortlog',
      '-h',
      '--color=invalid',
    ]);
    expect(() => commandArguments('shortlog', [['--color', 'invalid'], ['-h']])).toThrow(
      GitArgumentError,
    );
    expect(commandArguments('shortlog', [['--color', 'AuTo'], ['-h']])).toEqual([
      'shortlog',
      '--color=AuTo',
      '-h',
    ]);
    expect(() => commandArguments('shortlog', [['-h'], ['-w', 'a\0b']])).toThrow(GitArgumentError);
  });
});

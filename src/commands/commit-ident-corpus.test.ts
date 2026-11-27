import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/commit-ident-corpus.json';
import { validateInput } from '../core/option-rules.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

type Row = (typeof corpus.cases)[number];

/** Whether the strict API accepts a corpus row, checking the serialized argv when it does. */
function accepts(row: Row): boolean {
  try {
    expect(commandArguments('commit', row.tokens as never, true)).toEqual(row.argv);
    return true;
  } catch (error) {
    if (error instanceof GitArgumentError) {
      return false;
    }
    throw error;
  }
}

/** The --author or --date value of a row. */
const value = (row: Row): [string, string] => {
  const token = row.tokens.find(
    (word) => Array.isArray(word) && (word[0] === '--author' || word[0] === '--date'),
  ) as string[];
  return [token[0] as string, token[1] as string];
};

describe('commit author and date corpus', () => {
  it('matches every independent Git 2.55.0 outcome in the strict API', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      // Nicknames resolve against existing authors; approxidate results against the clock.
      const expected = row.valid || row.state || row.environment;
      if (accepts(row) !== expected) {
        mismatches.push(`${JSON.stringify(row.argv)}: native=${row.valid}, ${row.diagnostic}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('matches the same outcomes in repo.commit', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      const [option, text] = value(row);
      // repo.commit skips an empty author or date instead of passing it to Git.
      if (text === '') {
        continue;
      }
      const opts = {
        message: 'msg',
        allowEmpty: true,
        dryRun: row.argv.includes('--dry-run'),
        ...(option === '--author' ? { author: text } : { date: text }),
      };
      let accepted = true;
      try {
        validateInput('commitPaths', opts, 'commit');
      } catch (error) {
        if (!(error instanceof GitArgumentError)) {
          throw error;
        }
        accepted = false;
      }
      if (accepted !== (row.valid || row.state || row.environment)) {
        mismatches.push(`${JSON.stringify(opts)}: native=${row.valid}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('accepts a Date in repo.commit', () => {
    expect(() =>
      validateInput('commitPaths', { date: new Date(0), message: 'msg' }, 'commit'),
    ).not.toThrow();
  });
});

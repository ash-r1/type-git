import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/status-commit-path-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

const EMPTY_PATHSPEC_DIAGNOSTIC = /empty string is not a valid pathspec/;
const NO_PATHS_DIAGNOSTIC = /No paths/;
const PATH_RULE = /\[(cli\.(?:status|commit)\.(?:empty-pathspec|only-paths(?:-fixup)?))\]/g;

describe('native status and commit path rules', () => {
  it('matches the independent Git 2.55.0 corpus and preserves serialized argv', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      let accepted = false;
      try {
        expect(commandArguments(row.command as GitCommandName, row.tokens, true)).toEqual(row.argv);
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

  it('reaches each new path rule through a native refusal with its diagnostic', () => {
    const reached = new Set<string>();
    for (const row of corpus.cases.filter((candidate) => !candidate.valid)) {
      try {
        commandArguments(row.command as GitCommandName, row.tokens, true);
      } catch (error) {
        for (const [, id] of String((error as Error).message).matchAll(PATH_RULE)) {
          expect(row.diagnostic, `${id}: ${JSON.stringify(row.argv)}`).toMatch(
            id?.endsWith('empty-pathspec') ? EMPTY_PATHSPEC_DIAGNOSTIC : NO_PATHS_DIAGNOSTIC,
          );
          reached.add(id as string);
        }
      }
    }
    expect([...reached].sort()).toEqual([
      'cli.commit.empty-pathspec',
      'cli.commit.only-paths',
      'cli.commit.only-paths-fixup',
      'cli.status.empty-pathspec',
    ]);
  });
});

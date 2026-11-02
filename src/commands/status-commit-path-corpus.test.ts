import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/status-commit-path-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

type Row = (typeof corpus.cases)[number];

const EMPTY_PATHSPEC_DIAGNOSTIC = /empty string is not a valid pathspec/;
const NO_PATHS_DIAGNOSTIC = /No paths/;
const PATH_RULE = /\[(cli\.(?:status|commit)\.(?:empty-pathspec|only-paths))\]/g;

/** Final last-wins state: --amend active with a fixup that is not an amend: fixup. */
function amendWithPlainFixup(row: Row): boolean {
  let amend = false;
  let fixup: string | undefined;
  for (const token of row.tokens) {
    if (!Array.isArray(token)) {
      continue;
    }
    const [flag, value] = token;
    if (flag === '--amend' || flag === '--no-amend') {
      amend = flag === '--amend';
    } else if (flag === '--fixup' || flag === '--no-fixup') {
      fixup = flag === '--fixup' ? value : undefined;
    }
  }
  return row.command === 'commit' && amend && fixup !== undefined && !fixup.startsWith('amend:');
}

describe('native status and commit path rules', () => {
  it('matches the independent Git 2.55.0 corpus and preserves serialized argv', () => {
    const mismatches: string[] = [];
    const delegated: string[] = [];
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
      if (accepted && !row.valid && amendWithPlainFixup(row)) {
        // Git 2.32+ refuses --only --amend with a plain fixup, but older Git accepts it.
        expect(row.diagnostic).toMatch(NO_PATHS_DIAGNOSTIC);
        delegated.push(JSON.stringify(row.argv));
      } else if (accepted !== row.valid) {
        mismatches.push(
          `${JSON.stringify(row.argv)}: native=${row.valid}, wrapper=${accepted}, ${row.diagnostic}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
    expect(delegated.length).toBeGreaterThan(0);
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
      'cli.status.empty-pathspec',
    ]);
  });
});

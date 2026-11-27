import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/stash-closure-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

type Row = (typeof corpus.cases)[number];

/** Typed stash rules, keyed by the native diagnostic of the refusal they model. */
const RULES_FOR_DIAGNOSTIC: [RegExp, (row: Row) => string][] = [
  [
    /^Too many revisions specified:/,
    (row) =>
      row.command === 'stash show'
        ? 'stash.show-arity'
        : `${row.command.replaceAll(' ', '-')}-arity`,
  ],
  [/^error: refs\/stash@\{\} is not a valid reference$/, (row) => emptyRule(row)],
  [/^No branch name specified$/, () => 'stash-branch-arity'],
  [/^fatal: '' is not a valid branch name$/, () => 'stash-branch-empty-operand'],
  [/^fatal: '.+' is not a valid branch name$/, () => 'stash-branch-name'],
  [/^fatal: update_ref failed for ref '': /, () => 'stash-export-to-ref'],
  [/refusing to update ref with bad name/, () => 'stash-export-to-ref'],
  [/refusing to update pseudoref 'FETCH_HEAD'$/, () => 'stash-export-to-ref-fetch-head'],
  [/refusing to update pseudoref 'MERGE_HEAD'$/, () => 'stash-export-to-ref-merge-head'],
  [/^"git stash store" requires one <commit> argument$/, () => 'stash-store-arity'],
  [/^Cannot update refs\/stash with $/, () => 'stash-store-empty-operand'],
  [/^fatal: a revision is required$/, () => 'stash-import-arity'],
  [/^error: not a valid revision: $/, () => 'stash-import-empty-operand'],
  [/^error: exactly one of --print and --to-ref is required$/, (row) => exportModeRule(row)],
  [/^error: unable to find stash entry $/, () => 'stash-export-empty-stash-reference'],
  [/^error: git stash clear with arguments is unimplemented$/, () => 'stash-clear-arity'],
  [/^fatal: subcommand wasn't specified/, () => 'cli.stash.assumed-push-paths'],
  [
    /cannot be used together$/,
    (row) =>
      `${pushRule(row)}-file-${/--patch/.test(row.diagnostic) ? 'patch' : /--staged/.test(row.diagnostic) ? 'staged' : 'operands'}`,
  ],
  [/^fatal: the option '--pathspec-file-nul'/, (row) => `${pushRule(row)}-file-nul`],
  [/^fatal: the option '--unified'/, (row) => `${pushRule(row)}-unified-patch`],
  [
    /^fatal: the option '--inter-hunk-context'/,
    (row) => `${pushRule(row)}-inter-hunk-context-patch`,
  ],
  [/^fatal: the option '--no-auto-advance'/, (row) => `${pushRule(row)}-auto-advance`],
  [/^fatal: '--unified' cannot be negative$/, (row) => `${pushRule(row)}-unified-range`],
  [
    /^fatal: '--inter-hunk-context' cannot be negative$/,
    (row) => `${pushRule(row)}-inter-hunk-context-range`,
  ],
  [/^Can't use --patch and/, (row) => `${pushRule(row)}-patch-untracked`],
  [/^Can't use --staged and/, (row) => `${pushRule(row)}-staged-untracked`],
  [
    /^fatal: empty string is not a valid pathspec/,
    (row) => (row.command === 'stash' ? 'stash-empty-pathspec' : 'stash-push-empty-pathspec'),
  ],
];

/** Parse-options diagnostics that the parser corpora map to option-table refusals. */
const UNMAPPED_PARSER_ERROR =
  /^error: (?:unknown (?:option|switch)|ambiguous option|(?:option|switch) `[^']*' (?:takes no value|requires a value))/;

/** store --quiet refuses a wrong operand count or an empty commit name without a message. */
const QUIET_STORE: [RegExp, (row: Row) => string] = [
  /^$/,
  (row) =>
    row.tokens.filter((token) => !Array.isArray(token)).length === 1
      ? 'stash-store-empty-operand'
      : 'stash-store-arity',
];

/** The rule prefix of the push parser that a push, save or assumed-push case reaches. */
function pushRule(row: Row): string {
  return row.command === 'stash save' ? 'stash-save' : 'stash-push';
}
function emptyRule(row: Row): string {
  return row.command === 'stash branch'
    ? 'stash-branch-empty-operand'
    : row.command === 'stash show'
      ? 'stash.show-empty-reference'
      : `${row.command.replaceAll(' ', '-')}-empty-stash-reference`;
}
function exportModeRule(row: Row): string {
  return row.argv.includes('--print') && row.argv.some((word) => word.startsWith('--to-ref'))
    ? 'stash-export-modes'
    : 'stash-export-destination';
}

function typed(row: Row): { accepted: boolean; error?: GitArgumentError } {
  try {
    expect(commandArguments(row.command as GitCommandName, row.tokens as never, true)).toEqual(
      row.argv,
    );
    return { accepted: true };
  } catch (error) {
    if (!(error instanceof GitArgumentError)) {
      throw error;
    }
    return { accepted: false, error };
  }
}

describe('stash completion closure corpus', () => {
  it('matches every independent Git 2.55.0 outcome and preserves serialized argv', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      // Repository state, object resolution and interactive input are left to native Git.
      const expected = row.valid || row.state;
      const { accepted } = typed(row);
      if (accepted !== expected) {
        mismatches.push(
          `${JSON.stringify(row.argv)}: native=${row.valid}/${row.state}, wrapper=${accepted}, ${row.diagnostic}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('reports the rule of the refusal that Git reaches for each modeled diagnostic', () => {
    const missing: string[] = [];
    const reached = new Set<string>();
    for (const row of corpus.cases) {
      if (row.valid || row.state) {
        continue;
      }
      const entry =
        row.command === 'stash store' && !row.diagnostic
          ? QUIET_STORE
          : RULES_FOR_DIAGNOSTIC.find(([pattern]) => pattern.test(row.diagnostic));
      if (!entry) {
        // Only parse-options errors, which the parser corpora map, are left unmapped here.
        expect(row.diagnostic).toMatch(UNMAPPED_PARSER_ERROR);
        continue;
      }
      const rule = entry[1](row);
      const { error } = typed(row);
      if (error?.message.includes(`[${rule}]`)) {
        reached.add(rule);
      } else {
        missing.push(`${JSON.stringify(row.argv)}: expected [${rule}], got ${error?.message}`);
      }
    }
    expect(missing).toEqual([]);
    expect(reached.size).toBeGreaterThanOrEqual(39);
  });
});

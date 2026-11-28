import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/commit-closure-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

/** Typed commit rules, keyed by the native diagnostic of the refusal site they model. */
const RULE_FOR_DIAGNOSTIC: [RegExp, string][] = [
  [/^fatal: unknown option: --fixup=/, 'cli.commit.fixup-suboption'],
  [/^fatal: options '-m' and '--fixup:amend'/, 'cli.commit.fixup-amend-message'],
  [/^fatal: options '-m' and '--fixup:reword'/, 'cli.commit.fixup-reword-message'],
  [/^fatal: options '--squash' and '--fixup'/, 'cli.commit.fixup-squash'],
  [/^fatal: options '--reset-author' and '--author'/, 'cli.commit.author'],
  [/^fatal: reword option of '--fixup' and path/, 'cli.commit.reword-paths'],
  [/^fatal: reword option of '--fixup' and '--patch/, 'cli.commit.reword-content'],
  [/^fatal: paths '.*' with -a/, 'cli.commit.all-paths'],
  [/^fatal: No paths with --include\/--only/, 'cli.commit.only-paths'],
  [/^fatal: Invalid cleanup mode/, 'cli.commit.cleanup'],
  [/^fatal: Invalid untracked files mode/, 'cli.commit.untracked'],
  [/^fatal: options '--long' and '-z'/, 'cli.commit.long-nul'],
  [/^fatal: options '-C' and '--fixup'/, 'cli.commit.message-source'],
  [/^fatal: options '-m' and '-C'/, 'cli.commit.literal-message-source'],
  [/^fatal: options '-i\/--include' and '-o\/--only'/, 'cli.commit.content-mode'],
  [/^fatal: options '-o\/--only' and '--interactive\/-p\/--patch'/, 'cli.commit.patch-mode'],
  [/^fatal: options '--pathspec-from-file' and '-a'/, 'cli.commit.pathspec-file-modes'],
  [/^fatal: the option '--pathspec-file-nul' requires/, 'cli.commit.pathspec-nul'],
  [/^fatal: '--unified' cannot be negative/, 'cli.commit.unified-minimum'],
  [/^fatal: '--inter-hunk-context' cannot be negative/, 'cli.commit.inter-hunk-context-minimum'],
  [/^fatal: the option '--unified' requires/, 'cli.commit.unified-interactive'],
  [
    /^fatal: the option '--inter-hunk-context' requires/,
    'cli.commit.inter-hunk-context-interactive',
  ],
  [/^fatal: empty string is not a valid pathspec/, 'cli.commit.empty-pathspec'],
];

/**
 * Native refusals the closure delegates: Git decides them from repository state that argv
 * alone does not fix (a cherry-pick or rebase in progress lets --reset-author stand alone),
 * so the wrapper accepts them and leaves the refusal to Git.
 */
const DELEGATED: RegExp[] = [
  /^fatal: --reset-author can be used only with -C, -c or --amend\.$/,
  // Commit names given to --fixup resolve against the object database.
  /^fatal: could not lookup commit '/,
];
/** Pathspecs read from a file are matched against the work tree, so only those rows. */
const DELEGATED_PATHSPEC_FILE = /^error: pathspec '/;

describe('commit completion closure corpus', () => {
  it('refuses --reset-author with --amend and a fixup, which Git refuses in every state', () => {
    const rows = corpus.cases.filter(
      (row) =>
        row.argv.includes('--reset-author') &&
        row.argv.includes('--amend') &&
        row.argv.some((word) => word.startsWith('--fixup=')),
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.valid).toBe(false);
      expect(() => commandArguments('commit', row.tokens, true)).toThrow(
        '[cli.commit.reset-author-amend-fixup]',
      );
    }
  });

  it('refuses only mode with --amend and a plain fixup, which Git 2.55.0 refuses', () => {
    const rows = corpus.cases.filter(
      (row) =>
        row.argv.includes('-o') &&
        row.argv.includes('--amend') &&
        row.argv.some((word) => word.startsWith('--fixup=') && !word.startsWith('--fixup=amend:')),
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.valid).toBe(false);
      expect(() => commandArguments('commit', row.tokens, true)).toThrow(GitArgumentError);
    }
  });

  it('matches every independent Git 2.55.0 outcome and preserves serialized argv', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      let accepted = false;
      try {
        expect(commandArguments('commit', row.tokens, true)).toEqual(row.argv);
        accepted = true;
      } catch (error) {
        if (!(error instanceof GitArgumentError)) {
          throw error;
        }
      }
      const delegated =
        !row.valid &&
        (DELEGATED.some((pattern) => pattern.test(row.diagnostic)) ||
          (DELEGATED_PATHSPEC_FILE.test(row.diagnostic) &&
            row.argv.some((word) => word.startsWith('--pathspec-from-file'))));
      if (accepted !== row.valid && !(accepted && delegated)) {
        mismatches.push(
          `${JSON.stringify(row.argv)}: native=${row.valid}, wrapper=${accepted}, ${row.diagnostic}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('reaches each modeled refusal site through a native refusal with its rule', () => {
    const reached = new Set<string>();
    for (const row of corpus.cases) {
      const rule = RULE_FOR_DIAGNOSTIC.find(([pattern]) => pattern.test(row.diagnostic))?.[1];
      if (!rule || row.valid) {
        continue;
      }
      try {
        commandArguments('commit', row.tokens, true);
      } catch (error) {
        if (error instanceof GitArgumentError && error.message.includes(`[${rule}]`)) {
          reached.add(rule);
        }
      }
    }
    expect([...reached].sort()).toEqual(RULE_FOR_DIAGNOSTIC.map(([, rule]) => rule).sort());
  });
});

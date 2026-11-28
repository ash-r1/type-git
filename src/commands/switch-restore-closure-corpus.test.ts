import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/switch-restore-closure-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

type Command = 'switch' | 'restore';

/** Run the strict builder and report acceptance, keeping serialization in the comparison. */
function accepts(command: Command, tokens: unknown[], argv: string[]): boolean | string {
  try {
    expect(commandArguments(command, tokens, true)).toEqual(argv);
    return true;
  } catch (error) {
    if (!(error instanceof GitArgumentError)) {
      throw error;
    }
    return String(error.message);
  }
}

type Row = (typeof corpus.cases)[number];
/** Options with each operand replaced by the resolvable branch `side`. */
const resolvedKey = (row: Row): string =>
  JSON.stringify([
    row.command,
    row.tokens.map((token) => (Array.isArray(token) ? token : { operand: 'side' })),
  ]);
/** The `--` or `--no-` prefix of a long option name. */
const OPTION_PREFIX = /^--(no-)?/;
/** The option names that select one rule id for a generator label's `*` wildcard. */
const WILDCARD_PARTS: Record<string, string> = {
  create: 'create',
  'force-create': 'force-create',
  orphan: 'orphan',
  ours: 'stage',
  theirs: 'stage',
  merge: 'merge',
  conflict: 'merge',
  staged: 'staged',
  worktree: 'worktree',
};
/**
 * The exact rule ids a generator label names for one row: each `*` expands only to the parts the
 * row's own options select, so `switch-detach-*` with `--create` requires `[switch-detach-create]`.
 */
const ruleIds = (label: string, row: Row): string[] => {
  const parts = row.tokens.flatMap((token) => {
    const name = Array.isArray(token) ? String(token[0]).replace(OPTION_PREFIX, '') : '';
    const part = WILDCARD_PARTS[name];
    return part === undefined ? [] : [part];
  });
  return label
    .split(', ')
    .flatMap((id) => (id.includes('*') ? parts.map((part) => id.replace('*', part)) : [id]));
};
/** Whether a builder rejection names one of the exact rule ids. */
const namesRule = (message: string, ids: string[]): boolean =>
  ids.some((id) => message.includes(`[${id}]`));
/** Rules whose outcome depends on the operand's value, not only on its presence. */
const OPERAND_VALUE_RULE = /switch-track-start-point|-name\b/;
/** Explicit new-branch options and the rule that checks each one's name. */
const NAME_RULES: Record<string, string> = {
  '--create': 'switch-create-name',
  '--force-create': 'switch-force-create-name',
  '--orphan': 'switch-orphan-name',
};

describe('switch and restore completion closure corpus', () => {
  it('matches every argv-decided Git 2.55.0 outcome and preserves serialized argv', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      const result = accepts(row.command as Command, row.tokens, row.argv);
      // Repository-state refusals are delegated to Git, so only accepted argv is compared.
      if (row.delegated) {
        continue;
      }
      if ((result === true) !== row.valid) {
        mismatches.push(`${JSON.stringify(row.argv)}: native=${row.valid}, ${row.diagnostic}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('refuses a delegated row only for an argument error Git reports once the operand resolves', () => {
    const byKey = new Map(
      corpus.cases
        .filter((row) =>
          row.tokens.every((token) => Array.isArray(token) || token.operand === 'side'),
        )
        .map((row) => [resolvedKey(row), row]),
    );
    const unexplained: string[] = [];
    let masked = 0;
    for (const row of corpus.cases.filter((candidate) => candidate.delegated)) {
      const result = accepts(row.command as Command, row.tokens, row.argv);
      if (result === true) {
        // An accepted delegated row must not hide an argument refusal that holds for any operand
        // value; only the operand-dependent name rules may refuse the resolved row alone.
        const resolved = byKey.get(resolvedKey(row));
        const rule = resolved && 'rule' in resolved ? resolved.rule : undefined;
        if (rule !== undefined && !OPERAND_VALUE_RULE.test(rule)) {
          unexplained.push(`${JSON.stringify(row.argv)}: accepted, but side reaches ${rule}`);
        }
        continue;
      }
      // A state refusal (an unresolvable operand) can hide a later argument refusal. The same
      // options with a resolvable operand must reach that argument refusal in Git and the builder.
      // Both rows must be refused for the rule that models the resolved row's Git diagnostic.
      const resolved = byKey.get(resolvedKey(row));
      const rule = resolved && 'rule' in resolved ? resolved.rule : undefined;
      const resolvedResult =
        resolved && accepts(resolved.command as Command, resolved.tokens, resolved.argv);
      if (
        !resolved ||
        resolved === row ||
        resolved.delegated ||
        resolved.valid ||
        rule === undefined ||
        typeof resolvedResult !== 'string' ||
        !namesRule(resolvedResult, ruleIds(rule, resolved)) ||
        !namesRule(result, ruleIds(rule, resolved))
      ) {
        unexplained.push(`${JSON.stringify(row.argv)}: ${row.diagnostic}; builder: ${result}`);
      } else {
        masked += 1;
      }
    }
    expect(unexplained).toEqual([]);
    expect(masked).toBeGreaterThan(0);
  });

  it('accepts every argv that Git accepted, including delegated state checks', () => {
    for (const row of corpus.cases.filter((candidate) => candidate.valid)) {
      expect(accepts(row.command as Command, row.tokens, row.argv), JSON.stringify(row.argv)).toBe(
        true,
      );
    }
  });

  it('refuses the derived --track branch name through its own rule', () => {
    const rows = corpus.cases.filter((row) => /missing branch name; try -c/.test(row.diagnostic));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(accepts('switch', row.tokens, row.argv)).toMatch(/switch-track-start-point/);
    }
  });

  it('refuses invalid new branch names through the rule for the name Git checked', () => {
    const rows = corpus.cases.filter((row) => /is not a valid branch name$/.test(row.diagnostic));
    let explicit = 0;
    let derived = 0;
    for (const row of rows) {
      const name = /^fatal: '(.*)' is not a valid branch name$/.exec(row.diagnostic)?.[1];
      const option = row.tokens.find(
        (token): token is string[] =>
          Array.isArray(token) && token[0] in NAME_RULES && token[1] === name,
      );
      if (option) {
        explicit += 1;
        expect(accepts('switch', row.tokens, row.argv), JSON.stringify(row.argv)).toContain(
          `[${NAME_RULES[option[0] as string]}]`,
        );
      } else {
        // No new-branch option carries the refused name, so it was derived from --track.
        derived += 1;
        expect(
          row.tokens.some((token) => Array.isArray(token) && token[0] in NAME_RULES),
          JSON.stringify(row.argv),
        ).toBe(false);
        expect(accepts('switch', row.tokens, row.argv), JSON.stringify(row.argv)).toContain(
          '[switch-track-start-point]',
        );
      }
    }
    expect(explicit).toBeGreaterThan(0);
    expect(derived).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/diff-plumbing-option-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

type Row = {
  command: 'diff-files' | 'diff-index' | 'diff-tree';
  tokens: readonly unknown[];
  argv: string[];
  valid: boolean;
  diagnostic?: string;
  delegated?: string;
  acceptedIn?: string[];
};

/** Evaluate one row through the production builder; return the rejection message or null. */
function rejection(row: Row): string | null {
  try {
    expect(commandArguments(row.command, row.tokens, true)).toEqual(row.argv);
    return null;
  } catch (error) {
    if (!(error instanceof GitArgumentError)) {
      throw error;
    }
    return error.message;
  }
}

const rows = corpus.cases as Row[];
/** Describe one mismatch with both outcomes for the failure message. */
const describeRow = (row: Row, message: string | null): string =>
  `${JSON.stringify(row.argv)}: native=${row.valid}${row.valid ? '' : ` (${row.diagnostic})`}, wrapper=${message ?? 'accepted'}`;

describe('native diff-files/diff-index/diff-tree max-depth and find-object rules (Git 2.55.0)', () => {
  it('records every command form', () => {
    // Each form is its command plus fixed prefix and operands; -h rows put -h after them.
    const form = (row: Row): string => {
      const words = row.argv.at(-1) === '-h' ? row.argv.slice(0, -1) : row.argv;
      const prefix = ['--cached', '-m', '--merge-base', '-r'].includes(words[1] ?? '')
        ? ` ${words[1]}`
        : '';
      const operands = words.filter((word) => /^HEAD(~1)?$/.test(word)).join(' ');
      return `${row.command}${prefix} ${operands}`.trim();
    };
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[form(row)] = (counts[form(row)] ?? 0) + 1;
    }
    expect(counts).toEqual({
      'diff-files': 26,
      'diff-index HEAD': 26,
      'diff-index --cached HEAD': 26,
      'diff-index -m HEAD': 26,
      'diff-index --merge-base HEAD': 26,
      'diff-tree -r HEAD~1 HEAD': 26,
      'diff-tree -r HEAD~1': 26,
    });
    expect(new Set(rows.map((row) => JSON.stringify(row.argv))).size).toBe(rows.length);
  });

  it('accepts exactly the grammar-decided rows Git accepts and serializes them unchanged', () => {
    const mismatches = rows
      .filter((row) => row.delegated === undefined)
      .map((row) => [row, rejection(row)] as const)
      .filter(([row, message]) => (message === null) !== row.valid)
      .map(([row, message]) => describeRow(row, message));
    expect(mismatches).toEqual([]);
  });

  it('never rejects a repository-dependent row that Git accepted', () => {
    // diff-tree aborts on --find-object with a regex pickaxe bit only when the trees produce a
    // diff queue, so a native refusal there is not a static rule.
    const unsound = rows
      .filter((row) => row.delegated !== undefined && (row.valid || row.acceptedIn !== undefined))
      .map((row) => [row, rejection(row)] as const)
      .filter(([, message]) => message !== null)
      .map(([row, message]) => describeRow(row, message));
    expect(unsound).toEqual([]);
  });
});

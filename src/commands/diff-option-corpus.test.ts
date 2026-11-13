import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/diff-option-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { commandSpecs } from './catalogue.js';

type Row = {
  group: 'options' | 'combinations' | 'operands';
  tokens: readonly unknown[];
  argv: string[];
  valid: boolean;
  diagnostic?: string;
  delegated?: string;
};

/** Evaluate one row through the production builder; return the rejection message or null. */
function rejection(row: Row): string | null {
  try {
    expect(commandArguments('diff', row.tokens, true)).toEqual(row.argv);
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

describe('native diff option grammar, rule combinations and operand forms (Git 2.55.0)', () => {
  it('accepts exactly the grammar-decided rows Git accepts and serializes them unchanged', () => {
    const mismatches = rows
      .filter((row) => row.delegated === undefined)
      .map((row) => [row, rejection(row)] as const)
      .filter(([row, message]) => (message === null) !== row.valid)
      .map(([row, message]) => describeRow(row, message));
    expect(mismatches).toEqual([]);
  });

  it('never rejects a native-owned row that Git accepted', () => {
    // Repository, regex, configuration, diff-content, filesystem and undefined-behavior outcomes
    // stay with Git: a native refusal in the oracle is not a static rule, but a native
    // acceptance must not be refused.
    const unsound = rows
      .filter((row) => row.delegated !== undefined && row.valid)
      .map((row) => [row, rejection(row)] as const)
      .filter(([, message]) => message !== null)
      .map(([row, message]) => describeRow(row, message));
    expect(unsound).toEqual([]);
  });

  it('samples every typed diff option spelling', () => {
    const spec = commandSpecs().diff as { options: Record<string, unknown> };
    // Residual-dispatch words and help are covered by test/fixtures/diff-parser-corpus.json.
    const residual = new Set([
      '-h',
      '--help',
      '--cached',
      '--staged',
      '--merge-base',
      '--base',
      '--ours',
      '--theirs',
      '-q',
    ]);
    const sampled = new Set(
      rows.filter((row) => row.group === 'options').map((row) => (row.tokens[0] as [string])[0]),
    );
    const missing = Object.keys(spec.options).filter(
      (name) => !(residual.has(name) || sampled.has(name)),
    );
    expect(missing).toEqual([]);
  });
});

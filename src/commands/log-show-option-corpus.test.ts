import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/log-show-option-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { commandSpecs } from './catalogue.js';

type Row = {
  command: 'log' | 'show';
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

describe.each([
  'log',
  'show',
] as const)('native %s option grammar, rule combinations and operand forms (Git 2.55.0)', (command) => {
  const own = rows.filter((row) => row.command === command);

  it('accepts exactly the grammar-decided rows Git accepts and serializes them unchanged', () => {
    const mismatches = own
      .filter((row) => row.delegated === undefined)
      .map((row) => [row, rejection(row)] as const)
      .filter(([row, message]) => (message === null) !== row.valid)
      .map(([row, message]) => describeRow(row, message));
    expect(mismatches).toEqual([]);
  });

  it('never rejects a native-owned row that Git accepted', () => {
    // Repository, regex, configuration, content, filesystem, line-range and undefined-behavior
    // outcomes stay with Git: a native refusal there is not a static rule, but a native
    // acceptance must not be refused.
    const unsound = own
      .filter((row) => row.delegated !== undefined && row.valid)
      .map((row) => [row, rejection(row)] as const)
      .filter(([, message]) => message !== null)
      .map(([row, message]) => describeRow(row, message));
    expect(unsound).toEqual([]);
  });

  it('samples every typed option spelling', () => {
    const spec = commandSpecs()[command] as { options: Record<string, unknown> };
    // Help, completion and --end-of-options exits are covered by the parser-exit corpora.
    const exits = new Set([
      '-h',
      '--help',
      '--help-all',
      '--git-completion-helper',
      '--git-completion-helper-all',
      '--end-of-options',
    ]);
    const sampled = new Set(
      own.filter((row) => row.group === 'options').map((row) => (row.tokens[0] as [string])[0]),
    );
    const missing = Object.keys(spec.options).filter(
      (name) => !(exits.has(name) || sampled.has(name)),
    );
    expect(missing).toEqual([]);
  });
});

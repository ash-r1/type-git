import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/pull-closure-corpus.json';
import { hasDashOperand, isLiteralOperandRefusal } from '../../test/support/literal-operand.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

type Row = (typeof corpus.cases)[number];

const FORWARDED_REFUSAL = /forwards the repository/;
const DEEPEN_VALUE_REFUSAL = /^--deepen: invalid integer value x$/;

/** Position of the first help word, or -1. */
function helpIndex(argv: readonly string[]): number {
  return argv.findIndex((word) => word === '-h' || word === '--help-all');
}

/** True when a dash-prefixed operand object comes before any help word. */
function dashOperandBeforeHelp(tokens: Row['tokens']): boolean {
  for (const token of tokens) {
    if (Array.isArray(token)) {
      if (token[0] === '-h' || token[0] === '--help-all') {
        return false;
      }
    } else if (hasDashOperand([token])) {
      return true;
    }
  }
  return false;
}

type Outcome = { kind: 'accepted' | 'refused' | 'literal'; reason?: string };

/** The strict API's outcome for a corpus row, checking the serialized argv when it accepts. */
function outcome(row: Row): Outcome {
  try {
    expect(commandArguments('pull', row.tokens as never, true)).toEqual(row.argv);
    return { kind: 'accepted' };
  } catch (error) {
    if (error instanceof GitArgumentError) {
      // Pull forwards its operands to fetch without a separator, so its scope refuses every
      // dash-prefixed operand object as well (the forwardedOperands policy).
      const forwarded = hasDashOperand(row.tokens) && FORWARDED_REFUSAL.test(error.message);
      const literal = isLiteralOperandRefusal(row.tokens, error) || forwarded;
      return { kind: literal ? 'literal' : 'refused', reason: error.message };
    }
    throw error;
  }
}

describe('pull completion closure corpus', () => {
  it('matches every independent Git 2.55.0 outcome and preserves serialized argv', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      // Refusals that depend on configuration, remote state or ref lookup are left to native Git.
      if (row.state) {
        continue;
      }
      const result = outcome(row);
      const accepted = result.kind === 'accepted';
      // Native acceptance of an operand object read as an option is a deliberate refusal, but
      // only when the operand is reached: a help word before it exits first.
      if (row.valid && dashOperandBeforeHelp(row.tokens)) {
        if (result.kind !== 'literal') {
          mismatches.push(`${JSON.stringify(row.argv)}: expected a literal-operand refusal`);
        }
        continue;
      }
      // type-git restriction: pull's scope checks a forwarded --deepen value when it is parsed,
      // so an invalid value before -h or --help-all is refused although Git prints usage first.
      const deepenBeforeHelp =
        row.usage &&
        !accepted &&
        result.kind === 'refused' &&
        DEEPEN_VALUE_REFUSAL.test(result.reason ?? '') &&
        row.argv.includes('--deepen=x') &&
        row.argv.indexOf('--deepen=x') < helpIndex(row.argv);
      if (accepted !== row.valid && !deepenBeforeHelp) {
        mismatches.push(
          `${JSON.stringify(row.argv)}: native=${row.valid}, wrapper=${accepted}, ${row.diagnostic}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});

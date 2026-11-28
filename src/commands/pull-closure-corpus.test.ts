import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/pull-closure-corpus.json';
import { hasDashOperand, isLiteralOperandRefusal } from '../../test/support/literal-operand.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

type Row = (typeof corpus.cases)[number];

const FORWARDED_REFUSAL = /forwards the repository/;

/** The strict API's outcome for a corpus row, checking the serialized argv when it accepts. */
function outcome(row: Row): 'accepted' | 'refused' | 'literal' {
  try {
    expect(commandArguments('pull', row.tokens as never, true)).toEqual(row.argv);
    return 'accepted';
  } catch (error) {
    if (error instanceof GitArgumentError) {
      // Pull forwards its operands to fetch without a separator, so its scope refuses every
      // dash-prefixed operand object as well (the forwardedOperands policy).
      const forwarded = hasDashOperand(row.tokens) && FORWARDED_REFUSAL.test(error.message);
      return isLiteralOperandRefusal(row.tokens, error) || forwarded ? 'literal' : 'refused';
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
      const accepted = result === 'accepted';
      // Native acceptance of an operand object read as an option is a deliberate refusal.
      if (row.valid && result === 'literal') {
        continue;
      }
      // type-git restriction: pull's scope checks a forwarded --deepen value when it is parsed,
      // so an invalid value before -h is refused although Git prints usage first.
      const deepenBeforeHelp =
        row.usage &&
        !accepted &&
        row.argv.includes('--deepen=x') &&
        row.argv.indexOf('--deepen=x') < row.argv.indexOf('-h');
      if (accepted !== row.valid && !deepenBeforeHelp) {
        mismatches.push(
          `${JSON.stringify(row.argv)}: native=${row.valid}, wrapper=${accepted}, ${row.diagnostic}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});

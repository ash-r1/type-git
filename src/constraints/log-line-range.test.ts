import { describe, expect, it } from 'vitest';
import fixture from '../../test/fixtures/diff-log-show-closure-corpus.json';
import { commandArguments } from '../commands/build.js';
import { GitArgumentError } from '../core/types.js';
import { validLogLineRange } from './log-line-range.js';

/** Whether the strict builder accepts one -L value for git log or git show. */
function builderAccepts(command: 'log' | 'show', value: string): boolean {
  try {
    expect(commandArguments(command, [['-L', value]], true)).toEqual([command, '-L', value]);
    return true;
  } catch (error) {
    if (!(error instanceof GitArgumentError)) {
      throw error;
    }
    return false;
  }
}

const corpus = { cases: fixture.lineRanges };

describe('git log/show -L syntax', () => {
  /** Syntax refusals keyed by command and value. */
  const syntax = new Set(
    corpus.cases
      .filter((row) => !(row.valid || row.state))
      .map((row) => `${row.command} ${row.value}`),
  );
  /**
   * Whether the outcome for a row is consistent with Git. Syntax rows must be refused and
   * accepted rows accepted. A file-dependent row must be refused exactly when Git refuses it in
   * every state: Git resolves the file and a /regex/ start (and may fail there) before it checks
   * the numbers, so the row must be refused when the same range with an existing file `a` and a
   * numeric start is a syntax refusal, which Git reaches whenever the file and the regex resolve,
   * and accepted otherwise.
   */
  function expected(row: (typeof corpus.cases)[number], accepted: boolean): boolean {
    if (!row.state) {
      return accepted === row.valid;
    }
    return accepted !== syntaxInEveryState(row);
  }

  /** Whether a file-dependent row's range is a syntax refusal once the file and regex resolve. */
  function syntaxInEveryState(row: (typeof corpus.cases)[number]): boolean {
    if (row.range === undefined || row.suffix === undefined) {
      return false;
    }
    const comma = row.range.indexOf(',');
    const range = /^\^?\//.test(row.range) && comma > 0 ? `1${row.range.slice(comma)}` : row.range;
    return syntax.has(`${row.command} ${range}:a`);
  }

  it('refuses the values that Git 2.55.0 refuses from the text alone, and only those', () => {
    const mismatches = corpus.cases
      .filter((row) => !expected(row, validLogLineRange(row.value)))
      .map((row) => `${row.command} -L ${JSON.stringify(row.value)}: ${row.diagnostic}`);
    expect(mismatches).toEqual([]);
  });

  it('applies the check in the strict builder for log and show', () => {
    const mismatches = corpus.cases
      .filter((row) => !expected(row, builderAccepts(row.command as 'log' | 'show', row.value)))
      .map((row) => `${row.command} -L ${JSON.stringify(row.value)}: ${row.diagnostic}`);
    expect(mismatches).toEqual([]);
  });

  it('refuses a /regex/ scan that ends in a backslash, where Git reads past the argument', () => {
    expect(validLogLineRange('/b\\')).toBe(false);
    expect(validLogLineRange('1,/b\\')).toBe(false);
    expect(validLogLineRange('^/b\\')).toBe(false);
    // An escaped character inside a terminated scan is fine.
    expect(validLogLineRange('/b\\//,+1:a')).toBe(true);
    // The :funcname scan does not step past a final backslash.
    expect(validLogLineRange(':f\\')).toBe(false);
  });

  it('refuses non-string values', () => {
    expect(validLogLineRange(1)).toBe(false);
    expect(validLogLineRange(undefined)).toBe(false);
  });
});

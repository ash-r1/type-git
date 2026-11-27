import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/diff-log-show-closure-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

/** Evaluate one corpus row through the production builder, keeping only argument rejections. */
function wrapperAccepts(row: { command: string; tokens: unknown[]; argv: string[] }): boolean {
  try {
    expect(commandArguments(row.command as GitCommandName, row.tokens as never, true)).toEqual(
      row.argv,
    );
    return true;
  } catch (error) {
    if (!(error instanceof GitArgumentError)) {
      throw error;
    }
    return false;
  }
}

describe('log/show count options against Git 2.55.0', () => {
  const crashes = new Set(
    corpus.counts
      .filter((row) => row.crash)
      .map((row) => `${row.command} ${JSON.stringify(row.tokens)}`),
  );

  it('refuses every sequence that Git refuses or crashes on, and accepts the rest', () => {
    const mismatches = corpus.counts
      .filter((row) => {
        const accepted = wrapperAccepts(row);
        const missing = JSON.stringify(row.tokens.slice(-2)) === '[["--"],{"operand":"missing"}]';
        if (row.valid && !accepted && missing) {
          // The walk yields no commit for '-- missing', so Git does not crash; the same counts
          // crash whenever it does, so refusing them is still required.
          const tokens = row.tokens.slice(0, -2);
          return !crashes.has(`${row.command} ${JSON.stringify(tokens)}`);
        }
        return accepted !== row.valid;
      })
      .map((row) => `${JSON.stringify(row.argv)}: ${row.diagnostic || 'accepted'}`);
    expect(mismatches).toEqual([]);
  });

  it('witnesses the crash with a walk that yields commits', () => {
    expect(crashes.size).toBeGreaterThan(0);
  });
});

describe('git diff --cached without revisions against Git 2.55.0', () => {
  /** Rows without a revision operand or -h, keyed by argv, under UTC. */
  const utc = new Map(
    corpus.ages.filter((row) => row.zone === 'UTC').map((row) => [JSON.stringify(row.argv), row]),
  );

  it('refuses a date or age filter in the HEAD-by-hand index branch', () => {
    const mismatches = corpus.ages
      .filter((row) => {
        const accepted = wrapperAccepts(row);
        if (row.argv.includes('-h')) {
          // -h exits with usage in the residual loop before the filter check.
          return !accepted || row.valid;
        }
        if (row.argv.includes('HEAD')) {
          // A revision operand may select another mode; it is delegated.
          return !accepted;
        }
        if (row.zone !== 'UTC') {
          // Under TZ=Asia/Tokyo one text names the second before the epoch and leaves the
          // filter at its default; the wrapper refuses date text in every zone.
          return accepted !== utc.get(JSON.stringify(row.argv))?.valid;
        }
        return accepted !== row.valid;
      })
      .map((row) => `${row.zone} ${JSON.stringify(row.argv)}: ${row.diagnostic || 'accepted'}`);
    expect(mismatches).toEqual([]);
  });

  it('records the time-zone exception natively', () => {
    const exceptions = corpus.ages.filter(
      (row) => row.valid && !utc.get(JSON.stringify(row.argv))?.valid,
    );
    expect(exceptions.map((row) => row.argv.join(' '))).toContain(
      'diff --cached --since=1970-01-01 08:59:59',
    );
  });
});

describe('git diff completion words against Git 2.55.0', () => {
  it('accepts a sole completion word, refuses it after other words and in --no-index', () => {
    const mismatches = corpus.completion
      .filter((row) => {
        const accepted = wrapperAccepts(row);
        // A restriction: Git also exits on the word when it is the last one before "--"
        // after other words; the typed API accepts it only alone.
        // After "--" the word is a path operand.
        // diff --no-index ends in usage for every completion word.
        if (row.command === 'diff --no-index') {
          return row.valid || accepted;
        }
        const exact = row.tokens.length === 1 || row.argv[1] === '--';
        return exact ? accepted !== row.valid : accepted;
      })
      .map((row) => `${JSON.stringify(row.argv)}: ${row.diagnostic || 'accepted'}`);
    expect(mismatches).toEqual([]);
  });
});

describe('git diff with a bare - against Git 2.55.0', () => {
  it('refuses - before the separator and accepts it as a path after it', () => {
    const mismatches = corpus.dash
      .filter((row) => wrapperAccepts(row) !== row.valid)
      .map((row) => `${JSON.stringify(row.argv)}: ${row.diagnostic || 'accepted'}`);
    expect(mismatches).toEqual([]);
  });
});

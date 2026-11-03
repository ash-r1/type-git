import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/pull-forwarding-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments, commandUsesIntegerProfile } from './build.js';
import { COMMAND_SPECS } from './generated.js';

const FORWARDING_RULES = [
  'cli.pull.deepen-minimum',
  'cli.pull.deepen-depth',
  'cli.pull.deepen-unshallow',
  'cli.pull.depth-initial',
  'cli.pull.jobs-forwarded',
  'cli.pull.jobs-valueless',
];
/** Wrapper rules that deliberately narrow argv Git accepts; native success is expected there. */
const NARROWING = /\[(cli\.pull\.jobs-valueless)\]|forwarded operand/;

/** Classify one corpus row through the production serializer and final rules. */
function wrapperOutcome(tokens: readonly unknown[]): { accepted: boolean; message: string } {
  try {
    commandArguments('pull', tokens, true);
    return { accepted: true, message: '' };
  } catch (error) {
    if (!(error instanceof GitArgumentError)) {
      throw error;
    }
    return { accepted: false, message: error.message };
  }
}

describe('native git pull forwarding to fetch', () => {
  it('matches the independent native corpus and preserves serialized argv', () => {
    const mismatches: string[] = [];
    const narrowedRows: string[][] = [];
    for (const row of corpus.cases) {
      const outcome = wrapperOutcome(row.tokens);
      if (outcome.accepted) {
        expect(commandArguments('pull', row.tokens, true)).toEqual(row.argv);
      }
      const narrowed = !outcome.accepted && row.valid && NARROWING.test(outcome.message);
      if (narrowed) {
        narrowedRows.push(row.argv);
      }
      if (outcome.accepted !== row.valid && !narrowed) {
        mismatches.push(
          `${JSON.stringify(row.argv)}: native=${row.valid}, wrapper=${outcome.accepted}, ${row.diagnostic}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
    // Only the documented valueless-count successes may differ from native acceptance.
    expect(narrowedRows).toEqual([
      ['pull', '-j', '2'],
      ['pull', '--jobs', '2'],
    ]);
  });

  it('reaches every forwarding rule through a native refusal', () => {
    const reached = new Set<string>();
    for (const row of corpus.cases.filter((candidate) => !candidate.valid)) {
      for (const [, id] of wrapperOutcome(row.tokens).message.matchAll(
        /\[(cli\.pull\.[\w-]+)\]/g,
      )) {
        reached.add(id as string);
      }
    }
    const declared = COMMAND_SPECS.pull.rules.map((rule) => rule.id);
    expect(declared).toEqual(expect.arrayContaining(FORWARDING_RULES));
    expect([...reached].filter((id) => FORWARDING_RULES.includes(id)).sort()).toEqual(
      [...FORWARDING_RULES].sort(),
    );
  });

  it('records native reinterpretation of every forwarded dash-prefixed operand', () => {
    const probes = corpus.cases.filter((row) => row.argv.includes('--type-git-forwarded-probe'));
    expect(probes.length).toBeGreaterThan(0);
    for (const row of probes) {
      // Fetch parsed the forwarded word as an option, even after pull's own --.
      expect(row.diagnostic).toBe("error: unknown option `type-git-forwarded-probe'");
      const afterSeparator = row.argv.indexOf('--') >= 0;
      expect(wrapperOutcome(row.tokens).message).toMatch(
        afterSeparator ? /forwarded operand/ : /forwarded operand|explicit \["--"\] separator/,
      );
    }
    // A lone dash is a fetch operand, not an option.
    expect(commandArguments('pull', [['--'], { operand: '-' }], true)).toEqual(['pull', '--', '-']);
  });

  it('documents the valueless jobs narrowing with native successes', () => {
    // Without --dry-run a valueless count consumes the forwarded repository word.
    const reinterpreted = corpus.cases.filter((row) => !row.dryRun && row.valid);
    expect(reinterpreted.map((row) => row.argv)).toEqual(
      expect.arrayContaining([
        ['pull', '-j', '2'],
        ['pull', '--jobs', '2'],
      ]),
    );
    for (const row of reinterpreted) {
      expect(wrapperOutcome(row.tokens).message).toMatch(/cli\.pull\.jobs-valueless/);
    }
  });
});

describe('forwarded pull jobs integer profiles', () => {
  it('selects the integer profile for the final scalar jobs rule', () => {
    // Expected outcomes follow Git 2.25.1 fetch's strtol-based OPT_INTEGER (decimal-cast) and the
    // Git 2.55.0 bounded parser with k/m/g suffixes; only the 2.55.0 side is replayed natively.
    const accepted = (value: string, integerProfile: 'bounded' | 'decimal-cast') => {
      try {
        commandArguments('pull', [['--jobs', value]], true, {
          longBits: 64,
          sizeTBits: 64,
          integerProfile,
        });
        return true;
      } catch (error) {
        if (!(error instanceof GitArgumentError)) {
          throw error;
        }
        return false;
      }
    };
    expect(commandUsesIntegerProfile('pull', [['--jobs', '1k']])).toBe(true);
    expect(accepted('1k', 'bounded')).toBe(true);
    expect(accepted('1k', 'decimal-cast')).toBe(false);
    expect(accepted('2147483648', 'bounded')).toBe(false);
    expect(accepted('4294967298', 'decimal-cast')).toBe(true);
    expect(accepted('2', 'decimal-cast')).toBe(true);
  });
});

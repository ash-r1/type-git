import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/status-closure-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

/** Typed status rules, keyed by the native diagnostic of the refusal site they model. */
const RULE_FOR_DIAGNOSTIC: [RegExp, string][] = [
  [/^fatal: options '--long' and '-z' cannot be used together$/, 'cli.status.long-nul'],
  [/^fatal: Invalid untracked files mode/, 'cli.status.untracked'],
  [/^fatal: Invalid ignored mode/, 'cli.status.ignored'],
  [
    /^fatal: Unsupported combination of ignored and untracked-files/,
    'cli.status.ignored-untracked',
  ],
  [/^fatal: bad --ignore-submodules argument/, 'cli.status.ignore-submodules'],
  [/^fatal: empty string is not a valid pathspec/, 'cli.status.empty-pathspec'],
];

describe('status completion closure corpus', () => {
  it('matches every independent Git 2.55.0 outcome and preserves serialized argv', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      let accepted = false;
      try {
        expect(commandArguments('status', row.tokens, true)).toEqual(row.argv);
        accepted = true;
      } catch (error) {
        if (!(error instanceof GitArgumentError)) {
          throw error;
        }
      }
      if (accepted !== row.valid) {
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
        commandArguments('status', row.tokens, true);
      } catch (error) {
        // The first refusal Git reaches is the one the typed rules must report.
        if (error instanceof GitArgumentError && error.message.includes(`[${rule}]`)) {
          reached.add(rule);
        }
      }
    }
    expect([...reached].sort()).toEqual(RULE_FOR_DIAGNOSTIC.map(([, rule]) => rule).sort());
  });

  it('spells an empty short untracked value as the long form, which means no', () => {
    // A bare -u means all, while an empty value means no; only the long form can carry it.
    expect(commandArguments('status', [['-u', '']], true)).toEqual([
      'status',
      '--untracked-files=',
    ]);
    expect(() =>
      commandArguments(
        'status',
        [
          ['-u', ''],
          ['--ignored', 'matching'],
        ],
        true,
      ),
    ).toThrow(GitArgumentError);
  });
});

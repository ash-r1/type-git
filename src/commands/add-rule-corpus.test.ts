import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/add-rule-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';

describe('native git add final rules', () => {
  it('matches the independent native corpus and preserves serialized argv', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      let accepted = false;
      try {
        expect(commandArguments('add', row.tokens, true)).toEqual(row.argv);
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

  it('reaches every typed add rule through a native refusal', () => {
    const reached = new Set<string>();
    for (const row of corpus.cases.filter((candidate) => !candidate.valid)) {
      try {
        commandArguments('add', row.tokens, true);
      } catch (error) {
        for (const [, id] of String((error as Error).message).matchAll(/\[(cli\.add\.[\w-]+)\]/g)) {
          reached.add(id as string);
        }
      }
    }
    const rules = COMMAND_SPECS.add.rules
      .map((rule) => rule.id)
      .filter((id) => id.startsWith('cli.add.'));
    expect([...reached].sort()).toEqual([...new Set(rules)].sort());
  });

  it('keeps the Git 2.25.1 filename-pointer outcomes for final add rules', () => {
    // Observed with Git 2.25.1: --no-pathspec-from-file clears the pointer and an empty
    // value stays a nonnull file name, the reverse of Git 2.55.0 in both cases.
    const legacy: [readonly unknown[], boolean][] = [
      [
        [
          ['-n'],
          ['--pathspec-from-file', '../paths'],
          ['--no-pathspec-from-file'],
          { operand: 'file' },
        ],
        true,
      ],
      [[['--pathspec-from-file', '../paths'], ['--no-pathspec-from-file'], ['-e']], true],
      [
        [
          ['--pathspec-from-file', '../paths'],
          ['--no-pathspec-from-file'],
          ['--pathspec-file-nul'],
        ],
        false,
      ],
      [[['-n'], ['--pathspec-from-file', ''], { operand: 'file' }], false],
      [[['-e'], ['--pathspec-from-file', '']], false],
    ];
    for (const [tokens, valid] of legacy) {
      const run = (profile: 'legacy' | 'optional') =>
        commandArguments('add', tokens, true, undefined, undefined, undefined, profile);
      const accepted = (profile: 'legacy' | 'optional') => {
        try {
          run(profile);
          return true;
        } catch (error) {
          if (!(error instanceof GitArgumentError)) {
            throw error;
          }
          return false;
        }
      };
      expect(accepted('legacy')).toBe(valid);
      // The pinned 2.55.0 corpus records the opposite outcome for every listed case.
      expect(accepted('optional')).toBe(!valid);
    }
  });
});

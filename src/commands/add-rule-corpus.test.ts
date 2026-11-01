import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/add-rule-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';

const EMPTY_PATHSPEC_RULE = /cli\.add\.empty-pathspec/;

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

  it('leaves empty operands in final edit mode to native revision parsing', () => {
    // Edit mode passes operands to setup_revisions instead of parse_pathspec; the corpus does not
    // record those state-dependent outcomes, so the wrapper must not claim a static refusal.
    expect(commandArguments('add', [['-e'], { operand: '' }], true)).toEqual(['add', '-e', '']);
    for (const tokens of [
      [['-e'], ['--no-edit'], { operand: '' }],
      [['-e'], ['-i'], { operand: '' }],
      [['-e'], ['-p'], { operand: '' }],
    ] as const) {
      expect(() => commandArguments('add', tokens, true)).toThrow(EMPTY_PATHSPEC_RULE);
    }
  });

  it('separates the legacy and optional filename-pointer profiles for final add rules', () => {
    // Expected outcomes were transcribed by hand from a Git 2.25.1 build and are not replayed
    // here: this test only checks the profile emulation. Under the legacy profile
    // --no-pathspec-from-file clears the pointer and an empty value stays a nonnull file name.
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
      // Git 2.55.0 reverses each outcome: --no- keeps the pointer and an empty value clears it.
      expect(accepted('optional')).toBe(!valid);
    }
  });
});

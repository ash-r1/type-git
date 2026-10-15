import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/mandatory-subcommand-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

describe('mandatory native subcommand selection', () => {
  it('preserves the selected integer implementation through parent dispatch', () => {
    const args = [{ operand: 'list' }, ['--count', '2147483648'], ['-h']];
    const child = [['--count', '2147483648'], ['-h']];
    const bounded = { longBits: 64, sizeTBits: 64, integerProfile: 'bounded' } as const;
    const narrowed = { ...bounded, integerProfile: 'decimal-cast' } as const;
    expect(() => commandArguments('refs list', child, true, bounded)).toThrow(GitArgumentError);
    expect(() => commandArguments('refs', args, true, bounded)).toThrow(GitArgumentError);
    expect(commandArguments('refs', args, true, narrowed)).toEqual(
      commandArguments('refs list', child, true, narrowed),
    );
    expect(commandArguments('refs', args, true, narrowed)).toEqual([
      'refs',
      'list',
      '--count=2147483648',
      '-h',
    ]);
  });

  it('matches the independent native dispatch and child grammar outcomes', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      let accepted = false;
      try {
        expect(commandArguments('refs', row.tokens, true)).toEqual(row.argv);
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
});

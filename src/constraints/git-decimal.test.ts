import { describe, expect, it } from 'vitest';
import { commandArguments } from '../commands/build.js';
import { parseGitDecimal, type GitDecimalParser } from './git-decimal.js';

const mainline: GitDecimalParser = {
  kind: 'decimal',
  longBits: 64,
  bits: 32,
  signed: true,
  conversion: 'cast',
  positive: true,
};

describe('selected C long decimal callback stages', () => {
  it('saturates strtol before assigning int and testing positivity', () => {
    expect(parseGitDecimal('2147483648', mainline, undefined, 32)).toEqual({
      valid: true,
      value: 2147483647,
    });
    expect(parseGitDecimal('2147483648', mainline, undefined, 64)).toEqual({ valid: false });
    expect(parseGitDecimal('-4294967295', mainline, undefined, 32)).toEqual({ valid: false });
    expect(parseGitDecimal('-4294967295', mainline, undefined, 64)).toEqual({
      valid: true,
      value: 1,
    });
  });

  it('uses the same selected width for option transitions and final scalar rules', () => {
    const args = [['--mainline', '2147483648'], ['-h']];
    expect(commandArguments('cherry-pick', args, true, { longBits: 32, sizeTBits: 64 })).toEqual([
      'cherry-pick',
      '--mainline=2147483648',
      '-h',
    ]);
    expect(() =>
      commandArguments('cherry-pick', args, true, { longBits: 64, sizeTBits: 64 }),
    ).toThrow('invalid integer');
    expect(
      commandArguments('describe', [['--abbrev', '4294967296'], ['--long']], true, {
        longBits: 32,
        sizeTBits: 64,
      }),
    ).toEqual(['describe', '--abbrev=4294967296', '--long']);
    expect(() =>
      commandArguments('describe', [['--abbrev', '4294967296'], ['--long']], true, {
        longBits: 64,
        sizeTBits: 64,
      }),
    ).toThrow();
  });
});

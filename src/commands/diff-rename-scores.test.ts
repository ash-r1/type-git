import { describe, expect, it } from 'vitest';
import { validStringCallback } from '../constraints/string-callback.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';

const flags = ['--break-rewrites', '-B', '--find-renames', '-M', '--find-copies', '-C'] as const;
describe('shared diff rename/copy score callbacks', () => {
  it('keeps the source digit/dot/percent language and bare optional arguments', () => {
    for (const flag of flags) {
      expect(commandArguments('diff', [[flag], ['-h']])).toContain(flag);
      for (const value of [
        '',
        '.',
        '%',
        '.%',
        '0',
        '000',
        '.5',
        '1.',
        '50%',
        '1000',
        '123456789012345678901234567890',
      ]) {
        const canonical =
          flag === '-B'
            ? '--break-rewrites'
            : flag === '-M'
              ? '--find-renames'
              : flag === '-C'
                ? '--find-copies'
                : flag;
        const expected = flag.startsWith('--')
          ? `${flag}=${value}`
          : value === ''
            ? `${canonical}=`
            : `${flag}${value}`;
        expect(commandArguments('diff', [[flag, value], ['-h']])).toContain(expected);
      }
      for (const value of [
        'bad',
        '+1',
        '-1',
        ' 5',
        '5 ',
        '5\n',
        '1e2',
        '0x10',
        '1..2',
        '5%%',
        '5%0',
        'é',
      ]) {
        expect(() => commandArguments('diff', [[flag, value], ['-h']])).toThrow();
      }
      expect(() => commandArguments('diff', [[flag, true]])).toThrow();
    }
    expect(validStringCallback('diff-rename-score', true)).toBe(true);
    expect(validStringCallback('diff-rename-score', false)).toBe(false);
  });
  it('limits slash pairs to break rewrites without normalizing scores', () => {
    for (const value of ['/', '50%/60%', '/50%', '50%/', '.%/.5']) {
      for (const flag of ['-B', '--break-rewrites'] as const) {
        const expected = flag === '-B' ? `-B${value}` : `${flag}=${value}`;
        expect(commandArguments('diff', [[flag, value]])).toContain(expected);
      }
      for (const flag of ['-M', '-C', '--find-renames', '--find-copies'] as const) {
        expect(() => commandArguments('diff', [[flag, value]])).toThrow();
      }
    }
    expect(() => commandArguments('diff', [['-B', '1/2/3']])).toThrow();
  });
  it('uses callback identity and preserves local shadowing and deferred help', () => {
    expect(COMMAND_SPECS.blame.options['-M'].key).toBe('M');
    expect(COMMAND_SPECS.blame.options['-C'].key).toBe('C');
    expect(COMMAND_SPECS.pickaxe.options['-M'].key).toBe('M');
    expect(COMMAND_SPECS.pickaxe.options['-C'].key).toBe('C');
    expect(() => commandArguments('blame', [['--find-copies', 'bad'], ['-h']])).toThrow();
    expect(commandArguments('blame', [['-C', 'bad'], ['-h']])).toContain('-Cbad');
    expect(commandArguments('log', [['--find-renames', 'bad'], ['-h']])).toContain(
      '--find-renames=bad',
    );
    expect(commandArguments('difftool', [['-M', 'bad'], ['--tool-help']])).toContain('-Mbad');
    expect(() =>
      commandArguments('difftool', [['-M', 'bad'], ['--tool-help'], ['--no-tool-help']]),
    ).toThrow();
    expect(() => commandArguments('diff', [['-h'], ['-M', 'bad']])).toThrow();
    expect(() =>
      commandArguments('diff', [
        ['-M', 'bad'],
        ['-M', '50'],
      ]),
    ).toThrow();
    expect(() => commandArguments('log', [['-h'], ['-M', '\0']])).toThrow();
  });
});

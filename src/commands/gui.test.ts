import { describe, expect, it } from 'vitest';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

describe('GUI source grammar (native Tcl/Tk execution remains unaudited)', () => {
  it('selects each GUI entrypoint and preserves citool prefix options', () => {
    expect(commandArguments('gui', [], true)).toEqual(['gui']);
    for (const command of ['gui gui', 'gui pick', 'gui citool', 'citool'] as const) {
      expect(commandArguments(command, [], true)).toEqual(command.split(' '));
      expect(() => commandArguments(command, [{ operand: 'extra' }], true)).toThrow(
        GitArgumentError,
      );
    }
    expect(
      commandArguments(
        'gui',
        [{ operand: 'citool' }, ['--amend'], ['--nocommit'], ['--commitmsg']],
        true,
      ),
    ).toEqual(['gui', 'citool', '--amend', '--nocommit', '--commitmsg']);
    expect(() => commandArguments('gui', [{ operand: 'unknown' }], true)).toThrow(GitArgumentError);
  });
  it('keeps browser revisions, paths and separator placement distinct', () => {
    expect(
      commandArguments('gui browser', [{ operand: 'HEAD' }, ['--'], { operand: 'src' }], true),
    ).toEqual(['gui', 'browser', 'HEAD', '--', 'src']);
    expect(() =>
      commandArguments('gui browser', [['--'], { operand: 'HEAD' }, { operand: 'src' }], true),
    ).toThrow(GitArgumentError);
    expect(() => commandArguments('gui browser', [], true)).toThrow(GitArgumentError);
    expect(commandArguments('gui browser', [{ operand: '--' }], true)).toEqual([
      'gui',
      'browser',
      '--',
    ]);
  });
  it('checks blame line selector order while allowing line-like literal filenames', () => {
    expect(
      commandArguments(
        'gui blame',
        [['--trace'], ['--line', 0], { operand: 'HEAD' }, ['--'], { operand: 'file' }],
        true,
      ),
    ).toEqual(['gui', 'blame', '--trace', '--line=0', 'HEAD', '--', 'file']);
    expect(commandArguments('gui blame', [{ operand: '--line=2' }], true)).toEqual([
      'gui',
      'blame',
      '--line=2',
    ]);
    for (const args of [
      [['--line', 1]],
      [['--line', -1], { operand: 'file' }],
      [{ operand: 'HEAD' }, ['--line', 2], { operand: 'file' }],
      [['--line', 1], ['--line', 2], { operand: 'file' }],
    ]) {
      expect(() => commandArguments('gui blame', args, true)).toThrow(GitArgumentError);
    }
  });
});

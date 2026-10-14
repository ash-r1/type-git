import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';
import { guiGrammarFromSource, validateGuiArguments } from './gui-syntax.js';

describe('GUI raw-word grammar', () => {
  it('preserves the three observed old/new frontend disagreements', () => {
    for (const argv of [
      ['gui', 'browser', '--', 'tracked', 'extra'],
      ['gui', 'browser', '--', 'HEAD', 'path'],
      ['gui', 'blame', 'HEAD', '--line=2', 'tracked'],
    ]) {
      expect(() => validateGuiArguments(argv, 'path-loop')).not.toThrow();
      expect(() => validateGuiArguments(argv)).not.toThrow();
      expect(() => validateGuiArguments(argv, 'positional')).toThrow();
    }
  });

  it('does not claim a legacy browser line-looking word is unconditionally an option', () => {
    // Native probes: a tracked --line=2 directory wins file-exists detection and
    // opens the browser with exit 0; without that path, jump_spec leads to usage 1.
    expect(() =>
      validateGuiArguments(['gui', 'browser', '--line=2', 'path'], 'path-loop'),
    ).not.toThrow();
    expect(() =>
      validateGuiArguments(['gui', 'browser', '--line=2', 'path'], 'positional'),
    ).toThrow();
  });

  it('uses the final word as a path before recognizing line syntax', () => {
    expect(commandArguments('gui blame', [['--line', 2]], true, undefined, 'positional')).toEqual([
      'gui',
      'blame',
      '--line=2',
    ]);
    expect(
      commandArguments(
        'gui blame',
        [['--line', -1], { operand: 'tracked' }],
        true,
        undefined,
        'positional',
      ),
    ).toEqual(['gui', 'blame', '--line=-1', 'tracked']);
    expect(() =>
      validateGuiArguments(['gui', 'blame', '--line=2\n', 'HEAD', 'tracked'], 'positional'),
    ).toThrow();
  });

  it('removes only the first trace word without moving any emitted word', () => {
    const args = [{ operand: 'browser' }, ['--trace'], ['--trace'], { operand: 'tracked' }];
    expect(commandArguments('gui', args, true, undefined, 'positional')).toEqual([
      'gui',
      'browser',
      '--trace',
      '--trace',
      'tracked',
    ]);
    expect(
      commandArguments(
        'gui browser',
        [{ operand: '--trace' }, { operand: 'tracked' }],
        true,
        undefined,
        'positional',
      ),
    ).toEqual(['gui', 'browser', '--trace', 'tracked']);
    expect(() => commandArguments('gui browser', [{ operand: '--trace' }], true)).toThrow();
  });

  it('separates direct-Tcl launch from shell-only shortcuts and workdir preprocessing', () => {
    expect(() => validateGuiArguments(['gui', '--version'], 'positional', 'direct-tcl')).toThrow();
    expect(() => validateGuiArguments(['citool', 'version'], 'positional', 'direct-tcl')).toThrow();
    expect(() =>
      validateGuiArguments(
        ['gui', '--working-dir', '/fixture', 'browser', '.'],
        'positional',
        'direct-tcl',
      ),
    ).not.toThrow();
    expect(() =>
      validateGuiArguments(
        ['gui', '--working-dir', '/fixture', 'browser', '.'],
        'positional',
        'shell-prelude',
      ),
    ).toThrow();
  });

  it('does not guess a frontend profile from a version string or partial source', () => {
    expect(guiGrammarFromSource('git version 2.55.0')).toBeUndefined();
    expect(
      guiGrammarFromSource(
        '# -- Not a normal commit type invocation?\nset maxargs 3\n# -- Branch Control',
      ),
    ).toBeUndefined();
  });
});

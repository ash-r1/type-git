import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';

describe('shared parse-options color callback', () => {
  it('validates exact case-insensitive names when grep reaches the callback', () => {
    for (const value of ['always', 'AUTO', 'never', 'NeVeR']) {
      expect(commandArguments('grep', [['--color', value], ['--help-all']])).toContain(
        `--color=${value}`,
      );
    }
    for (const value of [
      'bad',
      '',
      'true',
      'false',
      '0',
      '1',
      ' always',
      'always ',
      'always\n',
      'ＡＵＴＯ',
    ]) {
      expect(() => commandArguments('grep', [['--color', value], ['--help-all']])).toThrow(
        'unsupported option value',
      );
      expect(commandArguments('grep', [['--help-all'], ['--color', value]])).toContain(
        '--help-all',
      );
    }
    expect(() =>
      commandArguments('grep', [['--color', 'bad'], ['--color', 'always'], ['--help-all']]),
    ).toThrow('unsupported option value');
  });

  it('preserves bare and negated defaults and the public optional-string shape', () => {
    expect(commandArguments('grep', [['--color'], ['--help-all']])).toContain('--color');
    expect(commandArguments('grep', [['--no-color'], ['--help-all']])).toContain('--no-color');
    expect(COMMAND_SPECS.grep.options['--no-color']).toMatchObject({ value: 'flag', set: 'never' });
    expect(() => commandArguments('grep', [['--color', true], ['--help-all']])).toThrow();
    expect(() => commandArguments('grep', [['--no-color', 'always'], ['--help-all']])).toThrow();
    expect(() => commandArguments('grep', [['--help-all'], ['--color', 'always\0']])).toThrow();
  });

  it('keeps shared vocabularies and delegated help boundaries across commands', () => {
    for (const name of [
      'branch',
      'tag',
      'show-branch',
      'for-each-ref',
      'refs list',
      'grep',
      'diff',
    ] as const) {
      expect(COMMAND_SPECS[name].options['--color'].allowed).toEqual(['always', 'auto', 'never']);
      expect(COMMAND_SPECS[name].options['--color'].caseInsensitive).toBe(true);
      expect(COMMAND_SPECS[name].options['--no-color'].set).toBe('never');
    }
    expect(() => commandArguments('difftool', [['--color', 'bad']])).toThrow();
    expect(commandArguments('difftool', [['--color', 'bad'], ['--help-all']])).toContain(
      '--help-all',
    );
    expect(() => commandArguments('blame', [['--color', 'always'], ['--help-all']])).toThrow();
    expect(commandArguments('blame', [['--help-all'], ['--color', 'always']])).toContain(
      '--help-all',
    );
  });
});

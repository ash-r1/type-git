import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import type { OptionSpec } from './spec.js';

describe('commit-graph filter count callback', () => {
  it('uses signed decimal cast semantics without a nonnegative range or suffix grammar', () => {
    for (const value of [
      '',
      '0',
      '-1',
      '+1',
      ' 1',
      '2147483648',
      '4294967296',
      '99999999999999999999999999999',
    ]) {
      expect(
        commandArguments('commit-graph write', [['--max-new-filters', value], ['-h']]),
      ).toContain(`--max-new-filters=${value}`);
    }
    expect(commandArguments('commit-graph write', [['--max-new-filters', 1], ['-h']])).toContain(
      '--max-new-filters=1',
    );
    for (const value of ['bad', '1k', '1.0', '1\n', '0x10', '+', '١']) {
      expect(() =>
        commandArguments('commit-graph write', [['--max-new-filters', value], ['-h']]),
      ).toThrow();
      expect(
        commandArguments('commit-graph write', [['-h'], ['--max-new-filters', value]]),
      ).toContain('-h');
    }
  });
  it('preserves the negative-one unset state and public flag shapes', () => {
    const options = COMMAND_SPECS['commit-graph write'].options;
    expect(options['--max-new-filters'].parser).toMatchObject({
      kind: 'decimal',
      signed: true,
      bits: 32,
      conversion: 'cast',
      empty: true,
    });
    expect(options['--no-max-new-filters']).toMatchObject({ value: 'flag', set: -1 });
    expect((options['--no-max-new-filters'] as OptionSpec).parser).toBeUndefined();
    expect(commandArguments('commit-graph write', [['--no-max-new-filters'], ['-h']])).toContain(
      '--no-max-new-filters',
    );
    expect(() => commandArguments('commit-graph write', [['--max-new-filters'], ['-h']])).toThrow();
    expect(() =>
      commandArguments('commit-graph write', [['--no-max-new-filters', '1'], ['-h']]),
    ).toThrow();
    expect(() =>
      commandArguments('commit-graph write', [
        ['--max-new-filters', 'bad'],
        ['--max-new-filters', '1'],
        ['-h'],
      ]),
    ).toThrow();
    expect(() =>
      commandArguments('commit-graph write', [['-h'], ['--max-new-filters', '1\0']]),
    ).toThrow();
  });
});

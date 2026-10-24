import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('repack max-pack-size callback timing', () => {
  it('retains the old string value until later help', () => {
    expect(
      commandArguments('repack', [['--max-pack-size', 'invalid'], ['-h']], true, {
        longBits: 64,
        sizeTBits: 64,
        repackMaxPackSize: 'deferred',
      }),
    ).toEqual(['repack', '--max-pack-size=invalid', '-h']);
  });
  it('skips a numeric callback after internal help', () => {
    expect(commandArguments('repack', [['-h'], ['--max-pack-size', 'invalid']], true)).toEqual([
      'repack',
      '-h',
      '--max-pack-size=invalid',
    ]);
  });
});

describe('repack timing boundaries', () => {
  it('keeps immediate errors and does not defer a tuple without help', () => {
    expect(() =>
      commandArguments('repack', [['--max-pack-size', 'invalid'], ['-h']], true, {
        longBits: 64,
        sizeTBits: 64,
        repackMaxPackSize: 'immediate',
      }),
    ).toThrow('--max-pack-size');
    expect(() =>
      commandArguments('repack', [['--max-pack-size', 'invalid']], true, {
        longBits: 64,
        sizeTBits: 64,
        repackMaxPackSize: 'deferred',
      }),
    ).toThrow('--max-pack-size');
  });
  it('retains argv representation checks in an older timing walk', () => {
    expect(() =>
      commandArguments('repack', [['--max-pack-size', true], ['-h']], true, {
        longBits: 64,
        sizeTBits: 64,
        repackMaxPackSize: 'deferred',
      }),
    ).toThrow();
    expect(() => commandArguments('repack', [['-h'], ['--max-pack-size', '\0']], true)).toThrow(
      'NUL',
    );
  });
});

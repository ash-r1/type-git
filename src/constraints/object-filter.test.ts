import { describe, expect, it } from 'vitest';
import {
  commandArguments,
  commandUsesNativeABI,
  commandUsesNegativeMagnitude,
} from '../commands/build.js';
import { parseGitInteger } from './git-integer.js';
import { parseGitScalar } from './git-scalars.js';
import {
  objectFilterUsesBinary,
  objectFilterUsesNegativeMagnitude,
  validObjectFilter,
} from './object-filter.js';

describe('source-defined object-filter unsigned-long bounds', () => {
  it('uses the observed binary-integer profile through nested percent decoding', () => {
    for (const value of ['blob:limit=0b10', 'tree:+0B10k', 'combine:tree:0%621']) {
      expect(objectFilterUsesBinary(value)).toBe(true);
      expect(validObjectFilter(value, false, 64, true)).toBe(true);
      expect(validObjectFilter(value, false, 64, false)).toBe(false);
    }
    expect(objectFilterUsesBinary('combine:sparse:oid=0b10')).toBe(false);
  });
  it('accepts bare units only under the older strtoumax magnitude profile', () => {
    for (const value of ['blob:limit=k', 'tree:G', 'combine:tree:m+blob:limit=g']) {
      expect(objectFilterUsesNegativeMagnitude(value)).toBe(true);
      expect(validObjectFilter(value, false, 64, true, false)).toBe(false);
      expect(validObjectFilter(value, false, 64, true, true)).toBe(true);
    }
    for (const value of ['blob:limit= k', 'blob:limit=-k', 'blob:limit=+k', 'tree:kk']) {
      expect(validObjectFilter(value, false, 64, true, true)).toBe(false);
    }
    expect(objectFilterUsesNegativeMagnitude('blob:limit=1k')).toBe(false);
    const parser = { kind: 'integer', signed: false, bits: 64 } as const;
    expect(parseGitInteger('k', parser, true, false)).toBeUndefined();
    expect(parseGitInteger('k', parser, true, true)).toBe(0n);
    expect(parseGitInteger('k', { ...parser, signed: true }, true, true)).toBeUndefined();
    const args = [['--filter', 'blob:limit=k'], ['-h']];
    expect(commandUsesNegativeMagnitude('clone', args)).toBe(true);
    expect(commandUsesNegativeMagnitude('pack-objects', [['--max-pack-size', 'g']])).toBe(true);
    expect(() => commandArguments('clone', args, false, { negativeMagnitudes: false })).toThrow();
    expect(commandArguments('clone', args, false, { negativeMagnitudes: true })).toEqual([
      'clone',
      '--filter=blob:limit=k',
      '-h',
    ]);
  });
  it('uses the supplied C long width independently of size_t', () => {
    for (const parser of ['object-filter', 'object-filter-auto'] as const) {
      for (const value of ['blob:limit=4294967296', 'tree:4g', 'combine:tree:4g']) {
        expect(parseGitScalar(parser, value, undefined, 32, 64).valid).toBe(false);
        expect(parseGitScalar(parser, value, undefined, 64, 32).valid).toBe(true);
      }
      expect(parseGitScalar(parser, 'blob:limit=4294967295', undefined, 32, 64).valid).toBe(true);
    }
  });
  it('passes the selected ABI through callback validation before help', () => {
    const args = [['--filter', 'blob:limit=4294967296'], ['-h']];
    expect(() => commandArguments('clone', args, false, { longBits: 32, sizeTBits: 64 })).toThrow();
    expect(commandArguments('clone', args, false, { longBits: 64, sizeTBits: 32 })).toEqual([
      'clone',
      '--filter=blob:limit=4294967296',
      '-h',
    ]);
  });
  it('marks both filter callback families for selected-executable ABI validation', () => {
    expect(commandUsesNativeABI('clone', [['--filter', 'blob:limit=4294967296']])).toBe(true);
    expect(commandUsesNativeABI('fetch', [['--filter', 'auto']])).toBe(true);
  });
});

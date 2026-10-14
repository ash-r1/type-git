import { describe, expect, it } from 'vitest';
import { commandArguments, commandUsesNativeABI } from '../commands/build.js';
import { parseGitScalar } from './git-scalars.js';

describe('source-defined object-filter unsigned-long bounds', () => {
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

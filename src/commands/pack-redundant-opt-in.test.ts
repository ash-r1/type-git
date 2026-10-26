import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';
const nativeOwned = {
  longBits: 64 as const,
  sizeTBits: 64 as const,
  packRedundantOptInRequired: false,
};
describe('pack-redundant version-dependent opt-in validation', () => {
  it('retains the pinned source constraint unless native ownership is selected', () => {
    expect(() => commandArguments('pack-redundant', [['--all']])).toThrow('acknowledgement');
    expect(commandArguments('pack-redundant', [['--all']], true, nativeOwned)).toEqual([
      'pack-redundant',
      '--all',
    ]);
    expect(commandArguments('pack-redundant', [['--all'], ['--i-still-use-this']])).toEqual([
      'pack-redundant',
      '--all',
      '--i-still-use-this',
    ]);
  });
  it('retains arity and representation checks under native ownership', () => {
    for (const args of [[], [['--i-still-use-this']], [['--all', true]], [['--unknown']]]) {
      expect(() => commandArguments('pack-redundant', args, true, nativeOwned)).toThrow();
    }
  });
});

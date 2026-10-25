import { describe, expect, it } from 'vitest';
import { commandArguments, commandUsesReadTreeExclude } from './build.js';
const legacy = { longBits: 64, sizeTBits: 64, readTreeExclude: 'legacy' } as const;
const modern = { ...legacy, readTreeExclude: 'modern' } as const;
describe('read-tree exclude callback before help', () => {
  it('retains an arbitrary legacy filename and deferred update requirement', () => {
    expect(
      commandArguments('read-tree', [['--exclude-per-directory', 'other'], ['-h']], true, legacy),
    ).toEqual(['read-tree', '--exclude-per-directory=other', '-h']);
    expect(
      commandArguments(
        'read-tree',
        [['--exclude-per-directory', ''], ['-u'], ['--help-all']],
        true,
        legacy,
      ),
    ).toEqual(['read-tree', '--exclude-per-directory=', '-u', '--help-all']);
  });
  it('retains modern prerequisite/value checks and repeated values', () => {
    expect(() =>
      commandArguments(
        'read-tree',
        [['--exclude-per-directory', '.gitignore'], ['-h']],
        true,
        modern,
      ),
    ).toThrow('exclude-order');
    expect(() =>
      commandArguments(
        'read-tree',
        [['-u'], ['--exclude-per-directory', 'other'], ['-h']],
        true,
        modern,
      ),
    ).toThrow('unsupported');
    expect(
      commandArguments(
        'read-tree',
        [
          ['-u'],
          ['--exclude-per-directory', '.gitignore'],
          ['--exclude-per-directory', '.gitignore'],
          ['-h'],
        ],
        true,
        modern,
      ),
    ).toEqual([
      'read-tree',
      '-u',
      '--exclude-per-directory=.gitignore',
      '--exclude-per-directory=.gitignore',
      '-h',
    ]);
  });
  it('rejects a reached duplicate in the legacy parser but skips it after help', () => {
    expect(() =>
      commandArguments(
        'read-tree',
        [
          ['--exclude-per-directory', 'first'],
          ['-u'],
          ['--exclude-per-directory', 'second'],
          ['-h'],
        ],
        true,
        legacy,
      ),
    ).toThrow('repeated legacy');
    expect(
      commandArguments(
        'read-tree',
        [['--exclude-per-directory', 'first'], ['-h'], ['--exclude-per-directory', 'second']],
        true,
        legacy,
      ),
    ).toEqual([
      'read-tree',
      '--exclude-per-directory=first',
      '-h',
      '--exclude-per-directory=second',
    ]);
  });
  it('does not relax a tuple without internal help or its representation', () => {
    expect(() =>
      commandArguments('read-tree', [['--exclude-per-directory', 'other']], true, legacy),
    ).toThrow();
    expect(() =>
      commandArguments('read-tree', [['--exclude-per-directory', '\0'], ['-h']], true, legacy),
    ).toThrow('NUL');
    expect(() =>
      commandArguments('read-tree', [['--exclude-per-directory', true], ['-h']], true, legacy),
    ).toThrow();
  });
  it('only profiles a reached callback followed by a real help token', () => {
    expect(
      commandUsesReadTreeExclude('read-tree', [['--exclude-per-directory', 'x'], ['-h']]),
    ).toBe(true);
    for (const args of [
      [['--help'], ['--exclude-per-directory', 'x']],
      [['-h'], ['--exclude-per-directory', 'x']],
      [['--exclude-per-directory', '-h']],
      [['--exclude-per-directory', 'x'], ['--'], ['-h']],
      [['--exclude-per-directory', 'x'], { operand: '-h' }],
    ]) {
      expect(commandUsesReadTreeExclude('read-tree', args)).toBe(false);
    }
  });
});

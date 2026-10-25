import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';
const legacy = { longBits: 64, sizeTBits: 64, readTreeExclude: 'legacy' } as const;
const modern = { ...legacy, readTreeExclude: 'modern' } as const;
describe('read-tree exclude callback without help', () => {
  it('accepts an old arbitrary filename with later update in a valid dry-run mode', () => {
    expect(
      commandArguments(
        'read-tree',
        [['--dry-run'], ['--exclude-per-directory', 'other'], ['-u'], ['-m'], { operand: 'HEAD' }],
        true,
        legacy,
      ),
    ).toEqual(['read-tree', '--dry-run', '--exclude-per-directory=other', '-u', '-m', 'HEAD']);
  });
  it('accepts an empty old filename with a prior update in reset dry-run mode', () => {
    expect(
      commandArguments(
        'read-tree',
        [['--dry-run'], ['-u'], ['--exclude-per-directory', ''], ['--reset'], { operand: 'HEAD' }],
        true,
        legacy,
      ),
    ).toEqual(['read-tree', '--dry-run', '-u', '--exclude-per-directory=', '--reset', 'HEAD']);
  });
  it('retains the final old update prerequisite and duplicate callback', () => {
    expect(() =>
      commandArguments(
        'read-tree',
        [['--dry-run'], ['--exclude-per-directory', 'other'], ['-m'], { operand: 'HEAD' }],
        true,
        legacy,
      ),
    ).toThrow();
    expect(() =>
      commandArguments(
        'read-tree',
        [
          ['--dry-run'],
          ['-u'],
          ['--exclude-per-directory', '.gitignore'],
          ['--exclude-per-directory', '.gitignore'],
          ['-m'],
          { operand: 'HEAD' },
        ],
        true,
        legacy,
      ),
    ).toThrow('repeated legacy');
  });
  it('keeps newer callback ordering and value restrictions', () => {
    expect(() =>
      commandArguments(
        'read-tree',
        [
          ['--dry-run'],
          ['--exclude-per-directory', '.gitignore'],
          ['-u'],
          ['-m'],
          { operand: 'HEAD' },
        ],
        true,
        modern,
      ),
    ).toThrow('exclude-order');
    expect(() =>
      commandArguments(
        'read-tree',
        [['--dry-run'], ['-u'], ['--exclude-per-directory', 'other'], ['-m'], { operand: 'HEAD' }],
        true,
        modern,
      ),
    ).toThrow('unsupported');
  });
});

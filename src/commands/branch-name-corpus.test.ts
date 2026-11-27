import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/branch-name-corpus.json';
import { branchNameSyntax, validRefnameFormat } from '../constraints/refname.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

type Row = (typeof corpus.cases)[number];

/** Whether the strict API accepts a corpus row, checking the serialized argv when it does. */
function accepts(row: Row): boolean {
  try {
    expect(commandArguments('branch', row.tokens as never, true)).toEqual(row.argv);
    return true;
  } catch (error) {
    if (error instanceof GitArgumentError) {
      return false;
    }
    throw error;
  }
}

describe('branch name corpus', () => {
  it('matches every independent Git 2.55.0 name outcome', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      const accepted = accepts(row);
      // Names that @{-N} or an upstream or push mark rewrite depend on the repository.
      const expected = row.valid || row.state;
      if (accepted !== expected) {
        mismatches.push(`${JSON.stringify(row.argv)}: native=${row.valid}, wrapper=${accepted}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('leaves only interpretable @{...} names to the repository', () => {
    expect(branchNameSyntax('@{-1}')).toBe('repository');
    expect(branchNameSyntax('topic@{U}')).toBe('repository');
    expect(branchNameSyntax('a@{b')).toBe(false);
    expect(branchNameSyntax('@{-1}x')).toBe('repository');
    expect(branchNameSyntax('@{-1}..')).toBe(false);
    expect(branchNameSyntax('a:b@{u}')).toBe(false);
    expect(branchNameSyntax('@{-0}x')).toBe(false);
    expect(branchNameSyntax('-a')).toBe(false);
    expect(branchNameSyntax('HEAD')).toBe(false);
    expect(branchNameSyntax('x/HEAD')).toBe(true);
  });

  it('checks the name only where an action makes it a new branch name', () => {
    const acceptsTokens = (tokens: unknown[]): boolean => {
      try {
        commandArguments('branch', tokens as never, true);
        return true;
      } catch (error) {
        if (error instanceof GitArgumentError) {
          return false;
        }
        throw error;
      }
    };
    const bad = { operand: 'a..b' };
    // A negation that clears the only action bit returns to creation.
    for (const action of [
      [['-d'], ['--no-delete']],
      [['-m'], ['--no-move']],
      [['-u', 'x'], ['--no-set-upstream-to']],
    ]) {
      expect(acceptsTokens([...action, bad])).toBe(false);
    }
    // -D, -M and -C keep their other bit after the long negation.
    expect(acceptsTokens([['-D'], ['--no-delete'], bad])).toBe(true);
    expect(acceptsTokens([['-M'], ['--no-move'], { operand: 'topic' }, bad])).toBe(false);
    expect(acceptsTokens([['-M'], ['--no-move'], bad, { operand: 'fixed' }])).toBe(true);
    for (const action of [
      [['-d']],
      [['--edit-description']],
      [['-u', 'main']],
      [['--unset-upstream']],
      [['--merged', 'HEAD']],
    ]) {
      expect(acceptsTokens([...action, bad])).toBe(true);
    }
  });

  it('applies REFNAME_ALLOW_ONELEVEL only when asked', () => {
    expect(validRefnameFormat('main')).toBe(false);
    expect(validRefnameFormat('main', true)).toBe(true);
    expect(validRefnameFormat('@', true)).toBe(false);
    expect(validRefnameFormat('', true)).toBe(false);
    expect(validRefnameFormat('refs/x.', true)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { parseGitScalar } from '../constraints/git-scalars.js';
import { NUMERIC_CALLBACK_PARSERS } from '../constraints/numeric-callbacks.generated.js';
import { commandArguments } from './build.js';

const continuing = ['diff', 'diff-files', 'diff-index', 'diff-tree', 'rev-list'] as const;
const streaming = [
  'diff --no-index',
  'range-diff',
  'diff-pairs',
  'blame',
  'annotate',
  'pickaxe',
  'shortlog',
] as const;
const deferred = [
  'log',
  'show',
  'reflog show',
  'stash show',
  'cherry-pick',
  'revert',
  'backfill',
  'last-modified',
  'replay',
  'format-patch',
  'whatchanged',
  'fast-export',
  'difftool',
  'reflog',
  'stash list',
] as const;
const scalarFlags = [
  '--stat-width',
  '--stat-name-width',
  '--stat-graph-width',
  '--stat-count',
] as const;

describe('diff stat callback grammar and reachability', () => {
  it('validates the four scalar strtoul grammars without applying the stat tuple grammar', () => {
    for (const command of ['diff'] as const) {
      for (const flag of scalarFlags) {
        for (const value of ['', '0', '-1', '+1', '010', ' \t1', '18446744073709551616']) {
          expect(commandArguments(command, [[flag, value]])).toContain(`${flag}=${value}`);
        }
        for (const value of ['bad', '0x10', '1 ', '1\n', '1,2']) {
          expect(() => commandArguments(command, [[flag, value]])).toThrow();
        }
      }
    }
  });
  it('accepts zero to three stat fields, including explicitly empty fields', () => {
    for (const value of ['', '1', ',,', '1,2,3', '0,999,999', '-1,,+1', '18446744073709551616']) {
      expect(commandArguments('diff', [['--stat', value]])).toContain(`--stat=${value}`);
    }
    expect(commandArguments('diff', [['--stat']])).toEqual(['diff', '--stat']);
    for (const value of ['1,2,3,', '1,bad', '0x10', '1\n', '1,2 ']) {
      expect(() => commandArguments('diff', [['--stat', value]])).toThrow();
    }
  });
  it('respects the independently measured native help phases in all 27 command scopes', () => {
    for (const help of ['-h', '--help-all']) {
      for (const flag of [...scalarFlags, '--stat']) {
        for (const command of continuing) {
          expect(() => commandArguments(command, [[flag, 'bad'], [help]])).toThrow();
          expect(() => commandArguments(command, [[help], [flag, 'bad']])).toThrow();
        }
        for (const command of streaming) {
          expect(() => commandArguments(command, [[flag, 'bad'], [help]])).toThrow();
          expect(commandArguments(command, [[help], [flag, 'bad']])).toContain(`${flag}=bad`);
        }
        for (const command of deferred) {
          expect(commandArguments(command, [[flag, 'bad'], [help]])).toContain(`${flag}=bad`);
          expect(commandArguments(command, [[help], [flag, 'bad']])).toContain(`${flag}=bad`);
        }
      }
    }
  });
  it('keeps ignored-tail shape and NUL checks and selected unsigned-overflow conversion', () => {
    for (const command of [...streaming, ...deferred]) {
      expect(() => commandArguments(command, [['-h'], ['--stat', '\0']])).toThrow('NUL');
      expect(() => commandArguments(command, [['-h'], ['--stat-width', {}]])).toThrow();
    }
    const parser = NUMERIC_CALLBACK_PARSERS['diff-stat-scalar'];
    expect(parseGitScalar(parser, '4294967297', undefined, 32, 64).value).toBe(-1);
    expect(parseGitScalar(parser, '4294967297', undefined, 64, 64).value).toBe(1);
    const negativeOverflow = (negate: boolean) =>
      parseGitScalar(
        parser,
        '-18446744073709551616',
        undefined,
        64,
        64,
        true,
        undefined,
        false,
        undefined,
        true,
        'modern',
        true,
        undefined,
        negate,
      );
    expect(negativeOverflow(false).value).toBe(-1);
    expect(negativeOverflow(true).value).toBe(1);
  });
});

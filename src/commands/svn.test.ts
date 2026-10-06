import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';

const available = spawnSync('git', ['svn', '--version'], { encoding: 'utf8' }).status === 0;
describe('Subversion operation tables', () => {
  it('exposes all registered operations and resolves globals after local aliases', () => {
    const names = Object.keys(COMMAND_SPECS).filter((name) => name.startsWith('svn '));
    expect(names).toHaveLength(25);
    for (const name of names) {
      const operation = name.slice(4);
      expect(commandArguments('svn', [{ operand: operation }, ['-h']], true)).toEqual([
        'svn',
        operation,
        '-h',
      ]);
    }
    // Global id|i=s replaces dcommit's interactive|i declaration in GetOptions.
    expect(commandArguments('svn dcommit', [['-i', 'svn-id'], ['--interactive']], true)).toEqual([
      'svn',
      'dcommit',
      '-i',
      'svn-id',
      '--interactive',
    ]);
    expect(() => commandArguments('svn dcommit', [['-i']], true)).toThrow(GitArgumentError);
    expect(() => commandArguments('svn fetch', [['--noMetadata']], true)).toThrow(GitArgumentError);
    expect(() => commandArguments('svn fetch', [['--help']], true)).toThrow(GitArgumentError);
  });
  it('checks required operands without inventing maxima for ignored extra words', () => {
    for (const name of [
      'svn clone',
      'svn branch',
      'svn tag',
      'svn find-rev',
      'svn propget',
      'svn propset',
      'svn commit-diff',
    ] as const) {
      expect(() => commandArguments(name, [], true)).toThrow(GitArgumentError);
    }
    for (const name of [
      'svn clone',
      'svn branch',
      'svn tag',
      'svn find-rev',
      'svn propget',
      'svn propset',
      'svn commit-diff',
    ] as const) {
      expect(
        commandArguments(
          name,
          ['one', 'two', 'three', 'four'].map((operand) => ({ operand })),
          true,
        ),
      ).toEqual([...name.split(' '), 'one', 'two', 'three', 'four']);
    }
    for (const name of ['svn fetch', 'svn info'] as const) {
      expect(() => commandArguments(name, [{ operand: 'one' }, { operand: 'two' }], true)).toThrow(
        GitArgumentError,
      );
    }
    expect(() => commandArguments('svn find-rev', [{ operand: '0' }], true)).toThrow(
      GitArgumentError,
    );
    expect(commandArguments('svn propset', [{ operand: '' }, { operand: '' }], true)).toEqual([
      'svn',
      'propset',
      '',
      '',
    ]);
  });
  it('preserves config-supplied inputs, explicit empty conflicts, and early exits', () => {
    expect(commandArguments('svn init', [], true)).toEqual(['svn', 'init']);
    expect(commandArguments('svn multi-init', [], true)).toEqual(['svn', 'multi-init']);
    expect(commandArguments('svn reset', [], true)).toEqual(['svn', 'reset']);
    expect(commandArguments('svn commit-diff', [{ operand: 'a' }, { operand: 'b' }], true)).toEqual(
      ['svn', 'commit-diff', 'a', 'b'],
    );
    expect(() =>
      commandArguments(
        'svn commit-diff',
        [['-m', ''], ['-F', ''], { operand: 'a' }, { operand: 'b' }],
        true,
      ),
    ).toThrow(GitArgumentError);
    expect(() =>
      commandArguments(
        'svn init',
        [
          ['--rewrite-root', ''],
          ['--rewrite-uuid', ''],
        ],
        true,
      ),
    ).toThrow(GitArgumentError);
    expect(commandArguments('svn clone', [['--version']], true)).toEqual([
      'svn',
      'clone',
      '--version',
    ]);
    expect(
      commandArguments('svn find-rev', [['--before'], ['--after'], { operand: 'r1' }], true),
    ).toEqual(['svn', 'find-rev', '--before', '--after', 'r1']);
    expect(commandArguments('svn log', [{ operand: '--all' }, ['--limit', 2]], true)).toEqual([
      'svn',
      'log',
      '--all',
      '--limit=2',
    ]);
  });
  it.skipIf(!available)(
    'matches native local failures and ignored operands without SVN transport',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'type-git-svn-'));
      const env = {
        ...process.env,
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_GLOBAL: join(root, 'global'),
        GIT_CONFIG_NOSYSTEM: '1',
      };
      const run = (args: string[]) =>
        spawnSync('git', ['-C', root, 'svn', ...args], { env, encoding: 'utf8', timeout: 10000 });
      try {
        expect(spawnSync('git', ['init', root], { env }).status).toBe(0);
        for (const operation of Object.keys(COMMAND_SPECS)
          .filter((name) => name.startsWith('svn '))
          .map((name) => name.slice(4))) {
          expect(run([operation, '-h']).status).toBe(0);
        }
        expect(run(['fetch', 'one', 'two']).stderr).toContain('usage:');
        expect(run(['branch']).stderr).toContain('name required');
        expect(run(['find-rev']).stderr).toContain('revision required');
        expect(run(['propset']).status).not.toBe(0);
        expect(run(['multi-fetch', 'ignored']).status).toBe(0);
        expect(run(['migrate', 'ignored']).status).toBe(0);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );
});

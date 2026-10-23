import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('revision date format callback', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  const native = (args: string[]) => {
    const result = spawnSync('git', ['-C', root, ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    return result;
  };
  const compare = async (args: readonly unknown[], words: string[]) => {
    const expected = native(['log', '--format=%ad', ...words, 'HEAD']);
    const actual = await repo.command('log', [
      ['--format', '%ad'],
      ...args,
      { operand: 'HEAD' },
    ] as never);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-date-mode-'));
    env = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] =>
            entry[1] !== undefined && !entry[0].toUpperCase().startsWith('GIT_'),
        ),
      ),
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      LC_ALL: 'C',
      GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
    };
    for (const args of [
      ['init', '-q'],
      ['config', 'user.name', 'Fixture'],
      ['config', 'user.email', 'fixture@example.invalid'],
    ]) {
      expect(native(args).status).toBe(0);
    }
    await writeFile(join(root, 'file'), 'base\n');
    expect(native(['add', 'file']).status).toBe(0);
    expect(native(['commit', '-qm', 'base']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  const modes = [
    'relative',
    'iso8601-strict',
    'iso-strict',
    'iso8601',
    'iso',
    'rfc2822',
    'rfc',
    'short',
    'default',
    'human',
    'raw',
    'unix',
  ];
  it.each([
    ...modes,
    ...modes.map((mode) => `${mode}-local`),
    'local',
    'format:',
    'format:%Y-%m-%d',
    'format-local:%s',
    'auto:',
    'auto:invalid',
    'auto:format',
    'auto:auto:invalid',
  ])('matches native pipe output for %j', async (value) => {
    expect((await compare([['--date', value]], [`--date=${value}`])).status).toBe(0);
  }, 120_000);

  it.each([
    '',
    'invalid',
    'ISO',
    'iso-local-local',
    'format',
    'format-local',
    'formatx:',
    'iso:',
    ' default',
    'relative\n',
  ])('rejects the native invalid format %j', async (value) => {
    const expected = native(['log', `--date=${value}`, 'HEAD']);
    expect(expected.status).toBe(128);
    expect(expected.stderr).toMatch(/(?:unknown date format|date format missing colon separator)/);
    await expect(
      repo.command('log', [['--date', value], { operand: 'HEAD' }] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  }, 120_000);

  it('preserves immediate callback errors before later valid modes or relative-date', async () => {
    for (const tail of [['--date', 'iso'], ['--relative-date']]) {
      const words = tail.length === 1 ? [tail[0]!] : [`${tail[0]}=${tail[1]}`];
      expect(native(['log', '--date=invalid', ...words, 'HEAD']).status).toBe(128);
      await expect(
        repo.command('log', [['--date', 'invalid'], tail, { operand: 'HEAD' }] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    }
    expect(
      (
        await compare(
          [
            ['--date', 'iso'],
            ['--date', 'short'],
          ],
          ['--date=iso', '--date=short'],
        )
      ).status,
    ).toBe(0);
  }, 120_000);

  it('preserves log first-pass help before revision callbacks in either argv order', async () => {
    for (const first of [false, true]) {
      const args = first ? [['-h'], ['--date', 'invalid']] : [['--date', 'invalid'], ['-h']];
      const words = first ? ['-h', '--date=invalid'] : ['--date=invalid', '-h'];
      const expected = await compare(args, words);
      expect([0, 129]).toContain(expected.status);
      expect(expected.stdout + expected.stderr).toContain('usage: git log');
    }
  }, 120_000);
  it.each([
    'log',
    'show',
    'diff',
    'diff-files',
    'diff-index',
    'diff-tree',
    'reflog show',
    'stash show',
    'cherry-pick',
    'revert',
    'rev-list',
    'backfill',
    'last-modified',
    'replay',
    'blame',
    'annotate',
    'format-patch',
    'pickaxe',
    'whatchanged',
    'shortlog',
    'fast-export',
    'reflog',
    'stash list',
  ] as const)('retains native help reachability for shared consumer %s', async (command) => {
    for (const first of [false, true]) {
      const args = first ? [['-h'], ['--date', 'invalid']] : [['--date', 'invalid'], ['-h']];
      const words = first ? ['-h', '--date=invalid'] : ['--date=invalid', '-h'];
      const expected = native([...command.split(' '), ...words]);
      const outcome = await repo.command(command, args as never).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      if (!outcome.ok) {
        expect(outcome.error).toBeInstanceOf(GitArgumentError);
        expect(expected.status).not.toBe(0);
        expect(expected.stdout + expected.stderr).not.toContain('usage:');
        continue;
      }
      expect(outcome.value.exitCode).toBe(expected.status);
      expect(outcome.value.stdout).toBe(expected.stdout);
      expect(outcome.value.stderr).toBe(expected.stderr);
    }
  }, 120_000);
  it('keeps stash-list date parsing behind its repository-ref gate', async () => {
    const compareList = async () => {
      const expected = native(['stash', 'list', '--date=invalid']);
      const actual = await repo.command('stash list', [['--date', 'invalid']]);
      expect(actual.exitCode).toBe(expected.status);
      expect(actual.stdout).toBe(expected.stdout);
      expect(actual.stderr).toBe(expected.stderr);
      return expected;
    };
    expect((await compareList()).status).toBe(0);
    await writeFile(join(root, 'file'), 'changed\n');
    expect(native(['stash', 'push', '-qm', 'saved']).status).toBe(0);
    const expected = await compareList();
    expect(expected.status).not.toBe(0);
    expect(expected.stderr).toContain('unknown date format');
  }, 120_000);
});

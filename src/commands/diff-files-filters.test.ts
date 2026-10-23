import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('diff-files final revision filters', () => {
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
    const expected = native(['diff-files', ...words]);
    const actual = await repo.command('diff-files', args as never);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-diff-files-filters-'));
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

  it('checks the final count upper bound without inventing a lower bound', async () => {
    for (const value of ['-2147483648', '-2', '-1', '0', '1', '2', '3']) {
      expect((await compare([['--max-count', value]], [`--max-count=${value}`])).status).toBe(0);
    }
    for (const value of ['4', '2147483647']) {
      expect(native(['diff-files', `--max-count=${value}`]).status).toBe(129);
      await expect(
        repo.command('diff-files', [['--max-count', value]] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    }
    expect(
      (
        await compare(
          [
            ['--max-count', '4'],
            ['--max-count', '3'],
          ],
          ['--max-count=4', '--max-count=3'],
        )
      ).status,
    ).toBe(0);
    expect(native(['diff-files', '--max-count=3', '--max-count=4']).status).toBe(129);
    await expect(
      repo.command('diff-files', [
        ['--max-count', '3'],
        ['--max-count', '4'],
      ] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(native(['diff-files', '-4']).status).toBe(129);
    await expect(repo.command('diff-files', [['-4']] as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
  }, 120_000);

  it.each([
    '--base',
    '--ours',
    '--theirs',
  ] as const)('processes %s after revision counts in either argv order', async (alias) => {
    for (const first of [false, true]) {
      const acceptedArgs = first
        ? [[alias], ['--max-count', '4']]
        : [['--max-count', '4'], [alias]];
      const acceptedWords = first ? [alias, '--max-count=4'] : ['--max-count=4', alias];
      expect((await compare(acceptedArgs, acceptedWords)).status).toBe(0);
      for (const value of ['2147483648', 'invalid']) {
        const args = first ? [[alias], ['--max-count', value]] : [['--max-count', value], [alias]];
        const words = first ? [alias, `--max-count=${value}`] : [`--max-count=${value}`, alias];
        const expected = native(['diff-files', ...words]);
        if (expected.status === 128) {
          expect(expected.stderr).toContain('not an integer');
          await expect(repo.command('diff-files', args as never)).rejects.toBeInstanceOf(
            GitArgumentError,
          );
        } else {
          expect((await compare(args, words)).status).toBe(0);
        }
      }
    }
  }, 120_000);

  it.each([
    '--min-age',
    '--max-age',
  ] as const)('checks %s sentinel state independently of manual stage selection', async (flag) => {
    for (const value of ['0', '1', '-2147483648']) {
      expect(native(['diff-files', '--base', `${flag}=${value}`]).status).toBe(129);
      await expect(
        repo.command('diff-files', [['--base'], [flag, value]] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    }
    for (const sentinel of ['-1', '18446744073709551615']) {
      expect((await compare([[flag, sentinel]], [`${flag}=${sentinel}`])).status).toBe(0);
    }
    expect(
      (
        await compare(
          [
            [flag, '1'],
            [flag, '-1'],
          ],
          [`${flag}=1`, `${flag}=-1`],
        )
      ).status,
    ).toBe(0);
  }, 120_000);

  it.each([
    ['--since', '--max-age'],
    ['--after', '--max-age'],
    ['--before', '--min-age'],
    ['--until', '--min-age'],
  ] as const)(
    'preserves %s overwrite order with %s and native-owned dates',
    async (alias, flag) => {
      const date = '1970-01-01 00:00:01 +0000';
      expect(
        (
          await compare(
            [
              [alias, date],
              [flag, '-1'],
            ],
            [`${alias}=${date}`, `${flag}=-1`],
          )
        ).status,
      ).toBe(0);
      expect(
        (
          await compare(
            [
              [flag, '1'],
              [alias, date],
            ],
            [`${flag}=1`, `${alias}=${date}`],
          )
        ).status,
      ).toBe(129);
    },
    120_000,
  );

  it.each([
    '--max-count',
    '--min-age',
    '--max-age',
  ])('preserves help timing and immediate parse errors for %s', async (flag) => {
    for (const value of ['4', 'invalid']) {
      for (const first of [false, true]) {
        const args = first ? [['-h'], [flag, value]] : [[flag, value], ['-h']];
        const words = first ? ['-h', `${flag}=${value}`] : [`${flag}=${value}`, '-h'];
        const expected = native(['diff-files', ...words]);
        if (expected.status === 128) {
          expect(expected.stderr).toMatch(/not (?:an integer|a number of seconds since epoch)/);
          await expect(repo.command('diff-files', args as never)).rejects.toBeInstanceOf(
            GitArgumentError,
          );
        } else {
          expect((await compare(args, words)).status).toBe(129);
        }
      }
    }
  }, 120_000);
});

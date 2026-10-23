import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('diff-index final timestamp filters', () => {
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
    const expected = native(['diff-index', ...words, 'HEAD']);
    const actual = await repo.command('diff-index', [...args, { operand: 'HEAD' }] as never);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-diff-index-age-'));
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

  it.each([
    '--min-age',
    '--max-age',
  ] as const)('rejects final normalized non-default %s values', async (flag) => {
    for (const value of ['0', '1', '2147483647', '-2147483648']) {
      expect(native(['diff-index', `${flag}=${value}`, 'HEAD']).status).toBe(129);
      await expect(
        repo.command('diff-index', [[flag, value], { operand: 'HEAD' }] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    }
  }, 120_000);

  it.each([
    '--min-age',
    '--max-age',
  ] as const)('allows native sentinel forms and numeric overwrite order for %s', async (flag) => {
    for (const sentinel of ['-1', '18446744073709551615', ' +18446744073709551615']) {
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
    expect(native(['diff-index', `${flag}=-1`, `${flag}=1`, 'HEAD']).status).toBe(129);
    await expect(
      repo.command('diff-index', [[flag, '-1'], [flag, '1'], { operand: 'HEAD' }] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  }, 120_000);

  it.each([
    ['--since', '--max-age'],
    ['--after', '--max-age'],
    ['--before', '--min-age'],
    ['--until', '--min-age'],
  ] as const)(
    'retains shared timestamp state for %s and %s while leaving dates native-owned',
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
      // These date results remain native usage failures, not falsely accepted Git operations.
      expect(
        (
          await compare(
            [
              [flag, '-1'],
              [alias, date],
            ],
            [`${flag}=-1`, `${alias}=${date}`],
          )
        ).status,
      ).toBe(129);
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
      expect((await compare([[alias, date]], [`${alias}=${date}`])).status).toBe(129);
    },
    120_000,
  );

  it('keeps since-as-filter distinct from max-age, including native version availability', async () => {
    const date = '1970-01-01 00:00:01 +0000';
    for (const reset of [false, true]) {
      const args = [...(reset ? [['--max-age', '-1']] : []), ['--since-as-filter', date]];
      const words = [...(reset ? ['--max-age=-1'] : []), `--since-as-filter=${date}`];
      const expected = await compare(args, words);
      expect([0, 129]).toContain(expected.status);
    }
  }, 120_000);

  it.each([
    '--min-age',
    '--max-age',
  ] as const)('preserves immediate overflow versus a later %s reset', async (flag) => {
    for (const value of ['4294967295', '18446744073709551616']) {
      const words = [`${flag}=${value}`, `${flag}=-1`];
      const expected = native(['diff-index', ...words, 'HEAD']);
      if (expected.status === 128) {
        expect(expected.stderr).toContain('not a number of seconds since epoch');
        await expect(
          repo.command('diff-index', [[flag, value], [flag, '-1'], { operand: 'HEAD' }] as never),
        ).rejects.toBeInstanceOf(GitArgumentError);
      } else {
        expect(expected.status).toBe(0);
        expect(
          (
            await compare(
              [
                [flag, value],
                [flag, '-1'],
              ],
              words,
            )
          ).status,
        ).toBe(0);
      }
    }
  }, 120_000);

  it.each([
    '--min-age',
    '--max-age',
  ] as const)('retains help exit and callback order for %s', async (flag) => {
    for (const value of ['1', 'invalid']) {
      for (const first of [false, true]) {
        const words = first ? ['-h', `${flag}=${value}`] : [`${flag}=${value}`, '-h'];
        const args = first ? [['-h'], [flag, value]] : [[flag, value], ['-h']];
        const expected = native(['diff-index', ...words, 'HEAD']);
        if (expected.status === 128) {
          expect(expected.stderr).toContain('not a number of seconds since epoch');
          await expect(
            repo.command('diff-index', [...args, { operand: 'HEAD' }] as never),
          ).rejects.toBeInstanceOf(GitArgumentError);
        } else {
          expect((await compare(args, words)).status).toBe(expected.status);
        }
      }
    }
  }, 120_000);
});

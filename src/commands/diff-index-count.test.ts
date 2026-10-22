import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('diff-index final revision count', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-diff-index-count-'));
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

  it.each(['0', '1', '-2'])('rejects a final non-sentinel count %s', async (count) => {
    expect(native(['diff-index', `--max-count=${count}`, 'HEAD']).status).toBe(129);
    await expect(
      repo.command('diff-index', [['--max-count', count], { operand: 'HEAD' }] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  }, 120_000);

  it('allows the sentinel and earlier parsed counts replaced by it', async () => {
    expect((await compare([], [])).status).toBe(0);
    expect((await compare([['--max-count', '-1']], ['--max-count=-1'])).status).toBe(0);
    for (const count of ['0', '1', '-2']) {
      expect(
        (
          await compare(
            [
              ['--max-count', count],
              ['--max-count', '-1'],
            ],
            [`--max-count=${count}`, '--max-count=-1'],
          )
        ).status,
      ).toBe(0);
    }
    expect(
      (
        await compare(
          [
            ['-n', '1'],
            ['--max-count', '-1'],
          ],
          ['-n', '1', '--max-count=-1'],
        )
      ).status,
    ).toBe(0);
  }, 120_000);

  it('checks the final value across long and short spellings', async () => {
    for (const flag of ['--max-count', '-n']) {
      expect(native(['diff-index', '--max-count=-1', flag, '1', 'HEAD']).status).toBe(129);
      await expect(
        repo.command('diff-index', [
          ['--max-count', '-1'],
          [flag, '1'],
          { operand: 'HEAD' },
        ] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    }
  }, 120_000);

  it('preserves native help exits before final semantic checks', async () => {
    for (const helpFirst of [false, true]) {
      const count = ['--max-count', '1'];
      const args = helpFirst ? [['-h'], count] : [count, ['-h']];
      const words = helpFirst ? ['-h', '--max-count=1'] : ['--max-count=1', '-h'];
      expect((await compare(args, words)).status).toBe(129);
    }
  }, 120_000);

  it('retains legacy atoi wrap and immediate checked overflow', async () => {
    for (const reset of [false, true]) {
      const words = ['--max-count=4294967295', ...(reset ? ['--max-count=-1'] : [])];
      const expected = native(['diff-index', ...words, 'HEAD']);
      const args = [['--max-count', '4294967295'], ...(reset ? [['--max-count', '-1']] : [])];
      if (expected.status === 0) {
        expect((await compare(args, words)).status).toBe(0);
      } else {
        expect(expected.status).toBe(128);
        expect(expected.stderr).toMatch(/not an integer/);
        await expect(
          repo.command('diff-index', [...args, { operand: 'HEAD' }] as never),
        ).rejects.toBeInstanceOf(GitArgumentError);
      }
    }
  }, 120_000);
});

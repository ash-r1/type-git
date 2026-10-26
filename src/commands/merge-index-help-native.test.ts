import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('merge-index sole usage and clean-index controls', () => {
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
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-merge-index-help-'));
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
    await writeFile(join(root, '--help'), 'base\n');
    expect(native(['add', '--', 'file', '--help']).status).toBe(0);
    expect(native(['commit', '-qm', 'base']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  const compare = async (args: readonly unknown[], words: string[]) => {
    const snapshot = () =>
      Promise.all([
        readdir(root).then((entries) => entries.sort()),
        ...['.git/index', 'file', '.git/HEAD'].map((path) => readFile(join(root, path))),
      ]);
    const before = await snapshot();
    const expected = native(['merge-index', ...words]);
    expect(await snapshot()).toEqual(before);
    const actual = await repo.command('merge-index', args as never);
    expect(await snapshot()).toEqual(before);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  it('matches selected native canonical and tagged sole usage words', async () => {
    for (const flag of ['-h', '--help-all']) {
      await compare([[flag]], [flag]);
      await compare([{ operand: flag }], [flag]);
    }
  });
  it('retains clean-index all controls without invoking a merge program', async () => {
    for (const flags of [[], ['-o'], ['-q'], ['-o', '-q']]) {
      const result = await compare(
        [...flags.map((flag) => [flag]), { operand: 'type-git-no-such-merge-program' }, ['-a']],
        [...flags, 'type-git-no-such-merge-program', '-a'],
      );
      expect(result.status).toBe(0);
    }
  });
  it('preserves rejection and tagged native program/path behavior', async () => {
    await expect(repo.command('merge-index', [] as never)).rejects.toBeInstanceOf(GitArgumentError);
    await expect(
      repo.command('merge-index', [{ operand: 'program' }] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    for (const flag of ['-h', '--help-all']) {
      await expect(
        repo.command('merge-index', [[flag], { operand: 'missing' }] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
      await compare([{ operand: flag }, { operand: 'missing' }], [flag, 'missing']);
    }
  });
});

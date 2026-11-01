import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NodeExecAdapter, NodeFsAdapter, TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { createGitSync } from '../impl/git-impl.js';

describe('merge-one-file first raw help and safe native controls', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-merge-one-file-help-'));
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

  const compare = async (args: readonly unknown[], words: string[], outside = false) => {
    const snapshot = () =>
      Promise.all([
        readdir(root).then((entries) => entries.sort()),
        ...['.git/index', 'file', '.git/HEAD'].map((path) => readFile(join(root, path))),
      ]);
    const before = await snapshot();
    const cwd = outside ? await mkdtemp(join(tmpdir(), 'type-git-merge-one-file-outside-')) : root;
    try {
      const expected = spawnSync('git', ['-C', cwd, 'merge-one-file', ...words], {
        env,
        input: '',
        encoding: 'utf8',
        timeout: 30_000,
      });
      expect(expected.error).toBeUndefined();
      expect(expected.signal).toBeNull();
      expect(await snapshot()).toEqual(before);
      const exec = new NodeExecAdapter();
      const spawn = exec.spawn.bind(exec);
      exec.spawn = (options) => spawn({ ...options, cwd });
      const git = outside
        ? new TypeGit(
            createGitSync({
              adapters: { exec, fs: new NodeFsAdapter() },
              home: root,
              inheritEnv: false,
              env,
            }),
          )
        : repo;
      const actual = await git.command('merge-one-file', args as never);
      expect(await snapshot()).toEqual(before);
      expect(actual.exitCode).toBe(expected.status);
      expect(actual.stdout).toBe(expected.stdout);
      expect(actual.stderr).toBe(expected.stderr);
      return expected;
    } finally {
      if (outside) {
        await rm(cwd, { recursive: true, force: true });
      }
    }
  };
  it('matches canonical and tagged first -h success before repo checks and arity', async () => {
    for (const outside of [false, true]) {
      for (const first of [['-h'], { operand: '-h' }]) {
        expect((await compare([first], ['-h'], outside)).status).toBe(0);
        expect(
          (await compare([first, { operand: 'ignored' }, ['-h']], ['-h', 'ignored', '-h'], outside))
            .status,
        ).toBe(0);
      }
    }
  });
  it('retains seven-word native rejection before merge payloads', async () => {
    const words = ['a', 'b', 'c', 'missing', '100644', '120000', '100644'];
    const result = await compare(
      words.map((operand) => ({ operand })),
      words,
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Not merging symbolic link changes');
    expect(
      (
        await compare(
          words.map((operand) => ({ operand })),
          words,
          true,
        )
      ).status,
    ).toBe(128);
  });
  it('does not turn later -h into a usage exit', async () => {
    await expect(
      repo.command('merge-one-file', [{ operand: 'a' }, { operand: '-h' }] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    const words = ['a', '-h', 'c', 'missing', '100644', '120000', '100644'];
    const result = await compare(
      words.map((operand) => ({ operand })),
      words,
    );
    expect(result.status).toBe(1);
  });
});

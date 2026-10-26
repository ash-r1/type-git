import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NodeExecAdapter, NodeFsAdapter, TypeGit } from '../adapters/node/index.js';
import { createGitSync } from '../impl/git-impl.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('get-tar-commit-id sole usage and tar input controls', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  let archive: Uint8Array;
  let commit: string;
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
    root = await mkdtemp(join(tmpdir(), 'type-git-get-tar-help-'));
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
    const archived = spawnSync('git', ['-C', root, 'archive', '--format=tar', 'HEAD'], {
      env,
      timeout: 30_000,
    });
    expect(archived.error).toBeUndefined();
    expect(archived.signal).toBeNull();
    expect(archived.status).toBe(0);
    archive = new Uint8Array(archived.stdout);
    commit = native(['rev-parse', 'HEAD']).stdout.trim();
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  const compare = async (
    args: readonly unknown[],
    words: string[],
    input: string | Uint8Array = '',
    outside = false,
  ) => {
    const snapshot = () =>
      Promise.all([
        readdir(root).then((entries) => entries.sort()),
        ...['.git/index', 'file', '.git/HEAD'].map((path) => readFile(join(root, path))),
      ]);
    const before = await snapshot();
    const cwd = outside ? await mkdtemp(join(tmpdir(), 'type-git-get-tar-outside-')) : root;
    try {
      const expected = spawnSync('git', ['-C', cwd, 'get-tar-commit-id', ...words], {
        env,
        input,
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
      const actual = await git.command('get-tar-commit-id', args as never, { stdin: input });
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
  it('matches selected native canonical/tagged sole usage output', async () => {
    for (const outside of [false, true]) {
      for (const flag of ['-h', '--help-all']) {
        await compare([[flag]], [flag], '', outside);
        await compare([{ operand: flag }], [flag], '', outside);
      }
    }
  });
  it('extracts the fixture commit from actual tar bytes inside and outside a repository', async () => {
    for (const outside of [false, true]) {
      const result = await compare([], [], archive, outside);
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`${commit}\n`);
    }
  });
  it('retains malformed and short-input native outcomes', async () => {
    for (const outside of [false, true]) {
      expect((await compare([], [], new Uint8Array(1024), outside)).status).toBe(1);
      expect((await compare([], [], '', outside)).status).toBe(128);
      expect((await compare([], [], archive.slice(0, 64), outside)).status).toBe(128);
    }
  });
  it('rejects non-usage operands and multiword help', async () => {
    expect(native(['get-tar-commit-id', 'ordinary', '--help']).status).toBe(129);
    await expect(
      repo.command('get-tar-commit-id', [{ operand: 'ordinary' }, ['--help']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    await expect(
      repo.command('get-tar-commit-id', [{ operand: 'ordinary' }] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    await expect(
      repo.command('get-tar-commit-id', [['-h'], { operand: 'ignored' }] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });
});

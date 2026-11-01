import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NodeExecAdapter, NodeFsAdapter, TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { createGitSync } from '../impl/git-impl.js';

describe('credential sole usage and helperless operation controls', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-credential-help-'));
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
      GIT_TERMINAL_PROMPT: '0',
      GIT_EDITOR: 'fixture-editor',
      GIT_PAGER: 'fixture-pager',
      GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
    };
    await writeFile(join(root, '.gitconfig'), '[credential]\n\thelper =\n');
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

  const compare = async (
    args: readonly unknown[],
    words: string[],
    input: string | Uint8Array = '',
    outside = false,
  ) => {
    const snapshot = () =>
      Promise.all([
        readdir(root).then((entries) => entries.sort()),
        ...['.git/index', 'file', '.git/HEAD', '.git/config', '.gitconfig'].map((path) =>
          readFile(join(root, path)),
        ),
      ]);
    const before = await snapshot();
    const cwd = outside ? await mkdtemp(join(tmpdir(), 'type-git-credential-outside-')) : root;
    try {
      const expected = spawnSync('git', ['-C', cwd, 'credential', ...words], {
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
      const actual = await git.command('credential', args as never, { stdin: input });
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
  it('retains successful approve/reject with isolated empty helpers inside and outside repositories', async () => {
    const payload = 'protocol=https\nhost=fixture.invalid\n\n';
    for (const outside of [false, true]) {
      for (const operation of ['approve', 'reject']) {
        const result = await compare([{ operand: operation }], [operation], payload, outside);
        expect(result.status).toBe(0);
        expect(result.stdout).toBe('');
      }
    }
  });
  it('preserves selected native capability availability', async () => {
    for (const outside of [false, true]) {
      await compare([{ operand: 'capability' }], ['capability'], '', outside);
    }
  });
  it('preserves malformed credential input failures without invoking helpers', async () => {
    for (const outside of [false, true]) {
      const result = await compare([{ operand: 'approve' }], ['approve'], 'malformed\n\n', outside);
      expect(result.status).toBe(128);
      expect(result.stderr).toContain('unable to read credential from stdin');
    }
  });
  it('rejects non-usage operands and multiword help', async () => {
    expect(native(['credential', 'ordinary', '--help']).status).toBe(129);
    await expect(
      repo.command('credential', [{ operand: 'ordinary' }, ['--help']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    await expect(
      repo.command('credential', [{ operand: 'ordinary' }] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    await expect(
      repo.command('credential', [['-h'], { operand: 'ignored' }] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });
});

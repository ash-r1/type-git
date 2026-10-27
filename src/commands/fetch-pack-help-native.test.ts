import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NodeExecAdapter, NodeFsAdapter, TypeGit } from '../adapters/node/index.js';
import { createGitSync } from '../impl/git-impl.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('fetch-pack sole full usage and diagnostic controls', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-fetch-pack-help-'));
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
      GIT_EDITOR: 'fixture-editor',
      GIT_PAGER: 'fixture-pager',
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

  const compare = async (
    args: readonly unknown[],
    words: string[],
    input: string | Uint8Array = '',
    outside = false,
    outsideParent = tmpdir(),
  ) => {
    const snapshot = () =>
      Promise.all([
        readdir(root).then((entries) => entries.sort()),
        Promise.resolve(native(['show-ref']).stdout),
        ...['.git/index', 'file', '.git/HEAD'].map((path) => readFile(join(root, path))),
      ]);
    const cwd = outside ? await mkdtemp(join(outsideParent, 'type-git-fetch-pack-outside-')) : root;
    const commandEnv = outside ? { ...env, GIT_CEILING_DIRECTORIES: dirname(cwd) } : env;
    const before = await snapshot();
    try {
      if (outside) {
        const discovery = spawnSync('git', ['-C', cwd, 'rev-parse', '--is-inside-work-tree'], {
          env: commandEnv,
          input: '',
          encoding: 'utf8',
          timeout: 30_000,
        });
        expect(discovery.error).toBeUndefined();
        expect(discovery.signal).toBeNull();
        expect(discovery.status).toBe(128);
        expect(discovery.stderr).toContain('not a git repository');
      }
      const expected = spawnSync('git', ['-C', cwd, 'fetch-pack', ...words], {
        env: commandEnv,
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
              env: commandEnv,
            }),
          )
        : repo;
      const actual = await git.command('fetch-pack', args as never, { stdin: input });
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
  it('preserves sole full usage status and streams inside and outside', async () => {
    for (const outside of [false, true]) {
      const result = await compare([['--help-all']], ['--help-all'], '', outside);
      if (!outside) {
        expect([0, 129]).toContain(result.status);
        expect(result.stdout + result.stderr).toContain('usage: git fetch-pack');
      }
    }
  });
  it('preserves diagnosis controls without fetching or creating refs', async () => {
    for (const outside of [false, true]) {
      for (const url of ['file:///nonexistent', 'git://example.invalid/repo']) {
        const result = await compare(
          [['--diag-url'], { operand: url }],
          ['--diag-url', url],
          '',
          outside,
        );
        if (!outside) {
          expect(result.status).toBe(0);
          expect(result.stdout).toContain('Diag: url=');
        }
      }
    }
  });
  it('keeps outside controls outside when the temporary directory has a repository parent', async () => {
    const nested = await mkdtemp(join(root, 'nested-temp-'));
    try {
      const inherited = spawnSync('git', ['-C', nested, 'rev-parse', '--is-inside-work-tree'], {
        env,
        input: '',
        encoding: 'utf8',
        timeout: 30_000,
      });
      expect(inherited.error).toBeUndefined();
      expect(inherited.signal).toBeNull();
      expect(inherited.status).toBe(0);
      expect(inherited.stdout.trim()).toBe('true');
      await compare([['--help-all']], ['--help-all'], '', true, nested);
      await compare(
        [['--diag-url'], { operand: 'file:///nonexistent' }],
        ['--diag-url', 'file:///nonexistent'],
        '',
        true,
        nested,
      );
    } finally {
      await rm(nested, { recursive: true, force: true });
    }
  });
  it('retains missing destination validation', async () => {
    await expect(repo.command('fetch-pack', [] as never)).rejects.toBeInstanceOf(GitArgumentError);
    await expect(repo.command('fetch-pack', [['--diag-url']] as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
  });
});

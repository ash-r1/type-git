import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NodeExecAdapter, NodeFsAdapter, TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { createGitSync } from '../impl/git-impl.js';

describe('check-ref-format sole full usage and refname controls', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-check-ref-format-help-'));
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
  ) => {
    const snapshot = () =>
      Promise.all([
        readdir(root).then((entries) => entries.sort()),
        Promise.resolve(native(['show-ref']).stdout),
        ...['.git/index', 'file', '.git/HEAD'].map((path) => readFile(join(root, path))),
      ]);
    const before = await snapshot();
    const cwd = outside
      ? await mkdtemp(join(tmpdir(), 'type-git-check-ref-format-outside-'))
      : root;
    try {
      const expected = spawnSync('git', ['-C', cwd, 'check-ref-format', ...words], {
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
      const actual = await git.command('check-ref-format', args as never, { stdin: input });
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
      expect([0, 129]).toContain(result.status);
      expect(result.stdout + result.stderr).toContain('usage: git check-ref-format');
    }
  });
  it('retains normal and invalid refname native results without creating refs', async () => {
    for (const outside of [false, true]) {
      for (const [args, words] of [
        [[{ operand: 'refs/heads/main' }], ['refs/heads/main']],
        [
          [['--normalize'], { operand: '//refs//heads/main' }],
          ['--normalize', '//refs//heads/main'],
        ],
        [
          [['--branch'], { operand: 'topic' }],
          ['--branch', 'topic'],
        ],
        [
          [['--allow-onelevel'], { operand: 'topic' }],
          ['--allow-onelevel', 'topic'],
        ],
        [[{ operand: 'bad..ref' }], ['bad..ref']],
      ] as const) {
        const result = await compare(args, [...words], '', outside);
        expect(result.status).toBe(words[0] === 'bad..ref' ? 1 : 0);
      }
    }
  });
  it('retains missing refname validation', async () => {
    await expect(repo.command('check-ref-format', [] as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
  });
});

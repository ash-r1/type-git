import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NodeExecAdapter, NodeFsAdapter, TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { createGitSync } from '../impl/git-impl.js';

describe('remote helper sole usage and capabilities controls', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-remote-helpers-help-'));
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
    command: 'remote-fd' | 'remote-ext',
    input: string | Uint8Array = '',
    outside = false,
  ) => {
    const snapshot = () =>
      Promise.all([
        readdir(root).then((entries) => entries.sort()),
        ...['.git/index', 'file', '.git/HEAD'].map((path) => readFile(join(root, path))),
      ]);
    const before = await snapshot();
    const cwd = outside ? await mkdtemp(join(tmpdir(), 'type-git-remote-helpers-outside-')) : root;
    try {
      const expected = spawnSync('git', ['-C', cwd, command, ...words], {
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
      const actual = await git.command(command, args as never, { stdin: input });
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
  for (const command of ['remote-fd', 'remote-ext'] as const) {
    const target = () => (command === 'remote-fd' ? '0,1' : join(root, 'must-not-execute'));
    it(`${command} matches sole canonical and tagged usage`, async () => {
      for (const outside of [false, true]) {
        for (const flag of ['-h', '--help-all']) {
          await compare([[flag]], [flag], command, '', outside);
          await compare([{ operand: flag }], [flag], command, '', outside);
        }
      }
    });
    it(`${command} handles capabilities and EOF without transfer or child execution`, async () => {
      for (const outside of [false, true]) {
        for (const remote of ['fixture', '-h', '--help-all']) {
          const result = await compare(
            [{ operand: remote }, { operand: target() }],
            [remote, target()],
            command,
            'capabilities\n',
            outside,
          );
          expect(result.status).toBe(0);
          expect(result.stdout).toBe('*connect\n\n');
        }
        const result = await compare(
          [{ operand: 'fixture' }, { operand: target() }],
          ['fixture', target()],
          command,
          '',
          outside,
        );
        expect(result.status).toBe(0);
        expect(result.stdout).toBe('');
      }
    });
    it(`${command} preserves native bad-command failures`, async () => {
      for (const outside of [false, true]) {
        const result = await compare(
          [{ operand: 'fixture' }, { operand: target() }],
          ['fixture', target()],
          command,
          'invalid\n',
          outside,
        );
        expect(result.status).toBe(command === 'remote-fd' ? 128 : 1);
        expect(result.stderr).toContain('Bad command');
      }
    });
    it(`${command} retains argument representation boundaries`, async () => {
      for (const args of [
        [],
        [{ operand: 'fixture' }],
        [['-h'], { operand: target() }],
        [['--help-all'], { operand: target() }],
        [{ operand: 'fixture' }, ['--help']],
      ]) {
        await expect(repo.command(command, args as never)).rejects.toBeInstanceOf(GitArgumentError);
      }
    });
  }
});

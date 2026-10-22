import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import type { GitCommandName } from './types.js';

const commands: readonly [GitCommandName, readonly string[]][] = [
  ['log', ['HEAD']],
  ['show', ['HEAD']],
  ['rev-list', ['HEAD']],
  ['whatchanged', ['HEAD']],
  ['shortlog', ['HEAD']],
  ['reflog', ['HEAD']],
  ['reflog show', ['HEAD']],
  ['format-patch', ['--stdout', 'HEAD']],
  ['diff', []],
  ['diff-files', []],
  ['diff-tree', ['HEAD']],
  ['blame', ['HEAD', '--', 'file']],
  ['annotate', ['HEAD', '--', 'file']],
  ['fast-export', ['HEAD']],
  ['stash show', []],
  ['last-modified', ['HEAD', '--', 'file']],
  ['pickaxe', ['HEAD', '--', 'file']],
];

describe('revision count shorthand', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  const native = (args: readonly string[]) => {
    const result = spawnSync('git', ['-C', root, ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    return result;
  };
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-revision-count-'));
    env = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')),
      ),
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      LC_ALL: 'C',
      GIT_PAGER: 'cat',
      PAGER: 'cat',
      GIT_TERMINAL_PROMPT: '0',
    };
    for (const args of [
      ['init'],
      ['config', 'user.name', 'Fixture'],
      ['config', 'user.email', 'fixture@example.invalid'],
    ]) {
      expect(native(args).status).toBe(0);
    }
    await writeFile(join(root, 'file'), 'one\n');
    expect(native(['add', 'file']).status).toBe(0);
    expect(native(['commit', '-m', 'fixture']).status).toBe(0);
    await writeFile(join(root, 'file'), 'two\n');
    expect(native(['stash', 'push', '-m', 'fixture stash']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.each(commands)('preserves native digit counts for %s', async (command, suffix) => {
    for (const count of ['-0', '-3', '-01', '-2147483647']) {
      const expected = native([...command.split(' '), count, ...suffix]);
      expect([0, 1, 128, 129]).toContain(expected.status);
      if (expected.status !== 0) {
        // Actual executable availability and semantic failures remain native failures.
        expect(expected.stdout + expected.stderr).not.toBe('');
      }
      const args = [
        [count],
        ...suffix.map((word) =>
          word === '--' || word === '--stdout' ? [word] : { operand: word },
        ),
      ];
      if (
        command === 'whatchanged' &&
        expected.status === 128 &&
        expected.stderr.includes('--i-still-use-this')
      ) {
        // This schema rejects the actual deprecation prerequisite before execution.
        await expect(repo.command(command, args as never)).rejects.toBeInstanceOf(GitArgumentError);
        continue;
      }
      const actual = await repo.command(command, args as never);
      expect(actual.exitCode).toBe(expected.status);
      expect(actual.stdout).toBe(expected.stdout);
      expect(actual.stderr).toBe(expected.stderr);
    }
  });

  it('checks decimal overflow even when the selected Git uses legacy atoi for named counts', async () => {
    const expected = native(['log', '-2147483648', 'HEAD']);
    expect(expected.status).toBe(128);
    expect(expected.stderr).toMatch(/not (?:an integer|a non-negative integer)/);
    await expect(
      repo.command('log', [['-2147483648'], { operand: 'HEAD' }] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });
});

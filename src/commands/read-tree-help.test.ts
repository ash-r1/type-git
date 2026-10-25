import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('read-tree selected exclude callback family', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-read-tree-help-'));
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

  const controls = [['read-tree', '--dry-run']] as const;
  type Command = (typeof controls)[number][0];
  const compare = async (
    command: Command,
    args: readonly (readonly string[])[],
    words: string[],
  ) => {
    const expected = native([command, ...words]);
    const actual = await repo.command(command, args as never);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  for (const [command, option] of controls) {
    it(`${command}: short and full help bypass final checks`, async () => {
      for (const flag of ['-h', '--help-all']) {
        const result = await compare(command, [[flag]], [flag]);
        expect([0, 129]).toContain(result.status);
        expect(result.stdout + result.stderr).toContain('usage:');
      }
      for (const flag of ['-h', '--help', '--help-all']) {
        await compare(
          command,
          [[option], [flag], ['--git-completion-helper']],
          [option, flag, '--git-completion-helper'],
        );
      }
    });
    it(`${command}: sole completion retains native success or legacy failure`, async () => {
      for (const flag of ['--git-completion-helper', '--git-completion-helper-all']) {
        const result = await compare(command, [[flag]], [flag]);
        expect([0, 129]).toContain(result.status);
      }
    });
    it(`${command}: reached multiword completion still rejects`, async () => {
      await expect(
        repo.command(command, [['--git-completion-helper'], ['--help-all']] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
      const result = native([command, '--git-completion-helper', '--help-all']);
      expect(result.status).toBe(129);
      expect(result.stderr).toContain('unknown option');
    });
    it(`${command}: help preserves representation constraints`, async () => {
      await expect(
        repo.command(command, [['--help-all'], [option, true]] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
      await expect(
        repo.command(command, [['--help-all'], { operand: '\0' }] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    });
  }
  it('preserves actual old/new exclude callback results before help', async () => {
    for (const value of ['.gitignore', 'other-ignore', '']) {
      for (const update of [false, true]) {
        const words = [...(update ? ['-u'] : []), `--exclude-per-directory=${value}`, '--help-all'];
        const expected = native(['read-tree', ...words]);
        const args = [
          ...(update ? [['-u']] : []),
          ['--exclude-per-directory', value],
          ['--help-all'],
        ];
        if (expected.status === 128) {
          await expect(repo.command('read-tree', args as never)).rejects.toBeInstanceOf(
            GitArgumentError,
          );
          expect(expected.stderr).toContain('exclude-per-directory');
        } else {
          await compare('read-tree', args, words);
          expect([0, 129]).toContain(expected.status);
          expect(expected.stdout + expected.stderr).toContain('usage:');
        }
      }
    }
  });
  it('enforces a reached old duplicate callback or permits modern repeats', async () => {
    const words = [
      '-u',
      '--exclude-per-directory=.gitignore',
      '--exclude-per-directory=.gitignore',
      '--help-all',
    ];
    const args = [
      ['-u'],
      ['--exclude-per-directory', '.gitignore'],
      ['--exclude-per-directory', '.gitignore'],
      ['--help-all'],
    ];
    const expected = native(['read-tree', ...words]);
    if (expected.status === 128) {
      expect(expected.stderr).toContain('more than one --exclude-per-directory');
      await expect(repo.command('read-tree', args as never)).rejects.toBeInstanceOf(
        GitArgumentError,
      );
    } else {
      await compare('read-tree', args, words);
    }
  });
  it('earlier help skips later callback and final mode checks', async () => {
    await compare(
      'read-tree',
      [['--help-all'], ['--exclude-per-directory', 'other'], ['--exclude-per-directory', 'again']],
      ['--help-all', '--exclude-per-directory=other', '--exclude-per-directory=again'],
    );
    await compare(
      'read-tree',
      [['-m'], ['--reset'], ['--help-all']],
      ['-m', '--reset', '--help-all'],
    );
  });
});

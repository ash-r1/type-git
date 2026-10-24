import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('four ordinary parser help exits', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-four-parser-help-'));
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

  const controls = [
    ['hash-object', '--no-filters'],
    ['rerere', '--rerere-autoupdate'],
    ['merge-file', '--stdout'],
    ['check-attr', '--all'],
  ] as const;
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
  it('merge-file: help only skips callbacks not yet reached', async () => {
    for (const flag of ['--marker-size', '--diff-algorithm']) {
      await compare(
        'merge-file',
        [['--help-all'], [flag, 'invalid']],
        ['--help-all', `${flag}=invalid`],
      );
      await expect(
        repo.command('merge-file', [[flag, 'invalid'], ['--help-all']] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
      const result = native(['merge-file', `${flag}=invalid`, '--help-all']);
      expect(result.status).toBe(129);
      expect(result.stderr).toMatch(/error:|invalid/i);
    }
  });
  it('merge-file: fourth-label callback precedes help', async () => {
    await expect(
      repo.command('merge-file', [
        ['-L', 'a'],
        ['-L', 'b'],
        ['-L', 'c'],
        ['-L', 'd'],
        ['--help-all'],
      ] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    const result = native(['merge-file', '-L', 'a', '-L', 'b', '-L', 'c', '-L', 'd', '--help-all']);
    expect(result.status).toBe(129);
    await compare(
      'merge-file',
      [['--help-all'], ['-L', 'a'], ['-L', 'b'], ['-L', 'c'], ['-L', 'd']],
      ['--help-all', '-L', 'a', '-L', 'b', '-L', 'c', '-L', 'd'],
    );
  });
  it('hash-object: required values that resemble help remain values', async () => {
    await compare(
      'hash-object',
      [['-t', '--help-all'], ['--stdin']],
      ['-t', '--help-all', '--stdin'],
    );
  });
});

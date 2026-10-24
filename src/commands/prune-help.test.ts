import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('prune internal help timing', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-prune-help-'));
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

  const controls = [['prune', '--dry-run']] as const;
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
    it(`${command}: recognizes short and full internal help`, async () => {
      for (const flag of ['-h', '--help-all']) {
        const expected = await compare(command, [[flag]], [flag]);
        expect([0, 129]).toContain(expected.status);
        expect(expected.stdout + expected.stderr).toContain('usage:');
      }
    });
    it(`${command}: internal help after an option skips later completion checks`, async () => {
      for (const flag of ['-h', '--help', '--help-all']) {
        const expected = await compare(
          command,
          [[option], [flag], ['--git-completion-helper']],
          [option, flag, '--git-completion-helper'],
        );
        expect([0, 129]).toContain(expected.status);
        expect(expected.stdout + expected.stderr).toContain('usage:');
      }
    });
    it(`${command}: sole completion preserves actual native output or legacy error`, async () => {
      for (const flag of ['--git-completion-helper', '--git-completion-helper-all']) {
        const result = await compare(command, [[flag]], [flag]);
        if (flag === '--git-completion-helper-all' && result.status !== 0) {
          expect(result.status).toBe(129);
          expect(result.stderr).toContain('unknown option');
        } else {
          expect(result.status).toBe(0);
          expect(result.stdout.length).toBeGreaterThan(0);
        }
      }
    });
    it(`${command}: reached multiword completion rejects, earlier help exits`, async () => {
      for (const flag of ['--git-completion-helper', '--git-completion-helper-all']) {
        for (const args of [
          [[flag], ['--help-all']],
          [[option], [flag]],
        ]) {
          const expected = native([command, ...args.map((a) => a[0]!)]);
          expect(expected.status).toBe(129);
          expect(expected.stderr).toContain('unknown option');
          const actual = repo.command(command, args as never);
          await expect(actual).rejects.toBeInstanceOf(GitArgumentError);
          await expect(actual).rejects.toMatchObject({
            message: expect.stringContaining(`cli.${command}.${flag.slice(6)}-one-word`),
          });
        }
        await compare(command, [['--help-all'], [flag]], ['--help-all', flag]);
      }
    });
  }
  it('preserves native expiry failures before help and skips later expiry parsing', async () => {
    for (const help of ['-h', '--help-all']) {
      const before = await compare(
        'prune',
        [['--expire', 'not-a-date'], [help]],
        ['--expire=not-a-date', help],
      );
      expect(before.status).toBe(128);
      expect(before.stderr).toContain('malformed expiration date');
      const after = await compare(
        'prune',
        [[help], ['--expire', 'not-a-date']],
        [help, '--expire=not-a-date'],
      );
      expect([0, 129]).toContain(after.status);
      expect(after.stdout + after.stderr).toContain('usage:');
    }
  });
});

import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('full internal help in reference parsers', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-date-mode-'));
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

  for (const [command, flag] of [
    ['branch', '--track'],
    ['for-each-ref', '--count'],
    ['tag', '-n'],
    ['show-branch', '--more'],
  ] as const) {
    it(`${command}: full help exits before later callbacks and retains extended usage`, async () => {
      for (const args of [
        [['--help-all']],
        [['--help-all'], [flag, 'invalid']],
        [['--help-all'], ['--git-completion-helper']],
      ]) {
        const words = args.map((a) =>
          a.length === 1 ? a[0]! : a[0]!.startsWith('--') ? `${a[0]}=${a[1]}` : `${a[0]}${a[1]}`,
        );
        const expected = native([command, ...words]);
        expect([0, 129]).toContain(expected.status);
        expect(expected.stdout + expected.stderr).toContain('usage:');
        const actual = await repo.command(command, args as never);
        expect(actual.exitCode).toBe(expected.status);
        expect(actual.stdout).toBe(expected.stdout);
        expect(actual.stderr).toBe(expected.stderr);
      }
    }, 120_000);
    it(`${command}: keeps a reached bad callback before full help`, async () => {
      const words = flag.startsWith('--') ? [`${flag}=invalid`] : [`${flag}invalid`];
      const expected = native([command, ...words, '--help-all']);
      expect(expected.status).not.toBe(0);
      expect(expected.stderr).toMatch(/invalid|unknown|expects|unsupported|takes no value/);
      const actual = repo.command(command, [[flag, 'invalid'], ['--help-all']] as never);
      await expect(actual).rejects.toBeInstanceOf(GitArgumentError);
      await expect(actual).rejects.toMatchObject({ message: expect.stringContaining(flag) });
    }, 120_000);
  }
});

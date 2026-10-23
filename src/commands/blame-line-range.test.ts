import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';

describe('deferred blame line-range numeric boundaries', () => {
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
    await writeFile(join(root, 'file'), 'base\nsecond\nthird\nfourth\nfifth\n');
    expect(native(['add', 'file']).status).toBe(0);
    expect(native(['commit', '-qm', 'base']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  for (const command of ['blame', 'annotate', 'pickaxe'] as const) {
    it(`${command}: rejects each reached nonpositive numeric range`, async () => {
      for (const value of ['0', '-1', '+0', '  -0', '1,0', '1,+0', '1,-0', ',+0', '1, -2']) {
        const expected = native([command, '-L', value, 'HEAD', '--', 'file']);
        expect(expected.status).toBe(128);
        expect(expected.stderr).toMatch(/-L invalid (?:line number|empty range)/);
        for (const ranges of [
          [['-L', value]],
          [
            ['-L', value],
            ['-L', '1'],
          ],
        ]) {
          await expect(
            repo.command(command, [
              ...ranges,
              { operand: 'HEAD' },
              ['--'],
              { operand: 'file' },
            ] as never),
          ).rejects.toThrow(`[cli.${command}.line-range-numbers]`);
        }
      }
    }, 120_000);
    it(`${command}: help exits before deferred ranges in either order`, async () => {
      for (const args of [
        [['-L', '0'], ['-h']],
        [['-h'], ['-L', '0']],
      ]) {
        const words = args.flatMap((a) => (a.length === 1 ? [a[0]!] : [a[0]!, a[1]!]));
        const expected = native([command, ...words]);
        expect([0, 129]).toContain(expected.status);
        expect(expected.stdout + expected.stderr).toContain('usage:');
        const actual = await repo.command(command, args as never);
        expect(actual.exitCode).toBe(expected.status);
        expect(actual.stdout).toBe(expected.stdout);
        expect(actual.stderr).toBe(expected.stderr);
      }
    }, 120_000);
    it(`${command}: retains native empty, reversed, clipped and regex ranges`, async () => {
      for (const value of ['', ',', '1', '3,1', '1,999', '/base/', '1,+2', '3,-2']) {
        const expected = native([command, '-L', value, 'HEAD', '--', 'file']);
        expect(expected.status).toBe(0);
        const actual = await repo.command(command, [
          ['-L', value],
          { operand: 'HEAD' },
          ['--'],
          { operand: 'file' },
        ] as never);
        expect(actual.exitCode).toBe(expected.status);
        expect(actual.stdout).toBe(expected.stdout);
        expect(actual.stderr).toBe(expected.stderr);
      }
    }, 120_000);
  }
});

import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';

const nativeVersion = spawnSync('git', ['--version'], { encoding: 'utf8', timeout: 10000 });
expect(nativeVersion.error).toBeUndefined();
expect(nativeVersion.status).toBe(0);
const supportsOptionalStat = /^git version 2\.(55|56)\./.test(nativeVersion.stdout);

describe.skipIf(!supportsOptionalStat)('selected native optional stat and callback order', () => {
  it('retains an earlier optional stat failure before a later invalid color', async () => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-stat-color-order-'));
    try {
      const env = {
        ...process.env,
        GIT_CONFIG_COUNT: '0',
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_GLOBAL: join(root, 'unused-config'),
        GIT_CONFIG_NOSYSTEM: '1',
        LC_ALL: 'C',
      };
      const repo = await new TypeGit({ inheritEnv: false, env }).init(join(root, 'repo'));
      await writeFile(join(repo.workdir, 'message'), 'fixture message\n');
      const words = ['tag', '--list', '--file=:(optional)message/child', '--color=invalid'];
      const native = spawnSync('git', words, {
        cwd: repo.workdir,
        env: { ...process.env, ...env },
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(native.error).toBeUndefined();
      expect(native.signal).toBeNull();
      if (process.platform === 'win32') {
        expect(native.status).toBe(129);
        expect(native.stderr).toContain('color');
        await expect(
          repo.command('tag', [
            ['--list'],
            ['--file', ':(optional)message/child'],
            ['--color', 'invalid'],
          ] as never),
        ).rejects.toBeInstanceOf(GitArgumentError);
        return;
      }
      expect(native.status).toBe(128);
      expect(native.stderr).toContain('could not stat message/child');
      const result = await repo.command('tag', [
        ['--list'],
        ['--file', ':(optional)message/child'],
        ['--color', 'invalid'],
      ] as never);
      expect(result.exitCode).toBe(native.status);
      expect(result.stderr).toBe(native.stderr);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('still rejects an invalid color callback reached before optional stat', async () => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-color-stat-order-'));
    try {
      const env = {
        ...process.env,
        GIT_CONFIG_COUNT: '0',
        HOME: root,
        GIT_CONFIG_GLOBAL: join(root, 'unused-config'),
        GIT_CONFIG_NOSYSTEM: '1',
        LC_ALL: 'C',
      };
      const repo = await new TypeGit({ inheritEnv: false, env }).init(join(root, 'repo'));
      await writeFile(join(repo.workdir, 'message'), 'fixture message\n');
      const native = spawnSync(
        'git',
        ['tag', '--list', '--color=invalid', '--file=:(optional)message/child'],
        { cwd: repo.workdir, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 10000 },
      );
      expect(native.error).toBeUndefined();
      expect(native.status).toBe(129);
      expect(native.stderr).toMatch(/option .*color.* expects/);
      await expect(
        repo.command('tag', [
          ['--list'],
          ['--color', 'invalid'],
          ['--file', ':(optional)message/child'],
        ] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('validates the callback between two optional file lookups before probing the later file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-two-stat-order-'));
    try {
      const env = {
        ...process.env,
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_GLOBAL: join(root, 'unused'),
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_COUNT: '0',
        LC_ALL: 'C',
      };
      const repo = await new TypeGit({ inheritEnv: false, env }).init(join(root, 'repo'));
      await writeFile(join(repo.workdir, 'message'), 'fixture\n');
      const args = [
        ['--list'],
        ['--file', ':(optional)missing'],
        ['--color', 'invalid'],
        ['--file', ':(optional)message/child'],
      ];
      const native = spawnSync(
        'git',
        [
          'tag',
          '--list',
          '--file=:(optional)missing',
          '--color=invalid',
          '--file=:(optional)message/child',
        ],
        { cwd: repo.workdir, env, encoding: 'utf8', timeout: 10000 },
      );
      expect(native.error).toBeUndefined();
      expect(native.status).toBe(129);
      expect(native.stderr).toContain('color');
      await expect(repo.command('tag', args as never)).rejects.toBeInstanceOf(GitArgumentError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it.each([
    '--format',
    '--unknown',
    '-F',
  ])('retains an earlier optional stat error before later parser syntax %s', async (tail) => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-stat-syntax-'));
    try {
      const env = {
        ...process.env,
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_GLOBAL: join(root, 'unused'),
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_COUNT: '0',
        LC_ALL: 'C',
      };
      const repo = await new TypeGit({ inheritEnv: false, env }).init(join(root, 'repo'));
      await writeFile(join(repo.workdir, 'file'), 'fixture\n');
      const words = ['tag', '--list', '--file=:(optional)file/child', tail];
      const native = spawnSync('git', words, {
        cwd: repo.workdir,
        env,
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(native.error).toBeUndefined();
      if (process.platform === 'win32') {
        expect(native.status).toBe(129);
        await expect(
          repo.command('tag', [
            ['--list'],
            ['--file', ':(optional)file/child'],
            { operand: tail },
          ] as never),
        ).rejects.toBeInstanceOf(GitArgumentError);
        return;
      }
      expect(native.status).toBe(128);
      const result = await repo.command('tag', [
        ['--list'],
        ['--file', ':(optional)file/child'],
        { operand: tail },
      ] as never);
      expect(result.exitCode).toBe(native.status);
      expect(result.stderr).toBe(native.stderr);
      // ENOENT returns to parsing, so the same later syntax still rejects.
      await expect(
        repo.command('tag', [
          ['--list'],
          ['--file', ':(optional)missing'],
          { operand: tail },
        ] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

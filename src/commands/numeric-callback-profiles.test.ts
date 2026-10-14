import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';

/** Compare complete readonly execution against the selected Git, including older callbacks. */
describe('selected native numeric callback implementations', () => {
  let root: string;
  let env: NodeJS.ProcessEnv;
  let git: TypeGit;
  let fsmonitorAvailable: boolean;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-callback-profile-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'config'),
      LC_ALL: 'C',
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    };
    const run = (...args: string[]) => {
      const result = spawnSync('git', ['-C', root, ...args], { env, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
    };
    run('init');
    await writeFile(join(root, 'file'), 'one\n');
    run('add', 'file');
    run('commit', '-m', 'base');
    run('commit', '--allow-empty', '-m', 'second');
    git = new TypeGit({ home: root, inheritEnv: false, env });
    const fsmonitor = spawnSync('git', ['-C', root, 'fsmonitor--daemon', '--ipc-threads=1', '-h'], {
      env,
      encoding: 'utf8',
    });
    fsmonitorAvailable =
      (fsmonitor.status === 0 || fsmonitor.status === 129) &&
      (fsmonitor.stdout + fsmonitor.stderr).includes('usage:');
    if (!fsmonitorAvailable) {
      expect(fsmonitor.stderr).toMatch(/not a git command|not supported|not built/i);
    }
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  for (const value of ['1k', '', '2147483648', 1.5, 1e-7]) {
    it(`preserves actual revision-count behavior for ${JSON.stringify(value)}`, async () => {
      const native = spawnSync('git', ['-C', root, 'rev-list', `--max-count=${value}`, '--all'], {
        env,
        encoding: 'utf8',
      });
      const repo = await git.open(root);
      if (native.status === 0) {
        const result = await repo.command('rev-list', [['--max-count', value], ['--all']] as never);
        expect(result.exitCode).toBe(native.status);
        expect(result.stdout).toBe(native.stdout);
      } else {
        expect(native.stderr).toContain('not an integer');
        await expect(
          repo.command('rev-list', [['--max-count', value], ['--all']] as never),
        ).rejects.toBeInstanceOf(GitArgumentError);
      }
    });
  }

  it('preserves actual negative unified-context behavior', async () => {
    const native = spawnSync('git', ['-C', root, 'diff-files', '--unified=-1'], {
      env,
      encoding: 'utf8',
    });
    const repo = await git.open(root);
    if (native.status === 0) {
      const result = await repo.command('diff-files', [['--unified', '-1']] as never);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(native.stdout);
    } else {
      expect(native.stderr).toContain('expects a non-negative integer');
      await expect(
        repo.command('diff-files', [['--unified', '-1']] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    }
  });

  it('preserves actual atoi versus checked strip count on a real patch', async () => {
    const patch = 'diff --git a/file b/file\n--- a/file\n+++ b/file\n@@ -1 +1 @@\n-one\n+two\n';
    const native = spawnSync('git', ['-C', root, 'apply', '-p', '1k', '--check'], {
      env,
      encoding: 'utf8',
      input: patch,
    });
    const repo = await git.open(root);
    if (native.status === 0) {
      const result = await repo.command('apply', [['-p', '1k'], ['--check']] as never, {
        stdin: patch,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe(native.stderr);
    } else {
      expect(native.stderr).toContain('expects a non-negative integer');
      await expect(
        repo.command('apply', [['-p', '1k'], ['--check']] as never, { stdin: patch }),
      ).rejects.toBeInstanceOf(GitArgumentError);
    }
  });

  it('combines revision count and unified context from the same executable', async () => {
    const native = spawnSync('git', ['-C', root, 'log', '--max-count=2', '--unified=-1', '--all'], {
      env,
      encoding: 'utf8',
    });
    const repo = await git.open(root);
    if (native.status === 0) {
      const actual = await repo.command('log', [
        ['--max-count', '2'],
        ['--unified', '-1'],
        ['--all'],
      ] as never);
      expect(actual.exitCode).toBe(0);
      expect(actual.stdout).toBe(native.stdout);
    } else {
      expect(native.stderr).toContain('expects a non-negative integer');
      await expect(
        repo.command('log', [['--max-count', '2'], ['--unified', '-1'], ['--all']] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    }
  });

  it('retains daemon count parsing while help prevents daemon startup', async () => {
    const native = spawnSync('git', ['-C', root, 'daemon', '--max-connections=1k', '-h'], {
      env,
      encoding: 'utf8',
    });
    const repo = await git.open(root);
    if (
      (native.status === 0 || native.status === 129) &&
      (native.stdout + native.stderr).includes('usage:')
    ) {
      const actual = await repo.command('daemon', [['--max-connections', '1k'], ['-h']] as never);
      expect(actual.exitCode).toBe(native.status);
      expect(actual.stdout).toBe(native.stdout);
      expect(actual.stderr).toBe(native.stderr);
    } else {
      expect(native.status).toBe(128);
      expect(native.stderr).toContain('invalid max-connections');
      await expect(
        repo.command('daemon', [['--max-connections', '1k'], ['-h']] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    }
  });

  for (const flag of ['--timeout', '--init-timeout']) {
    it(`preserves actual unsigned atoi versus checked parsing for ${flag}`, async () => {
      const repo = await git.open(root);
      for (const value of ['1k', '-0', '-1', '4294967296']) {
        const native = spawnSync('git', ['-C', root, 'daemon', `${flag}=${value}`, '-h'], {
          env,
          encoding: 'utf8',
        });
        if (
          (native.status === 0 || native.status === 129) &&
          (native.stdout + native.stderr).includes('usage:')
        ) {
          const actual = await repo.command('daemon', [[flag, value], ['-h']] as never);
          expect(actual.exitCode).toBe(native.status);
          expect(actual.stdout).toBe(native.stdout);
          expect(actual.stderr).toBe(native.stderr);
        } else {
          expect(native.status).toBe(128);
          expect(native.stderr).toContain('expecting a non-negative integer');
          await expect(
            repo.command('daemon', [[flag, value], ['-h']] as never),
          ).rejects.toBeInstanceOf(GitArgumentError);
        }
      }
    });
  }

  it('uses native integer radix and units for manual fsmonitor schemas', async (context) => {
    if (!fsmonitorAvailable) {
      context.skip();
    }
    const repo = await git.open(root);
    for (const value of ['1k', '0x10']) {
      const native = spawnSync(
        'git',
        ['-C', root, 'fsmonitor--daemon', `--ipc-threads=${value}`, '-h'],
        { env, encoding: 'utf8' },
      );
      expect([0, 129], native.stderr).toContain(native.status);
      expect(native.stdout + native.stderr).toContain('usage:');
      if (/error:/.test(native.stderr)) {
        expect(native.stderr).toMatch(/numerical value|integer|range/);
        await expect(
          repo.command('fsmonitor--daemon', [['--ipc-threads', value], ['-h']] as never),
        ).rejects.toBeInstanceOf(GitArgumentError);
        continue;
      }
      const actual = await repo.command('fsmonitor--daemon', [
        ['--ipc-threads', value],
        ['-h'],
      ] as never);
      expect(actual.exitCode).toBe(native.status);
      expect(actual.stdout).toBe(native.stdout);
      expect(actual.stderr).toBe(native.stderr);
    }
  });
});

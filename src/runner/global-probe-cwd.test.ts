import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { CliRunner } from './cli-runner.js';

describe('repository-requiring probes in global contexts', () => {
  const originalCwd = process.cwd();
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-global-probe-'));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(root, { recursive: true, force: true });
  });

  const validate = async (cwd: string) => {
    process.chdir(cwd);
    const adapters = createNodeAdapters();
    const createTempDirectory = vi.spyOn(adapters.fs, 'createTempDirectory');
    const outcome = await new CliRunner(adapters)
      .validateFilterOptions(
        { type: 'global' },
        'clone',
        { filter: 'blob:limit=-1' },
        { env: { GIT_CEILING_DIRECTORIES: root } },
      )
      .then(
        () => 'accepted',
        (error: Error) => error.name,
      );
    for (const result of createTempDirectory.mock.results) {
      expect(existsSync(await (result.value as Promise<string>))).toBe(false);
    }
    return outcome;
  };

  it('does not depend on whether process.cwd() is inside a repository', async () => {
    const repo = join(root, 'repo');
    const outside = join(root, 'outside');
    await mkdir(outside);
    expect(spawnSync('git', ['init', '--quiet', repo]).status).toBe(0);

    const inside = await validate(repo);
    const elsewhere = await validate(outside);
    expect(elsewhere).toBe(inside);
  });

  it('runs the sign probe against a throwaway repository and removes it', async () => {
    const adapters = createNodeAdapters();
    adapters.fs.createTempDirectory = vi.fn().mockResolvedValue('/tmp/type-git-probe-1');
    adapters.fs.deleteDirectory = vi.fn().mockResolvedValue(undefined);
    adapters.exec.spawn = vi.fn().mockImplementation(async ({ argv }: { argv: string[] }) =>
      argv.includes('init')
        ? { exitCode: 0, stdout: '', stderr: '', aborted: false }
        : {
            exitCode: 129,
            stdout: '',
            stderr: 'error: expects a non-negative integer value',
            aborted: false,
          },
    );
    const signal = new AbortController().signal;
    await expect(
      new CliRunner(adapters, { gitBinary: 'selected-git' }).validateFilterOptions(
        { type: 'global' },
        'clone',
        { filter: 'blob:limit=-1' },
        { env: { PATH: '/selected' }, signal },
      ),
    ).rejects.toThrow();
    const calls = vi.mocked(adapters.exec.spawn).mock.calls.map(([options]) => options);
    expect(calls.map((options) => options.argv)).toEqual([
      ['selected-git', 'init', '--bare', '--quiet', '/tmp/type-git-probe-1'],
      [
        'selected-git',
        '--git-dir',
        '/tmp/type-git-probe-1',
        'pack-objects',
        '--max-pack-size=-0',
        '-h',
      ],
    ]);
    for (const options of calls) {
      expect(options.env).toMatchObject({ PATH: '/selected' });
      expect(options.signal).toBe(signal);
    }
    expect(adapters.fs.deleteDirectory).toHaveBeenCalledWith('/tmp/type-git-probe-1');
  });
});

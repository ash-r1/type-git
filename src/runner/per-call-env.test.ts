/**
 * Per-call `env` on raw() and typed command()
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NodeExecAdapter } from '../adapters/node/exec.js';
import { NodeFsAdapter } from '../adapters/node/fs.js';
import type { ExecAdapter, SpawnOptions, StreamHandler } from '../core/adapters.js';
import type { Git } from '../core/git.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { createGit } from '../impl/git-impl.js';

// GIT_CONFIG_PARAMETERS works on every supported Git, unlike GIT_CONFIG_COUNT (Git 2.31+).
const configEnv: Record<string, string> = {
  GIT_CONFIG_PARAMETERS: "'typegit.percall=yes'",
};

describe('per-call env', () => {
  const spawned: SpawnOptions[] = [];
  let dir: string;
  let git: Git;
  let repo: WorktreeRepo;

  beforeAll(async () => {
    const inner = new NodeExecAdapter();
    const exec: ExecAdapter = {
      getCapabilities: () => inner.getCapabilities(),
      spawn: (options: SpawnOptions, handlers?: StreamHandler) => {
        spawned.push(options);
        return inner.spawn(options, handlers);
      },
    };
    git = await createGit({
      adapters: { exec, fs: new NodeFsAdapter() },
      env: { TYPE_GIT_BASE: 'base' },
      skipVersionCheck: true,
    });
    dir = await mkdtemp(join(tmpdir(), 'type-git-per-call-env-'));
    repo = await git.init(join(dir, 'repo'));
  });

  afterAll(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('applies env to repository raw() over the configured env', async () => {
    const result = await repo.raw(['config', '--get', 'typegit.percall'], { env: configEnv });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('yes');
    const options = spawned.at(-1);
    expect(options?.env).toMatchObject({ ...configEnv, TYPE_GIT_BASE: 'base' });
    expect(options?.inheritEnv).toBe(false);
  });

  const lowerBase = 'type_git_base';

  it('replaces a configured variable that differs only in case on Windows', async () => {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      await git.raw(['--version'], { env: { [lowerBase]: 'call' } });
    } finally {
      if (platform) {
        Object.defineProperty(process, 'platform', platform);
      }
    }
    const env = spawned.at(-1)?.env;
    expect(env).toMatchObject({ [lowerBase]: 'call' });
    expect(env).not.toHaveProperty('TYPE_GIT_BASE');
  });

  it('keeps variables that differ only in case on other platforms', async () => {
    if (process.platform === 'win32') {
      return;
    }
    await git.raw(['--version'], { env: { [lowerBase]: 'call' } });
    expect(spawned.at(-1)?.env).toMatchObject({ [lowerBase]: 'call', TYPE_GIT_BASE: 'base' });
  });

  it('does not persist env to later calls', async () => {
    const result = await repo.raw(['config', '--get', 'typegit.percall']);
    expect(result.exitCode).toBe(1);
    expect(spawned.at(-1)?.env).toMatchObject({ TYPE_GIT_BASE: 'base' });
    expect(spawned.at(-1)?.env).not.toHaveProperty('GIT_CONFIG_PARAMETERS');
  });

  it('applies env to repository-agnostic raw()', async () => {
    const result = await git.raw(['config', '--get', 'typegit.percall'], { env: configEnv });
    expect(result.stdout.trim()).toBe('yes');
  });

  it('applies env to typed command()', async () => {
    const result = await repo.command('config', [['--get'], { operand: 'typegit.percall' }], {
      env: configEnv,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('yes');
    expect(spawned.at(-1)?.env).toMatchObject(configEnv);
  });

  it.each([
    [{ '': 'x' }, 'non-empty'],
    [{ 'A=B': 'x' }, "neither '='"],
    [{ 'A\0B': 'x' }, 'NUL'],
    [{ A: 'x\0y' }, 'without NUL'],
    [{ A: 1 }, 'must be a string'],
    [{ A: undefined }, 'must be a string'],
    [JSON.parse('{"__proto__": "x"}'), 'non-empty'],
    [null, 'object'],
    [['A=1'], 'object'],
  ])('rejects invalid env %j before spawning', async (env, message) => {
    const before = spawned.length;
    await expect(repo.raw(['status'], { env: env as never })).rejects.toThrow(GitArgumentError);
    await expect(repo.raw(['status'], { env: env as never })).rejects.toThrow(message);
    await expect(repo.command('status', [], { env: env as never })).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    expect(spawned.length).toBe(before);
  });

  it('types env as string values', () => {
    // @ts-expect-error env values must be strings
    const invalid: Parameters<WorktreeRepo['raw']>[1] = { env: { A: 1 } };
    expect(invalid).toBeDefined();
  });
});

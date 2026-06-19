/**
 * Tests that an object-form LFS mode (`{ skipSmudge }` / `{ skipDownload }`)
 * injects `GIT_LFS_SKIP_SMUDGE=1` into the environment of working-tree-populating
 * operations so Git leaves LFS pointer files in place instead of downloading them.
 *
 * Uses mock adapters so the spawned environment can be inspected directly.
 */

import { describe, expect, it, type Mock, vi } from 'vitest';
import type { RuntimeAdapters } from '../core/adapters.js';
import type { LfsMode } from '../core/types.js';
import { CliRunner } from '../runner/cli-runner.js';
import { WorktreeRepoImpl } from './worktree-repo-impl.js';

function createMockAdapters(): RuntimeAdapters {
  return {
    exec: {
      getCapabilities: () => ({
        canSpawnProcess: true,
        canReadEnv: true,
        canWriteTemp: true,
        supportsAbortSignal: true,
        supportsKillSignal: true,
        runtime: 'node' as const,
      }),
      // Exit 0 for everything; merge etc. follow their success path.
      spawn: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, aborted: false }),
    },
    fs: {
      createTempFile: vi.fn().mockResolvedValue('/tmp/type-git-lfs-123/temp'),
      tail: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      deleteDirectory: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
      writeFile: vi.fn().mockResolvedValue(undefined),
    },
  };
}

// Find the environment of the spawn call whose argv contains the given subcommand.
function envForSubcommand(spawn: Mock, subcommand: string): Record<string, string> | undefined {
  const call = spawn.mock.calls.find((args) => {
    const opts = args[0] as { argv?: string[] };
    return Array.isArray(opts.argv) && opts.argv.includes(subcommand);
  });
  return (call?.[0] as { env?: Record<string, string> } | undefined)?.env;
}

function makeRepo(lfs?: LfsMode): { repo: WorktreeRepoImpl; spawn: Mock } {
  const adapters = createMockAdapters();
  const repo = new WorktreeRepoImpl(new CliRunner(adapters), '/repo', lfs ? { lfs } : undefined);
  return { repo, spawn: adapters.exec.spawn as Mock };
}

// Each entry: subcommand token in argv + how to invoke it on the repo.
const SMUDGE_OPERATIONS: ReadonlyArray<{
  name: string;
  subcommand: string;
  run: (repo: WorktreeRepoImpl) => Promise<unknown>;
}> = [
  { name: 'checkout', subcommand: 'checkout', run: (r) => r.checkout('feature') },
  { name: 'switch', subcommand: 'switch', run: (r) => r.switch('feature') },
  { name: 'reset', subcommand: 'reset', run: (r) => r.reset('HEAD', { mode: 'hard' }) },
  { name: 'merge', subcommand: 'merge', run: (r) => r.merge('feature') },
  { name: 'pull', subcommand: 'pull', run: (r) => r.pull() },
  { name: 'rebase', subcommand: 'rebase', run: (r) => r.rebase({ upstream: 'main' }) },
  { name: 'restore', subcommand: 'restore', run: (r) => r.restore(['file.txt']) },
];

describe('LFS skip-smudge mode', () => {
  describe('injects GIT_LFS_SKIP_SMUDGE=1 with { skipSmudge: true }', () => {
    for (const op of SMUDGE_OPERATIONS) {
      it(`${op.name} runs with GIT_LFS_SKIP_SMUDGE=1`, async () => {
        const { repo, spawn } = makeRepo({ skipSmudge: true });
        await op.run(repo);
        expect(envForSubcommand(spawn, op.subcommand)).toMatchObject({
          GIT_LFS_SKIP_SMUDGE: '1',
        });
      });
    }
  });

  it('also injects GIT_LFS_SKIP_SMUDGE=1 with { skipDownload: true }', async () => {
    const { repo, spawn } = makeRepo({ skipDownload: true });
    await repo.checkout('feature');
    expect(envForSubcommand(spawn, 'checkout')).toMatchObject({ GIT_LFS_SKIP_SMUDGE: '1' });
  });

  it("does not set GIT_LFS_SKIP_SMUDGE for the 'enabled' mode", async () => {
    const { repo, spawn } = makeRepo('enabled');
    await repo.checkout('feature');
    expect(envForSubcommand(spawn, 'checkout')?.GIT_LFS_SKIP_SMUDGE).toBeUndefined();
  });

  it("does not set GIT_LFS_SKIP_SMUDGE for the 'disabled' mode", async () => {
    const { repo, spawn } = makeRepo('disabled');
    await repo.checkout('feature');
    expect(envForSubcommand(spawn, 'checkout')?.GIT_LFS_SKIP_SMUDGE).toBeUndefined();
  });

  it('does not set GIT_LFS_SKIP_SMUDGE for an empty object mode', async () => {
    const { repo, spawn } = makeRepo({});
    await repo.checkout('feature');
    expect(envForSubcommand(spawn, 'checkout')?.GIT_LFS_SKIP_SMUDGE).toBeUndefined();
  });

  it('honors setLfsMode() changes at runtime', async () => {
    const { repo, spawn } = makeRepo('enabled');

    await repo.checkout('a');
    expect(envForSubcommand(spawn, 'checkout')?.GIT_LFS_SKIP_SMUDGE).toBeUndefined();

    repo.setLfsMode({ skipSmudge: true });
    spawn.mockClear();

    await repo.checkout('b');
    expect(envForSubcommand(spawn, 'checkout')).toMatchObject({ GIT_LFS_SKIP_SMUDGE: '1' });
  });

  it('does not inject GIT_LFS_SKIP_SMUDGE into non-smudge operations like status', async () => {
    const { repo, spawn } = makeRepo({ skipSmudge: true });
    await repo.status();
    expect(envForSubcommand(spawn, 'status')?.GIT_LFS_SKIP_SMUDGE).toBeUndefined();
  });
});

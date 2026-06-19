/**
 * Tests that `onLfsProgress` is forwarded from clone / push / pull and the LFS
 * transfer operations (lfs.pull, lfs.push, lfs.fetch, lfsExtra.preUpload,
 * lfsExtra.preDownload) down to the runner.
 *
 * These use mock adapters (rather than a real git binary) so that LFS transfer
 * progress lines can be simulated deterministically on stderr.
 */

import { describe, expect, it, vi } from 'vitest';
import type { RuntimeAdapters } from '../core/adapters.js';
import type { LfsProgress } from '../core/types.js';
import { CliRunner } from '../runner/cli-runner.js';
import { BareRepoImpl } from './bare-repo-impl.js';
import { GitImpl } from './git-impl.js';
import { WorktreeRepoImpl } from './worktree-repo-impl.js';

// Mock adapters whose spawn emits LFS upload/download progress lines on stderr.
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
      spawn: vi
        .fn()
        .mockImplementation((_opts: unknown, handlers?: { onStderr?: (chunk: string) => void }) => {
          if (handlers?.onStderr) {
            handlers.onStderr('Downloading LFS objects:  50% (1/2), 1.5 MB | 500 KB/s\r');
            handlers.onStderr('Uploading LFS objects: 100% (2/2), 3.0 MB | 1.0 MB/s\n');
          }
          return { stdout: '', stderr: '', exitCode: 0, aborted: false };
        }),
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

describe('onLfsProgress wiring', () => {
  it('clone forwards onLfsProgress to the runner', async () => {
    const adapters = createMockAdapters();
    const git = new GitImpl({ adapters, skipVersionCheck: true });
    const events: LfsProgress[] = [];

    await git.clone('https://example.com/repo.git', '/dest', {
      onLfsProgress: (p) => events.push(p),
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({ direction: 'download', percent: 50 });
    // LFS progress output is enabled via env var, independent of --progress.
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({ GIT_LFS_FORCE_PROGRESS: '1' }),
      }),
      expect.objectContaining({ onStderr: expect.any(Function) }),
    );
  });

  it('worktree push forwards onLfsProgress to the runner', async () => {
    const adapters = createMockAdapters();
    const repo = new WorktreeRepoImpl(new CliRunner(adapters), '/repo');
    const events: LfsProgress[] = [];

    await repo.push({ onLfsProgress: (p) => events.push(p) });

    expect(events.length).toBeGreaterThan(0);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({ GIT_LFS_FORCE_PROGRESS: '1' }),
      }),
      expect.objectContaining({ onStderr: expect.any(Function) }),
    );
  });

  it('bare push forwards onLfsProgress to the runner', async () => {
    const adapters = createMockAdapters();
    const repo = new BareRepoImpl(new CliRunner(adapters), '/repo.git');
    const events: LfsProgress[] = [];

    await repo.push({ onLfsProgress: (p) => events.push(p) });

    expect(events.length).toBeGreaterThan(0);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({ GIT_LFS_FORCE_PROGRESS: '1' }),
      }),
      expect.objectContaining({ onStderr: expect.any(Function) }),
    );
  });

  it('pull forwards onLfsProgress to the runner', async () => {
    const adapters = createMockAdapters();
    const repo = new WorktreeRepoImpl(new CliRunner(adapters), '/repo');
    const events: LfsProgress[] = [];

    await repo.pull({ onLfsProgress: (p) => events.push(p) });

    expect(events.length).toBeGreaterThan(0);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({ GIT_LFS_FORCE_PROGRESS: '1' }),
      }),
      expect.objectContaining({ onStderr: expect.any(Function) }),
    );
  });

  it('lfs.pull forwards onLfsProgress to the runner', async () => {
    const adapters = createMockAdapters();
    const repo = new WorktreeRepoImpl(new CliRunner(adapters), '/repo');
    const events: LfsProgress[] = [];

    await repo.lfs.pull({ onLfsProgress: (p) => events.push(p) });

    expect(events.length).toBeGreaterThan(0);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({ GIT_LFS_FORCE_PROGRESS: '1' }),
      }),
      expect.objectContaining({ onStderr: expect.any(Function) }),
    );
  });

  it('lfs.push forwards onLfsProgress to the runner', async () => {
    const adapters = createMockAdapters();
    const repo = new WorktreeRepoImpl(new CliRunner(adapters), '/repo');
    const events: LfsProgress[] = [];

    await repo.lfs.push({ onLfsProgress: (p) => events.push(p) });

    expect(events.length).toBeGreaterThan(0);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({ GIT_LFS_FORCE_PROGRESS: '1' }),
      }),
      expect.objectContaining({ onStderr: expect.any(Function) }),
    );
  });

  it('lfs.fetch forwards onLfsProgress to the runner', async () => {
    const adapters = createMockAdapters();
    const repo = new WorktreeRepoImpl(new CliRunner(adapters), '/repo');
    const events: LfsProgress[] = [];

    await repo.lfs.fetch({ onLfsProgress: (p) => events.push(p) });

    expect(events.length).toBeGreaterThan(0);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({ GIT_LFS_FORCE_PROGRESS: '1' }),
      }),
      expect.objectContaining({ onStderr: expect.any(Function) }),
    );
  });

  it('lfsExtra.preUpload forwards onLfsProgress to the runner', async () => {
    const adapters = createMockAdapters();
    const repo = new WorktreeRepoImpl(new CliRunner(adapters), '/repo');
    const events: LfsProgress[] = [];

    // Provide explicit OIDs so the batched `git lfs push` runs (skips ls-files).
    await repo.lfsExtra.preUpload({
      oids: ['a'.repeat(64)],
      onLfsProgress: (p) => events.push(p),
    });

    expect(events.length).toBeGreaterThan(0);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({ GIT_LFS_FORCE_PROGRESS: '1' }),
      }),
      expect.objectContaining({ onStderr: expect.any(Function) }),
    );
  });

  it('lfsExtra.preDownload forwards onLfsProgress to the runner', async () => {
    const adapters = createMockAdapters();
    const repo = new WorktreeRepoImpl(new CliRunner(adapters), '/repo');
    const events: LfsProgress[] = [];

    // Provide explicit OIDs so the batched `git lfs fetch` runs (skips ls-files).
    await repo.lfsExtra.preDownload({
      oids: ['a'.repeat(64)],
      onLfsProgress: (p) => events.push(p),
    });

    expect(events.length).toBeGreaterThan(0);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({ GIT_LFS_FORCE_PROGRESS: '1' }),
      }),
      expect.objectContaining({ onStderr: expect.any(Function) }),
    );
  });
});

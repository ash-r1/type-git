/**
 * Tests for LFS operations in WorktreeRepoImpl
 */

import { describe, expect, it, vi } from 'vitest';
import type { RuntimeAdapters, SpawnResult } from '../core/adapters.js';
import { CliRunner } from '../runner/cli-runner.js';
import { WorktreeRepoImpl } from './worktree-repo-impl.js';

// Mock adapters for testing
function createMockAdapters(spawnResults?: Partial<SpawnResult>[]): RuntimeAdapters {
  let callIndex = 0;
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
      spawn: vi.fn().mockImplementation(() => {
        const result = spawnResults?.[callIndex] ?? {
          stdout: '',
          stderr: '',
          exitCode: 0,
          aborted: false,
        };
        callIndex++;
        return {
          stdout: '',
          stderr: '',
          exitCode: 0,
          aborted: false,
          ...result,
        };
      }),
    },
    fs: {
      createTempFile: vi.fn().mockResolvedValue('/tmp/type-git-lfs-123/temp'),
      tail: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
      writeFile: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('WorktreeRepoImpl LFS Extra Operations', () => {
  describe('lfsExtra.preUpload', () => {
    it('should return zero counts when LFS is disabled', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo', { lfs: 'disabled' });

      const result = await repo.lfsExtra.preUpload();

      expect(result).toEqual({
        uploadedCount: 0,
        uploadedBytes: 0,
        skippedCount: 0,
      });
      expect(adapters.exec.spawn).not.toHaveBeenCalled();
    });

    it('should execute lfs push with object IDs when provided', async () => {
      const adapters = createMockAdapters([{ stdout: '', stderr: '', exitCode: 0 }]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const oids = ['abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd'];
      const result = await repo.lfsExtra.preUpload({ oids });

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: expect.arrayContaining([
            'git',
            '-C',
            '/repo',
            'lfs',
            'push',
            'origin',
            '--object-id',
            oids[0],
          ]),
        }),
        undefined,
      );
      expect(result.uploadedCount).toBe(1);
    });

    it('should auto-detect OIDs from ls-files when not provided', async () => {
      const adapters = createMockAdapters([
        // First call: lfs ls-files
        {
          stdout:
            'abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd * file1.bin\ndef456def456def456def456def456def456def456def456def456def456efab - file2.bin\n',
          exitCode: 0,
        },
        // Second call: lfs push
        { stdout: '', stderr: '', exitCode: 0 },
      ]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preUpload();

      // Should have called ls-files first
      expect(adapters.exec.spawn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          argv: expect.arrayContaining(['lfs', 'ls-files', '--all', '--long']),
        }),
        undefined,
      );

      // Then should push both OIDs
      expect(result.uploadedCount).toBe(2);
    });

    it('should batch OIDs respecting batchSize', async () => {
      const oids = Array.from({ length: 5 }, (_, i) => `${i}${'0'.repeat(63)}`.slice(0, 64));

      const adapters = createMockAdapters([
        { exitCode: 0 }, // First batch
        { exitCode: 0 }, // Second batch
        { exitCode: 0 }, // Third batch
      ]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preUpload({ oids, batchSize: 2 });

      // Should have made 3 calls (2 + 2 + 1)
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(3);
      expect(result.uploadedCount).toBe(5);
    });

    it('should split into batches of 200 OIDs by default', async () => {
      const oids = Array.from({ length: 250 }, (_, i) => `${i}`.padStart(64, '0'));

      const adapters = createMockAdapters([{ exitCode: 0 }, { exitCode: 0 }]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preUpload({ oids });

      // 250 OIDs with the default batch size of 200 -> 2 invocations
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
      expect(result.uploadedCount).toBe(250);
    });

    it('should stop after the first failed batch and count the rest as skipped', async () => {
      const oids = Array.from({ length: 5 }, (_, i) => `${i}`.padStart(64, '0'));

      const adapters = createMockAdapters([
        { exitCode: 1, stderr: 'push failed' }, // First batch fails
      ]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preUpload({ oids, batchSize: 2 });

      // The first batch runs alone; its failure prevents any further batch.
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
      expect(result.uploadedCount).toBe(0);
      expect(result.skippedCount).toBe(5);
    });

    it('should stop scheduling when a batch is aborted', async () => {
      const oids = Array.from({ length: 4 }, (_, i) => `${i}`.padStart(64, '0'));

      const adapters = createMockAdapters([{ exitCode: 0, aborted: true }]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preUpload({ oids, batchSize: 2 });

      expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
      expect(result.uploadedCount).toBe(0);
      expect(result.skippedCount).toBe(4);
    });

    it('should run the first batch alone before widening to the concurrency limit', async () => {
      const oids = Array.from({ length: 60 }, (_, i) => `${i}`.padStart(64, '0'));
      const gates: Array<(override: Partial<SpawnResult>) => void> = [];
      const spawn = vi.fn().mockImplementation(
        () =>
          new Promise<SpawnResult>((resolve) => {
            gates.push((override) =>
              resolve({ stdout: '', stderr: '', exitCode: 0, aborted: false, ...override }),
            );
          }),
      );
      const adapters = createMockAdapters();
      adapters.exec.spawn = spawn;
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const settle = async (): Promise<void> => {
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
        }
      };

      // batchSize 10 -> 6 batches, default concurrency 4
      const resultPromise = repo.lfsExtra.preUpload({ oids, batchSize: 10 });
      await settle();
      // Warmup: only the first batch is in flight
      expect(spawn).toHaveBeenCalledTimes(1);

      gates[0]?.({});
      await settle();
      // After the warmup batch succeeds, up to `concurrency` batches run
      expect(spawn).toHaveBeenCalledTimes(5);

      // Batch 1 fails: no new batch starts, in-flight batches complete
      gates[1]?.({ exitCode: 1, stderr: 'push failed' });
      await settle();
      expect(spawn).toHaveBeenCalledTimes(5);

      for (const gate of gates.slice(2)) {
        gate({});
      }
      const result = await resultPromise;
      // Batches 0, 2, 3, 4 uploaded; batch 1 failed and batch 5 never started
      expect(result.uploadedCount).toBe(40);
      expect(result.skippedCount).toBe(20);
    });

    it('should run batches serially when concurrency is 1', async () => {
      const oids = Array.from({ length: 4 }, (_, i) => `${i}`.padStart(64, '0'));

      const adapters = createMockAdapters([{ exitCode: 0 }, { exitCode: 0 }]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preUpload({ oids, batchSize: 2, concurrency: 1 });

      expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
      expect(result.uploadedCount).toBe(4);
    });

    it('should use custom remote when specified', async () => {
      const adapters = createMockAdapters([{ exitCode: 0 }]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const oids = ['abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd'];
      await repo.lfsExtra.preUpload({ oids, remote: 'upstream' });

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: expect.arrayContaining(['lfs', 'push', 'upstream', '--object-id']),
        }),
        undefined,
      );
    });

    it('should count skipped objects on failure', async () => {
      const oids = ['abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd'];
      const adapters = createMockAdapters([
        { exitCode: 1, stderr: 'some error' }, // Failed push
      ]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preUpload({ oids });

      expect(result.uploadedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
    });

    it('should return zero counts when ls-files fails', async () => {
      const adapters = createMockAdapters([{ exitCode: 1, stderr: 'not an LFS repo' }]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preUpload();

      expect(result).toEqual({
        uploadedCount: 0,
        uploadedBytes: 0,
        skippedCount: 0,
      });
    });

    it('should return zero counts when no OIDs found', async () => {
      const adapters = createMockAdapters([
        { stdout: '', exitCode: 0 }, // Empty ls-files output
      ]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preUpload();

      expect(result).toEqual({
        uploadedCount: 0,
        uploadedBytes: 0,
        skippedCount: 0,
      });
    });
  });

  describe('lfsExtra.preDownload', () => {
    it('should return zero counts when LFS is disabled', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo', { lfs: 'disabled' });

      const result = await repo.lfsExtra.preDownload({ ref: 'origin/main' });

      expect(result).toEqual({
        downloadedCount: 0,
        downloadedBytes: 0,
        skippedCount: 0,
      });
      expect(adapters.exec.spawn).not.toHaveBeenCalled();
    });

    it('should execute lfs fetch with object IDs when provided', async () => {
      const adapters = createMockAdapters([{ exitCode: 0 }]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const oids = ['abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd'];
      const result = await repo.lfsExtra.preDownload({ oids });

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: expect.arrayContaining([
            'git',
            '-C',
            '/repo',
            'lfs',
            'fetch',
            'origin',
            '--',
            oids[0],
          ]),
        }),
        undefined,
      );
      expect(result.downloadedCount).toBe(1);
    });

    it('should auto-detect OIDs from ref when provided', async () => {
      const adapters = createMockAdapters([
        // First call: lfs ls-files with ref
        {
          stdout: 'abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd * file.bin\n',
          exitCode: 0,
        },
        // Second call: lfs fetch
        { exitCode: 0 },
      ]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preDownload({ ref: 'origin/feature' });

      // Should have called ls-files with ref
      expect(adapters.exec.spawn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          argv: expect.arrayContaining(['lfs', 'ls-files', '--long', 'origin/feature']),
        }),
        undefined,
      );

      expect(result.downloadedCount).toBe(1);
    });

    it('should return zero counts when no ref or OIDs provided', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preDownload({});

      expect(result).toEqual({
        downloadedCount: 0,
        downloadedBytes: 0,
        skippedCount: 0,
      });
      expect(adapters.exec.spawn).not.toHaveBeenCalled();
    });

    it('should batch OIDs respecting batchSize', async () => {
      const oids = Array.from({ length: 5 }, (_, i) => `${i}${'0'.repeat(63)}`.slice(0, 64));

      const adapters = createMockAdapters([
        { exitCode: 0 }, // First batch
        { exitCode: 0 }, // Second batch
        { exitCode: 0 }, // Third batch
      ]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preDownload({ oids, batchSize: 2 });

      // Should have made 3 calls (2 + 2 + 1)
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(3);
      expect(result.downloadedCount).toBe(5);
    });

    it('should use custom remote when specified', async () => {
      const adapters = createMockAdapters([{ exitCode: 0 }]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const oids = ['abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd'];
      await repo.lfsExtra.preDownload({ oids, remote: 'upstream' });

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: expect.arrayContaining(['lfs', 'fetch', 'upstream', '--']),
        }),
        undefined,
      );
    });

    it('should count skipped objects on failure', async () => {
      const oids = ['abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd'];
      const adapters = createMockAdapters([{ exitCode: 1, stderr: 'some error' }]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preDownload({ oids });

      expect(result.downloadedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
    });

    it('should return zero counts when ls-files for ref fails', async () => {
      const adapters = createMockAdapters([{ exitCode: 1, stderr: 'ref not found' }]);
      const runner = new CliRunner(adapters);
      const repo = new WorktreeRepoImpl(runner, '/repo');

      const result = await repo.lfsExtra.preDownload({ ref: 'nonexistent' });

      expect(result).toEqual({
        downloadedCount: 0,
        downloadedBytes: 0,
        skippedCount: 0,
      });
    });
  });
});

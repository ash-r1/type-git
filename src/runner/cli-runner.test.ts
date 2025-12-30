/**
 * CliRunner tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeAdapters, SpawnResult } from '../core/adapters.js';
import type { ExecutionContext, Progress } from '../core/types.js';
import { GitError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

// Mock adapters
function createMockAdapters(spawnResult?: Partial<SpawnResult>): RuntimeAdapters {
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
      spawn: vi.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        aborted: false,
        ...spawnResult,
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

describe('CliRunner', () => {
  describe('run', () => {
    it('should execute command with global context', async () => {
      const adapters = createMockAdapters({ stdout: 'output' });
      const runner = new CliRunner(adapters);

      const result = await runner.run({ type: 'global' }, ['version']);

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: ['git', 'version'],
        }),
        undefined,
      );
      expect(result.stdout).toBe('output');
    });

    it('should add -C flag for worktree context', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters);

      await runner.run({ type: 'worktree', workdir: '/repo' }, ['status']);

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: ['git', '-C', '/repo', 'status'],
          cwd: '/repo',
        }),
        undefined,
      );
    });

    it('should add --git-dir flag for bare context', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters);

      await runner.run({ type: 'bare', gitDir: '/repo.git' }, ['log']);

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: ['git', '--git-dir', '/repo.git', 'log'],
        }),
        undefined,
      );
    });

    it('should use custom git binary', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters, { gitBinary: '/usr/local/bin/git' });

      await runner.run({ type: 'global' }, ['version']);

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: ['/usr/local/bin/git', 'version'],
        }),
        undefined,
      );
    });

    it('should set up LFS progress file when onProgress provided', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters);
      const onProgress = vi.fn();

      await runner.run({ type: 'global' }, ['lfs', 'pull'], { onProgress });

      expect(adapters.fs.createTempFile).toHaveBeenCalled();
      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          env: expect.objectContaining({
            GIT_LFS_PROGRESS: expect.stringContaining('type-git-lfs'),
          }),
        }),
        expect.objectContaining({
          onStderr: expect.any(Function),
        }),
      );
      expect(adapters.fs.deleteFile).toHaveBeenCalled();
    });

    it('should pass abort signal', async () => {
      const adapters = createMockAdapters({ aborted: true });
      const runner = new CliRunner(adapters);
      const controller = new AbortController();

      const result = await runner.run({ type: 'global' }, ['clone', 'url'], {
        signal: controller.signal,
      });

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: controller.signal,
        }),
        undefined,
      );
      expect(result.aborted).toBe(true);
    });
  });

  describe('mapError', () => {
    let runner: CliRunner;
    let context: ExecutionContext;

    beforeEach(() => {
      runner = new CliRunner(createMockAdapters());
      context = { type: 'worktree', workdir: '/repo' };
    });

    it('should return null for successful result', () => {
      const result = { stdout: '', stderr: '', exitCode: 0, aborted: false };
      const error = runner.mapError(result, context, ['git', 'status']);

      expect(error).toBeNull();
    });

    it('should return Aborted error when aborted', () => {
      const result = { stdout: '', stderr: '', exitCode: 128, aborted: true };
      const error = runner.mapError(result, context, ['git', 'clone']);

      expect(error).toBeInstanceOf(GitError);
      expect(error?.kind).toBe('Aborted');
    });

    it('should return NonZeroExit for failed command', () => {
      const result = {
        stdout: '',
        stderr: 'fatal: not a git repository',
        exitCode: 128,
        aborted: false,
      };
      const error = runner.mapError(result, context, ['git', 'status']);

      expect(error).toBeInstanceOf(GitError);
      expect(error?.kind).toBe('NonZeroExit');
      expect(error?.message).toBe('not a git repository');
    });

    it('should extract error message from fatal:', () => {
      const result = {
        stdout: '',
        stderr: 'fatal: pathspec did not match any files',
        exitCode: 128,
        aborted: false,
      };
      const error = runner.mapError(result, context, ['git', 'checkout']);

      expect(error?.message).toBe('pathspec did not match any files');
    });

    it('should include context in error', () => {
      const result = { stdout: 'out', stderr: 'err', exitCode: 1, aborted: false };
      const error = runner.mapError(result, context, ['git', '-C', '/repo', 'status']);

      expect(error?.context.workdir).toBe('/repo');
      expect(error?.context.stdout).toBe('out');
      expect(error?.context.stderr).toBe('err');
    });
  });

  describe('runOrThrow', () => {
    it('should return result on success', async () => {
      const adapters = createMockAdapters({ stdout: 'success', exitCode: 0 });
      const runner = new CliRunner(adapters);

      const result = await runner.runOrThrow({ type: 'global' }, ['version']);

      expect(result.stdout).toBe('success');
    });

    it('should throw GitError on failure', async () => {
      const adapters = createMockAdapters({
        stderr: 'fatal: error message',
        exitCode: 128,
      });
      const runner = new CliRunner(adapters);

      await expect(runner.runOrThrow({ type: 'global' }, ['bad-command'])).rejects.toThrow(
        GitError,
      );
    });
  });

  describe('progress parsing', () => {
    it('should parse git progress from stderr', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters);
      const progressEvents: Array<Progress> = [];

      // Capture the onStderr handler
      let stderrHandler: ((chunk: string) => void) | undefined;
      (adapters.exec.spawn as ReturnType<typeof vi.fn>).mockImplementation(
        async (_opts: unknown, handlers?: { onStderr?: (chunk: string) => void }) => {
          stderrHandler = handlers?.onStderr;
          // Simulate progress output
          if (stderrHandler) {
            stderrHandler('Counting objects: 50% (5/10)\r');
            stderrHandler('Counting objects: 100% (10/10), done.\n');
          }
          return { stdout: '', stderr: '', exitCode: 0, aborted: false };
        },
      );

      await runner.run({ type: 'global' }, ['fetch'], {
        onProgress: (p) => progressEvents.push(p),
      });

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toMatchObject({
        kind: 'git',
        phase: 'Counting objects',
        current: 5,
        total: 10,
        percent: 50,
      });
    });
  });
});

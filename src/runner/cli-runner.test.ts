/**
 * CliRunner tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeAdapters, SpawnResult } from '../core/adapters.js';
import type { ExecutionContext, GitProgress, LfsProgress } from '../core/types.js';
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
      deleteDirectory: vi.fn().mockResolvedValue(undefined),
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

    it('should set up LFS progress environment when onLfsProgress provided', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters);
      const onLfsProgress = vi.fn();

      await runner.run({ type: 'global' }, ['lfs', 'pull'], { onLfsProgress });

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          env: expect.objectContaining({
            GIT_LFS_FORCE_PROGRESS: '1',
          }),
        }),
        expect.objectContaining({
          onStderr: expect.any(Function),
        }),
      );
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

  describe('environment options', () => {
    it('should apply custom environment variables', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters, {
        env: { CUSTOM_VAR: 'value', GIT_TERMINAL_PROMPT: '0' },
      });

      await runner.run({ type: 'global' }, ['version']);

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          env: expect.objectContaining({
            CUSTOM_VAR: 'value',
            GIT_TERMINAL_PROMPT: '0',
          }),
        }),
        undefined,
      );
    });

    it('should apply home directory override', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters, { home: '/custom/home' });

      await runner.run({ type: 'global' }, ['version']);

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          env: expect.objectContaining({
            HOME: '/custom/home',
            USERPROFILE: '/custom/home',
          }),
        }),
        undefined,
      );
    });

    it('should apply PATH prefix', async () => {
      const adapters = createMockAdapters();
      const originalPath = process.env.PATH;
      const runner = new CliRunner(adapters, { pathPrefix: ['/custom/bin', '/another/bin'] });

      await runner.run({ type: 'global' }, ['version']);

      const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
      const envArg = spawnCall[0].env;
      expect(envArg.PATH).toContain('/custom/bin');
      expect(envArg.PATH).toContain('/another/bin');
      expect(envArg.PATH).toContain(originalPath);
    });

    it('should merge options with withOptions()', async () => {
      const adapters = createMockAdapters();
      const baseRunner = new CliRunner(adapters, {
        env: { BASE_VAR: 'base' },
        pathPrefix: ['/base/bin'],
      });

      const derivedRunner = baseRunner.withOptions({
        env: { DERIVED_VAR: 'derived' },
        pathPrefix: ['/derived/bin'],
        home: '/derived/home',
      });

      await derivedRunner.run({ type: 'global' }, ['version']);

      const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
      const envArg = spawnCall[0].env;

      // Should have both base and derived env vars
      expect(envArg.BASE_VAR).toBe('base');
      expect(envArg.DERIVED_VAR).toBe('derived');

      // Should have home override
      expect(envArg.HOME).toBe('/derived/home');

      // Should have both path prefixes
      expect(envArg.PATH).toContain('/base/bin');
      expect(envArg.PATH).toContain('/derived/bin');
    });

    it('should allow derived env to override base env', async () => {
      const adapters = createMockAdapters();
      const baseRunner = new CliRunner(adapters, { env: { SHARED_VAR: 'base' } });
      const derivedRunner = baseRunner.withOptions({ env: { SHARED_VAR: 'derived' } });

      await derivedRunner.run({ type: 'global' }, ['version']);

      const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(spawnCall[0].env.SHARED_VAR).toBe('derived');
    });
  });

  describe('credential helper', () => {
    it('should add credential.helper config when helper is specified', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters, {
        credential: { helper: 'store' },
      });

      await runner.run({ type: 'global' }, ['fetch']);

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: ['git', '-c', 'credential.helper=store', 'fetch'],
        }),
        undefined,
      );
    });

    it('should add custom helper name to credential.helper config', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters, {
        credential: { helper: 'myapp' },
      });

      await runner.run({ type: 'worktree', workdir: '/repo' }, ['push']);

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: ['git', '-c', 'credential.helper=myapp', '-C', '/repo', 'push'],
        }),
        undefined,
      );
    });

    it('should add helper binary path directory to PATH', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters, {
        credential: {
          helper: 'myapp',
          helperPath: '/custom/bin/git-credential-myapp',
        },
      });

      await runner.run({ type: 'global' }, ['fetch']);

      const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
      const envArg = spawnCall[0].env;
      expect(envArg.PATH).toContain('/custom/bin');
    });

    it('should handle Windows-style paths for helper binary', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters, {
        credential: {
          helper: 'myapp',
          helperPath: 'C:\\Program Files\\MyApp\\git-credential-myapp.exe',
        },
      });

      await runner.run({ type: 'global' }, ['fetch']);

      const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
      const envArg = spawnCall[0].env;
      expect(envArg.PATH).toContain('C:\\Program Files\\MyApp');
    });

    it('should pass credential config through withOptions()', async () => {
      const adapters = createMockAdapters();
      const baseRunner = new CliRunner(adapters);
      const derivedRunner = baseRunner.withOptions({
        credential: { helper: 'custom' },
      });

      await derivedRunner.run({ type: 'global' }, ['clone', 'url']);

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: expect.arrayContaining(['-c', 'credential.helper=custom']),
        }),
        undefined,
      );
    });
  });

  describe('progress parsing', () => {
    it('should parse git progress from stderr', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters);
      const progressEvents: GitProgress[] = [];

      // Capture the onStderr handler
      let stderrHandler: ((chunk: string) => void) | undefined;
      (adapters.exec.spawn as ReturnType<typeof vi.fn>).mockImplementation(
        (_opts: unknown, handlers?: { onStderr?: (chunk: string) => void }) => {
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
        onProgress: (p: GitProgress) => progressEvents.push(p),
      });

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toMatchObject({
        phase: 'Counting objects',
        current: 5,
        total: 10,
        percent: 50,
      });
    });

    it('should parse LFS progress from stderr', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters);
      const lfsProgressEvents: LfsProgress[] = [];

      (adapters.exec.spawn as ReturnType<typeof vi.fn>).mockImplementation(
        (_opts: unknown, handlers?: { onStderr?: (chunk: string) => void }) => {
          // Simulate LFS progress output with carriage returns
          if (handlers?.onStderr) {
            handlers.onStderr('Downloading LFS objects:  50% (1/2), 1.5 MB | 500 KB/s\r');
            handlers.onStderr('Downloading LFS objects: 100% (2/2), 3.0 MB | 1.0 MB/s\n');
          }
          return { stdout: '', stderr: '', exitCode: 0, aborted: false };
        },
      );

      await runner.run({ type: 'global' }, ['lfs', 'pull'], {
        onLfsProgress: (p: LfsProgress) => lfsProgressEvents.push(p),
      });

      expect(lfsProgressEvents.length).toBeGreaterThan(0);
      expect(lfsProgressEvents[0]).toMatchObject({
        direction: 'download',
        percent: 50,
        filesCompleted: 1,
        filesTotal: 2,
      });
    });

    it('should handle carriage return updates in LFS progress', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters);
      const lfsProgressEvents: LfsProgress[] = [];

      (adapters.exec.spawn as ReturnType<typeof vi.fn>).mockImplementation(
        (_opts: unknown, handlers?: { onStderr?: (chunk: string) => void }) => {
          // Simulate LFS progress with multiple CR updates in single chunk
          if (handlers?.onStderr) {
            handlers.onStderr(
              'Downloading LFS objects:  25% (1/4), 1 MB | 500 KB/s\r' +
                'Downloading LFS objects:  50% (2/4), 2 MB | 600 KB/s\r' +
                'Downloading LFS objects:  75% (3/4), 3 MB | 700 KB/s\r',
            );
          }
          return { stdout: '', stderr: '', exitCode: 0, aborted: false };
        },
      );

      await runner.run({ type: 'global' }, ['lfs', 'pull'], {
        onLfsProgress: (p: LfsProgress) => lfsProgressEvents.push(p),
      });

      // Should have parsed multiple progress events from CR-separated lines
      expect(lfsProgressEvents.length).toBe(3);
      expect(lfsProgressEvents[0].percent).toBe(25);
      expect(lfsProgressEvents[1].percent).toBe(50);
      expect(lfsProgressEvents[2].percent).toBe(75);
    });
  });
});

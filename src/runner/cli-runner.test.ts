/**
 * CliRunner tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeAdapters, SpawnResult } from '../core/adapters.js';
import type {
  AuditEvent,
  ExecutionContext,
  GitProgress,
  LfsProgress,
  TraceEvent,
} from '../core/types.js';
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

// The PATH variable key as it appears in this platform's process.env.
// Windows commonly stores it as `Path` (case-insensitive), other platforms use `PATH`.
const PATH_KEY = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';

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
      const originalPath = process.env[PATH_KEY];
      const runner = new CliRunner(adapters, { pathPrefix: ['/custom/bin', '/another/bin'] });

      await runner.run({ type: 'global' }, ['version']);

      const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
      const envArg = spawnCall[0].env;
      expect(envArg[PATH_KEY]).toContain('/custom/bin');
      expect(envArg[PATH_KEY]).toContain('/another/bin');
      expect(envArg[PATH_KEY]).toContain(originalPath);
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

    it('should apply the PATH prefix to the platform PATH key without orphaning it', async () => {
      // On Windows the PATH variable is commonly named `Path` and matched
      // case-insensitively, so the prefix logic must reuse that key. On other platforms
      // names are case-sensitive and the canonical `PATH` is always used.
      const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters, {
        // Disable allowlist inheritance so the only PATH key is the one provided below
        inheritEnv: false,
        env: { [pathKey]: '/inherited/bin' },
        pathPrefix: ['/custom/bin'],
      });

      await runner.run({ type: 'global' }, ['version']);

      const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
      const envArg = spawnCall[0].env;
      // The prefix is applied to the platform PATH key and the inherited value is retained
      expect(envArg[pathKey]).toContain('/custom/bin');
      expect(envArg[pathKey]).toContain('/inherited/bin');
    });

    it('should instruct the adapter not to inherit the parent environment', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters);

      await runner.run({ type: 'global' }, ['version']);

      const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(spawnCall[0].inheritEnv).toBe(false);
    });

    it('should not forward sensitive parent env vars by default', async () => {
      const adapters = createMockAdapters();
      vi.stubEnv('TYPE_GIT_TEST_SECRET', 'super-secret');
      try {
        const runner = new CliRunner(adapters);

        await runner.run({ type: 'global' }, ['version']);

        const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(spawnCall[0].env.TYPE_GIT_TEST_SECRET).toBeUndefined();
        // But allowlisted vars such as PATH are still inherited
        expect(spawnCall[0].env[PATH_KEY]).toBeDefined();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('should forward all parent env vars when inheritEnv is true', async () => {
      const adapters = createMockAdapters();
      vi.stubEnv('TYPE_GIT_TEST_SECRET', 'super-secret');
      try {
        const runner = new CliRunner(adapters, { inheritEnv: true });

        await runner.run({ type: 'global' }, ['version']);

        const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(spawnCall[0].env.TYPE_GIT_TEST_SECRET).toBe('super-secret');
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('should opt specific parent env vars back in via inheritEnv array', async () => {
      const adapters = createMockAdapters();
      vi.stubEnv('TYPE_GIT_TEST_OPT_IN', 'opt-in-value');
      vi.stubEnv('TYPE_GIT_TEST_SECRET', 'super-secret');
      try {
        const runner = new CliRunner(adapters, { inheritEnv: ['TYPE_GIT_TEST_OPT_IN'] });

        await runner.run({ type: 'global' }, ['version']);

        const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(spawnCall[0].env.TYPE_GIT_TEST_OPT_IN).toBe('opt-in-value');
        expect(spawnCall[0].env.TYPE_GIT_TEST_SECRET).toBeUndefined();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('should propagate inheritEnv through withOptions()', async () => {
      const adapters = createMockAdapters();
      vi.stubEnv('TYPE_GIT_TEST_SECRET', 'super-secret');
      try {
        const baseRunner = new CliRunner(adapters, { inheritEnv: true });
        const derivedRunner = baseRunner.withOptions({ env: { EXTRA: 'x' } });

        await derivedRunner.run({ type: 'global' }, ['version']);

        const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(spawnCall[0].env.TYPE_GIT_TEST_SECRET).toBe('super-secret');
      } finally {
        vi.unstubAllEnvs();
      }
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

  describe('audit mode', () => {
    it('should emit start and end audit events', async () => {
      const adapters = createMockAdapters({ stdout: 'output', exitCode: 0 });
      const auditEvents: AuditEvent[] = [];
      const runner = new CliRunner(adapters, {
        audit: {
          onAudit: (event: AuditEvent) => auditEvents.push(event),
        },
      });

      await runner.run({ type: 'global' }, ['version']);

      expect(auditEvents.length).toBe(2);

      // Start event
      expect(auditEvents[0].type).toBe('start');
      if (auditEvents[0].type === 'start') {
        expect(auditEvents[0].argv).toEqual(['git', 'version']);
        expect(auditEvents[0].context).toEqual({ type: 'global' });
        expect(auditEvents[0].timestamp).toBeGreaterThan(0);
      }

      // End event
      expect(auditEvents[1].type).toBe('end');
      if (auditEvents[1].type === 'end') {
        expect(auditEvents[1].argv).toEqual(['git', 'version']);
        expect(auditEvents[1].context).toEqual({ type: 'global' });
        expect(auditEvents[1].stdout).toBe('output');
        expect(auditEvents[1].stderr).toBe('');
        expect(auditEvents[1].exitCode).toBe(0);
        expect(auditEvents[1].aborted).toBe(false);
        expect(auditEvents[1].duration).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include worktree context in audit events', async () => {
      const adapters = createMockAdapters();
      const auditEvents: AuditEvent[] = [];
      const runner = new CliRunner(adapters, {
        audit: {
          onAudit: (event: AuditEvent) => auditEvents.push(event),
        },
      });

      await runner.run({ type: 'worktree', workdir: '/repo' }, ['status']);

      expect(auditEvents[0].context).toEqual({ type: 'worktree', workdir: '/repo' });
      if (auditEvents[0].type === 'start') {
        expect(auditEvents[0].argv).toEqual(['git', '-C', '/repo', 'status']);
      }
    });

    it('should emit end event with error info on failure', async () => {
      const adapters = createMockAdapters({
        stderr: 'fatal: not a git repository',
        exitCode: 128,
      });
      const auditEvents: AuditEvent[] = [];
      const runner = new CliRunner(adapters, {
        audit: {
          onAudit: (event: AuditEvent) => auditEvents.push(event),
        },
      });

      await runner.run({ type: 'global' }, ['status']);

      expect(auditEvents[1].type).toBe('end');
      if (auditEvents[1].type === 'end') {
        expect(auditEvents[1].exitCode).toBe(128);
        expect(auditEvents[1].stderr).toBe('fatal: not a git repository');
      }
    });

    it('should set GIT_TRACE=1 when onTrace callback is provided', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters, {
        audit: {
          onTrace: () => {
            // No-op callback for testing environment setup
          },
        },
      });

      await runner.run({ type: 'global' }, ['version']);

      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          env: expect.objectContaining({
            GIT_TRACE: '1',
          }),
        }),
        expect.objectContaining({
          onStderr: expect.any(Function),
        }),
      );
    });

    it('should emit trace events for GIT_TRACE output', async () => {
      const adapters = createMockAdapters();
      const traceEvents: TraceEvent[] = [];
      const runner = new CliRunner(adapters, {
        audit: {
          onTrace: (trace: TraceEvent) => traceEvents.push(trace),
        },
      });

      // Simulate GIT_TRACE output
      (adapters.exec.spawn as ReturnType<typeof vi.fn>).mockImplementation(
        (_opts: unknown, handlers?: { onStderr?: (chunk: string) => void }) => {
          if (handlers?.onStderr) {
            handlers.onStderr(
              '12:34:56.789012 git.c:439               trace: built-in: git status\n',
            );
            handlers.onStderr(
              '12:34:56.790123 run-command.c:123       trace: run_command: ls-files\n',
            );
          }
          return { stdout: '', stderr: '', exitCode: 0, aborted: false };
        },
      );

      await runner.run({ type: 'global' }, ['status']);

      expect(traceEvents.length).toBe(2);
      expect(traceEvents[0].line).toContain('trace: built-in: git status');
      expect(traceEvents[1].line).toContain('trace: run_command: ls-files');
      expect(traceEvents[0].timestamp).toBeGreaterThan(0);
    });

    it('should propagate audit config through withOptions()', async () => {
      const adapters = createMockAdapters();
      const auditEvents: AuditEvent[] = [];
      const baseRunner = new CliRunner(adapters, {
        audit: {
          onAudit: (event: AuditEvent) => auditEvents.push(event),
        },
      });

      const derivedRunner = baseRunner.withOptions({
        env: { CUSTOM_VAR: 'value' },
      });

      await derivedRunner.run({ type: 'global' }, ['version']);

      expect(auditEvents.length).toBe(2);
      expect(auditEvents[0].type).toBe('start');
      expect(auditEvents[1].type).toBe('end');
    });

    it('should not emit audit events when audit is not configured', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters);

      // This should not throw and should complete normally
      const result = await runner.run({ type: 'global' }, ['version']);

      expect(result.exitCode).toBe(0);
    });

    it('should not set GIT_TRACE when only onAudit is provided', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters, {
        audit: {
          onAudit: () => {
            // No-op callback for testing environment setup
          },
        },
      });

      await runner.run({ type: 'global' }, ['version']);

      const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(spawnCall[0].env.GIT_TRACE).toBeUndefined();
    });

    it('should emit end event even when spawn throws an exception', async () => {
      const adapters = createMockAdapters();
      (adapters.exec.spawn as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Spawn failed: command not found'),
      );

      const auditEvents: AuditEvent[] = [];
      const runner = new CliRunner(adapters, {
        audit: {
          onAudit: (event: AuditEvent) => auditEvents.push(event),
        },
      });

      await expect(runner.run({ type: 'global' }, ['version'])).rejects.toThrow('Spawn failed');

      expect(auditEvents.length).toBe(2);
      expect(auditEvents[0].type).toBe('start');
      expect(auditEvents[1].type).toBe('end');

      if (auditEvents[1].type === 'end') {
        expect(auditEvents[1].exitCode).toBe(-1);
        expect(auditEvents[1].stderr).toBe('Spawn failed: command not found');
        expect(auditEvents[1].duration).toBeGreaterThanOrEqual(0);
      }
    });

    it('should derive aborted flag from signal when spawn throws', async () => {
      const adapters = createMockAdapters();

      const auditEvents: AuditEvent[] = [];
      const runner = new CliRunner(adapters, {
        audit: {
          onAudit: (event: AuditEvent) => auditEvents.push(event),
        },
      });

      const controller = new AbortController();
      (adapters.exec.spawn as ReturnType<typeof vi.fn>).mockImplementation(() => {
        controller.abort();
        throw new Error('Aborted');
      });

      await expect(
        runner.run({ type: 'global' }, ['clone', 'url'], { signal: controller.signal }),
      ).rejects.toThrow('Aborted');

      expect(auditEvents[1].type).toBe('end');
      if (auditEvents[1].type === 'end') {
        expect(auditEvents[1].aborted).toBe(true);
      }
    });

    it('should not override user-provided GIT_TRACE value', async () => {
      const adapters = createMockAdapters();
      const runner = new CliRunner(adapters, {
        env: { GIT_TRACE: '2' },
        audit: {
          onTrace: () => {
            // No-op callback for testing
          },
        },
      });

      await runner.run({ type: 'global' }, ['version']);

      const spawnCall = (adapters.exec.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(spawnCall[0].env.GIT_TRACE).toBe('2');
    });

    it('should warn when GIT_TRACE is disabled but onTrace is provided', async () => {
      const adapters = createMockAdapters();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Suppress console output during test
      });

      const runner = new CliRunner(adapters, {
        env: { GIT_TRACE: '0' },
        audit: {
          onTrace: () => {
            // No-op callback for testing
          },
        },
      });

      await runner.run({ type: 'global' }, ['version']);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('onTrace callback provided but GIT_TRACE is disabled'),
      );

      warnSpy.mockRestore();
    });

    it('should warn when GIT_TRACE is empty string but onTrace is provided', async () => {
      const adapters = createMockAdapters();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Suppress console output during test
      });

      const runner = new CliRunner(adapters, {
        env: { GIT_TRACE: '' },
        audit: {
          onTrace: () => {
            // No-op callback for testing
          },
        },
      });

      await runner.run({ type: 'global' }, ['version']);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('onTrace callback provided but GIT_TRACE is disabled'),
      );

      warnSpy.mockRestore();
    });

    it('should not parse non-trace lines as trace events (stricter regex)', async () => {
      const adapters = createMockAdapters();
      const traceEvents: TraceEvent[] = [];
      const progressEvents: GitProgress[] = [];
      const runner = new CliRunner(adapters, {
        audit: {
          onTrace: (trace: TraceEvent) => traceEvents.push(trace),
        },
      });

      // Simulate stderr output that looks like a timestamp but isn't trace output
      (adapters.exec.spawn as ReturnType<typeof vi.fn>).mockImplementation(
        (_opts: unknown, handlers?: { onStderr?: (chunk: string) => void }) => {
          if (handlers?.onStderr) {
            // This matches old regex but not new stricter regex
            handlers.onStderr('12:34:56.789012 some random message\n');
            // This matches the stricter regex (has trace: prefix)
            handlers.onStderr('12:34:56.789012 trace: actual trace output\n');
            // This matches the stricter regex (has .c: pattern)
            handlers.onStderr('12:34:56.789012 git.c:123 another trace\n');
          }
          return { stdout: '', stderr: '', exitCode: 0, aborted: false };
        },
      );

      await runner.run({ type: 'global' }, ['status'], {
        onProgress: (p: GitProgress) => progressEvents.push(p),
      });

      // Only the actual trace lines should be captured (not the random message)
      expect(traceEvents.length).toBe(2);
      expect(traceEvents[0].line).toContain('trace: actual trace output');
      expect(traceEvents[1].line).toContain('git.c:123');
    });
  });
});

describe('selected Git executable ABI', () => {
  it('rejects 64-bit size_t input when the selected Git reports 32-bit size_t', async () => {
    const adapters = createMockAdapters({ stdout: 'sizeof-long: 4\nsizeof-size_t: 4\n' });
    const runner = new CliRunner(adapters, { gitBinary: 'git32' });
    await expect(
      runner.runCommand({ type: 'global' }, 'backfill', [['--min-batch-size', 4294967296]], true),
    ).rejects.toThrow('invalid integer');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({ argv: ['git32', 'version', '--build-options'] }),
      undefined,
    );
  });
  it('uses selected 64-bit size_t even when its C long is 32-bit', async () => {
    const adapters = createMockAdapters({ stdout: 'sizeof-long: 4\nsizeof-size_t: 8\n' });
    const runner = new CliRunner(adapters, { gitBinary: './git64' });
    await runner.runCommand(
      { type: 'worktree', workdir: '/repo' },
      'backfill',
      [['--min-batch-size', 4294967296]],
      true,
      { env: { PATH: '/selected' } },
    );
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    expect(adapters.exec.spawn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        argv: ['./git64', '-C', '/repo', 'version', '--build-options'],
        cwd: '/repo',
        env: expect.objectContaining({ PATH: '/selected' }),
      }),
      undefined,
    );
    expect(adapters.exec.spawn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        argv: ['./git64', '-C', '/repo', 'backfill', '--min-batch-size=4294967296'],
        cwd: '/repo',
        env: expect.objectContaining({ PATH: '/selected' }),
      }),
      undefined,
    );
  });
  it('fails explicitly rather than guessing when Git omits its widths', async () => {
    const adapters = createMockAdapters({ stdout: 'git version custom\n' });
    const runner = new CliRunner(adapters);
    await expect(
      runner.runCommand(
        { type: 'bare', gitDir: '/repo.git' },
        'backfill',
        [['--min-batch-size', 4294967296]],
        true,
      ),
    ).rejects.toThrow('Cannot determine integer widths');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it('returns cancellation without running an ABI-dependent command', async () => {
    const adapters = createMockAdapters();
    const runner = new CliRunner(adapters);
    const abort = new AbortController();
    abort.abort();
    const result = await runner.runCommand(
      { type: 'global' },
      'backfill',
      [['--min-batch-size', 1]],
      undefined,
      { signal: abort.signal },
    );
    expect(result.aborted).toBe(true);
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
});

describe('ABI-independent command preflight', () => {
  it('rejects unsigned multiplication overflow without spawning any Git process', async () => {
    const adapters = createMockAdapters();
    const runner = new CliRunner(adapters);
    await expect(
      runner.runCommand({ type: 'global' }, 'backfill', [['--min-batch-size', '-1k']], true),
    ).rejects.toThrow('invalid integer');
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
  it('rejects malformed tokens alongside an ABI-dependent value without probing', async () => {
    const adapters = createMockAdapters();
    const runner = new CliRunner(adapters);
    await expect(
      runner.runCommand(
        { type: 'global' },
        'backfill',
        [['--min-batch-size', 4294967296], ['--not-a-real-option']],
        true,
      ),
    ).rejects.toThrow();
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
  it('executes ABI-independent valid input without requiring build metadata', async () => {
    const adapters = createMockAdapters({ stdout: 'command output' });
    const runner = new CliRunner(adapters, { gitBinary: 'selected-git' });
    const result = await runner.runCommand(
      { type: 'global' },
      'backfill',
      [['--min-batch-size', 1]],
      true,
    );
    expect(result.stdout).toBe('command output');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({ argv: ['selected-git', 'backfill', '--min-batch-size=1'] }),
      undefined,
    );
  });
});

describe('selected Git ABI for object-filter bounds', () => {
  it('returns binary-profile cancellation without executing the command', async () => {
    const adapters = createMockAdapters({ exitCode: -1, aborted: true });
    const result = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'clone',
      [['--filter', 'blob:limit=0b10'], ['-h']],
      false,
    );
    expect(result.aborted).toBe(true);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it('fails missing byte output capability before probing the binary profile', async () => {
    const adapters = createMockAdapters();
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'clone',
        [['--filter', 'blob:limit=0b10'], ['-h']],
        false,
        { stdout: 'bytes' },
      ),
    ).rejects.toThrow('binary stdout');
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
  it.each([
    true,
    false,
    undefined,
  ])('observes binary syntax instead of guessing from the OS (%s)', async (supported) => {
    const adapters = createMockAdapters({ stdout: 'executed' });
    vi.mocked(adapters.exec.spawn).mockImplementation(async ({ argv }) =>
      argv.includes('--filter=blob:limit=0b1')
        ? {
            exitCode: supported === true ? 129 : 128,
            stdout: '',
            stderr:
              supported === true
                ? 'usage: git clone'
                : supported === false
                  ? 'fatal: invalid filter-spec'
                  : 'unrecognized frontend',
            aborted: false,
          }
        : { exitCode: 0, stdout: 'executed', stderr: '', aborted: false },
    );
    const result = new CliRunner(adapters).runCommand(
      { type: 'global' },
      'clone',
      [['--filter', 'blob:limit=0b10'], ['-h']],
      false,
    );
    if (supported === false) {
      await expect(result).rejects.toThrow('invalid object-filter');
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    } else {
      await expect(result).resolves.toMatchObject({ exitCode: 0 });
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    }
  });
  it('rejects width text from a failed object-filter ABI probe', async () => {
    const adapters = createMockAdapters({
      exitCode: 1,
      stdout: 'sizeof-long: 8\nsizeof-size_t: 8\n',
    });
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'clone',
        [['--filter', 'blob:limit=4294967296'], ['-h']],
        false,
      ),
    ).rejects.toThrow('Cannot determine integer widths');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it.each([
    4, 8,
  ])('validates the reported C long width (%i bytes) before executing', async (bytes) => {
    const adapters = createMockAdapters({ stdout: `sizeof-long: ${bytes}\nsizeof-size_t: 8\n` });
    const runner = new CliRunner(adapters, { gitBinary: 'selected-filter-git' });
    const result = runner.runCommand(
      { type: 'global' },
      'clone',
      [['--filter', 'blob:limit=4294967296'], ['-h']],
      false,
    );
    if (bytes === 4) {
      await expect(result).rejects.toThrow('invalid object-filter');
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    } else {
      await expect(result).resolves.toMatchObject({ exitCode: 0 });
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    }
    expect(adapters.exec.spawn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ argv: ['selected-filter-git', 'version', '--build-options'] }),
      undefined,
    );
  });
});

describe('selected Git ABI for shortlog wrapping', () => {
  it('probes and accepts unsigned-long32 wrap negation from the selected Git', async () => {
    const adapters = createMockAdapters({ stdout: 'sizeof-long: 4\nsizeof-size_t: 8\n' });
    const runner = new CliRunner(adapters, { gitBinary: 'selected-git32-long' });
    await runner.runCommand(
      { type: 'worktree', workdir: '/repo' },
      'shortlog',
      [['-w', '-4294967295,0,0'], { operand: 'HEAD' }],
      true,
    );
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    expect(adapters.exec.spawn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        argv: ['selected-git32-long', '-C', '/repo', 'version', '--build-options'],
      }),
      undefined,
    );
    expect(adapters.exec.spawn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        argv: ['selected-git32-long', '-C', '/repo', 'shortlog', '-w-4294967295,0,0', 'HEAD'],
      }),
      undefined,
    );
  });
  it('rejects that same value when the selected Git reports unsigned-long64', async () => {
    const adapters = createMockAdapters({ stdout: 'sizeof-long: 8\nsizeof-size_t: 8\n' });
    const runner = new CliRunner(adapters, { gitBinary: 'selected-git64-long' });
    await expect(
      runner.runCommand(
        { type: 'global' },
        'shortlog',
        [['-w', '-4294967295,0,0'], { operand: 'HEAD' }],
        true,
      ),
    ).rejects.toThrow('invalid shortlog-wrap');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({ argv: ['selected-git64-long', 'version', '--build-options'] }),
      undefined,
    );
  });
});

describe('selected native structured integer parsers', () => {
  it('uses selected C long for unsigned pack storage, independently of size_t', async () => {
    const adapters = createMockAdapters({ stdout: 'sizeof-long: 4\nsizeof-size_t: 8\n' });
    await expect(
      new CliRunner(adapters, { gitBinary: 'selected-git' }).runCommand(
        { type: 'worktree', workdir: '/repo' },
        'pack-objects',
        [['--max-pack-size', '4294967296'], ['-h']],
        true,
        { env: { PATH: '/selected' } },
      ),
    ).rejects.toThrow('invalid integer');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        argv: ['selected-git', '-C', '/repo', 'version', '--build-options'],
        env: expect.objectContaining({ PATH: '/selected' }),
      }),
      undefined,
    );
  });
  it.each([
    true,
    false,
  ])('observes selected libc binary support for fixed-width integers (%s)', async (supported) => {
    const adapters = createMockAdapters();
    vi.mocked(adapters.exec.spawn).mockImplementation(async ({ argv }) =>
      argv.includes('--width=2147483648')
        ? {
            exitCode: 129,
            stdout: 'usage: git column',
            stderr: 'error: value not in range',
            aborted: false,
          }
        : {
            exitCode: argv.includes('--filter=blob:limit=0b1') ? (supported ? 129 : 128) : 0,
            stdout: '',
            stderr: argv.includes('--filter=blob:limit=0b1')
              ? supported
                ? 'usage: git clone'
                : 'fatal: invalid filter-spec'
              : '',
            aborted: false,
          },
    );
    const result = new CliRunner(adapters).runCommand(
      { type: 'global' },
      'column',
      [['--width', '0b10'], ['-h']],
      false,
    );
    if (supported) {
      await expect(result).resolves.toMatchObject({ exitCode: 0 });
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(3);
    } else {
      await expect(result).rejects.toThrow('invalid integer');
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    }
  });
});

describe('readonly selected integer-family probe', () => {
  it.each([
    'legacy',
    'bounded',
    'unknown',
  ] as const)('preserves selected context and profile outcome (%s)', async (profile) => {
    const adapters = createMockAdapters();
    vi.mocked(adapters.exec.spawn).mockImplementation(async ({ argv }) =>
      argv.includes('--width=2147483648')
        ? {
            exitCode: profile === 'unknown' ? 1 : 129,
            stdout: profile === 'legacy' ? 'usage: git column' : '',
            stderr:
              profile === 'bounded'
                ? 'error: value not in range'
                : profile === 'unknown'
                  ? 'frontend unavailable'
                  : '',
            aborted: false,
          }
        : { exitCode: 129, stdout: 'usage: git column', stderr: '', aborted: false },
    );
    const result = new CliRunner(adapters, { gitBinary: 'selected-git' }).runCommand(
      { type: 'worktree', workdir: '/repo' },
      'column',
      [['--width', '4294967297'], ['-h']],
      true,
      { env: { PATH: '/selected' } },
    );
    if (profile === 'bounded') {
      await expect(result).rejects.toThrow('invalid integer');
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    } else {
      await expect(result).resolves.toMatchObject({ exitCode: 129 });
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    }
    for (const [options] of vi.mocked(adapters.exec.spawn).mock.calls) {
      expect(options.argv.slice(0, 3)).toEqual(['selected-git', '-C', '/repo']);
      expect(options.env).toMatchObject({ PATH: '/selected' });
      expect(options.stdin).toBeUndefined();
    }
  });
  it('returns cancellation from the family probe without executing the requested command', async () => {
    const adapters = createMockAdapters({ aborted: true, exitCode: -1 });
    const result = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'column',
      [['--width', '2147483648'], ['-h']],
      false,
    );
    expect(result.aborted).toBe(true);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it('rejects a universally invalid spelling before family probes', async () => {
    const adapters = createMockAdapters();
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'column',
        [['--width', 'bad'], ['-h']],
        false,
      ),
    ).rejects.toThrow('invalid integer');
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
});

describe('selected unsigned magnitude sign policy', () => {
  it.each([
    'accept',
    'reject',
    'unknown',
  ] as const)('uses the selected executable and per-call environment (%s)', async (policy) => {
    const adapters = createMockAdapters();
    vi.mocked(adapters.exec.spawn).mockImplementation(async ({ argv }) =>
      argv.includes('--max-pack-size=-0')
        ? {
            exitCode: policy === 'unknown' ? 1 : 129,
            stdout: policy === 'accept' ? 'usage: git pack-objects' : '',
            stderr:
              policy === 'reject'
                ? 'error: expects a non-negative integer value'
                : policy === 'unknown'
                  ? 'unrecognized frontend'
                  : '',
            aborted: false,
          }
        : { exitCode: 129, stdout: 'usage: git pack-objects', stderr: '', aborted: false },
    );
    const result = new CliRunner(adapters, { gitBinary: 'selected-git' }).runCommand(
      { type: 'worktree', workdir: '/repo' },
      'pack-objects',
      [['--max-pack-size', '-0'], ['-h']],
      true,
      { env: { PATH: '/selected' } },
    );
    if (policy === 'reject') {
      await expect(result).rejects.toThrow('invalid integer');
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    } else {
      await expect(result).resolves.toMatchObject({ exitCode: policy === 'unknown' ? 1 : 129 });
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    }
    for (const [options] of vi.mocked(adapters.exec.spawn).mock.calls) {
      expect(options.argv.slice(0, 3)).toEqual(['selected-git', '-C', '/repo']);
      expect(options.env).toMatchObject({ PATH: '/selected' });
      expect(options.stdin).toBeUndefined();
    }
  });
  it('returns cancellation from the sign probe without executing the requested command', async () => {
    const adapters = createMockAdapters({ aborted: true, exitCode: -1 });
    const result = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'pack-objects',
      [['--max-pack-size', '-0'], ['-h']],
      false,
    );
    expect(result.aborted).toBe(true);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it('fails missing byte output capability before any sign probes', async () => {
    const adapters = createMockAdapters();
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'pack-objects',
        [['--max-pack-size', '-0'], ['-h']],
        false,
        { stdout: 'bytes' },
      ),
    ).rejects.toThrow('binary stdout');
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
});

describe('convenience filter validation failure guard', () => {
  it('fails closed when options change after all selected-profile candidates were rejected', async () => {
    const adapters = createMockAdapters();
    const options = { filter: 'blob:limit=-0' };
    vi.mocked(adapters.exec.spawn).mockImplementation(async () => {
      options.filter = 'blob:none';
      return {
        exitCode: 129,
        stdout: '',
        stderr: 'error: expects a non-negative integer value',
        aborted: false,
      };
    });
    await expect(
      new CliRunner(adapters).validateFilterOptions({ type: 'global' }, 'clone', options),
    ).rejects.toThrow('supported Git filter grammar');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { commandArguments, commandUsesDepthAtoi } from '../commands/build.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

/** Native result without shell or network side effects. */
const result = (exitCode: number, stderr = '') => ({
  exitCode,
  stderr,
  stdout: '',
  aborted: false,
});
describe('independent initial depth atoi profile', () => {
  it('creates a real blocking file before invoking the clone observation', async () => {
    const adapters = createNodeAdapters();
    const exists = adapters.fs.exists.bind(adapters.fs);
    let blocker: string | undefined;
    adapters.exec.spawn = vi.fn().mockImplementation(async (options) => {
      if (options.argv.includes('type-git-depth-profile:invalid')) {
        blocker = options.argv.at(-1)!;
        expect(await exists(blocker!)).toBe(true);
        return result(
          128,
          `fatal: destination path '${blocker}' already exists and is not an empty directory.\n`,
        );
      }
      return result(0);
    });
    await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'fetch',
      [['--all'], ['--depth', '2147483648']],
      true,
    );
    expect(blocker).toBeDefined();
    expect(await exists(blocker!)).toBe(false);
  });

  it('delegates to native execution when a blocking file cannot be created', async () => {
    const adapters = createNodeAdapters();
    adapters.fs.writeFile = undefined;
    adapters.fs.createTempFile = vi.fn();
    adapters.exec.spawn = vi.fn().mockResolvedValue(result(0));
    await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'fetch',
      [['--all'], ['--depth', '2147483648']],
      true,
    );
    expect(adapters.fs.createTempFile).not.toHaveBeenCalled();
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    expect(adapters.exec.spawn.mock.calls[0]![0].argv).toEqual([
      'git',
      'fetch',
      '--all',
      '--depth=2147483648',
    ]);
  });
  it('matches the parser exit exception for the first help-dispatch word', () => {
    expect(commandUsesDepthAtoi('fetch', [['--help'], ['--depth', '2147483648']])).toBe(true);
    expect(commandUsesDepthAtoi('fetch', [['--depth', '2147483648'], ['--help']])).toBe(false);
    expect(commandUsesDepthAtoi('clone', [['--help'], ['--depth', '2147483648']])).toBe(true);
    expect(commandUsesDepthAtoi('clone', [['-h'], ['--depth', '2147483648']])).toBe(false);
  });

  it('retains either recorded conversion independently of C long width', () => {
    const args = [['--all'], ['--depth', '2147483648']];
    expect(
      commandArguments('fetch', args, true, { longBits: 64, sizeTBits: 64, depthAtoiBits: 32 }),
    ).toEqual(['fetch', '--all', '--depth=2147483648']);
    expect(() =>
      commandArguments('fetch', args, true, { longBits: 32, sizeTBits: 64, depthAtoiBits: 64 }),
    ).toThrow(GitArgumentError);
  });
  it('observes saturation without command stdin and removes its temporary file', async () => {
    const adapters = createNodeAdapters();
    adapters.fs.createTempFile = vi.fn().mockResolvedValue('/fixture/depth-profile');
    adapters.fs.deleteFile = vi.fn().mockResolvedValue(undefined);
    adapters.fs.writeFile = vi.fn().mockResolvedValue(undefined);
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(
        result(
          128,
          "fatal: destination path '/fixture/depth-profile' already exists and is not an empty directory.\n",
        ),
      )
      .mockResolvedValueOnce(result(0));
    const env = { TYPE_GIT_DEPTH_TEST: 'yes' };
    const signal = new AbortController().signal;
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'fetch',
      [['--all'], ['--depth', '2147483648']],
      true,
      { env, signal, stdin: 'original' },
    );
    expect(actual.exitCode).toBe(0);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    expect(adapters.exec.spawn.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        argv: [
          'git',
          'clone',
          '--depth=2147483648',
          'type-git-depth-profile:invalid',
          '/fixture/depth-profile',
        ],
        env: expect.objectContaining(env),
        signal,
      }),
    );
    expect(adapters.exec.spawn.mock.calls[0]![0].stdin).toBeUndefined();
    expect(adapters.exec.spawn.mock.calls[1]![0].stdin).toBe('original');
    expect(adapters.fs.deleteFile).toHaveBeenCalledWith('/fixture/depth-profile');
  });
  it('rejects wrapping depth after the observation and still removes the temporary file', async () => {
    const adapters = createNodeAdapters();
    adapters.fs.createTempFile = vi.fn().mockResolvedValue('/fixture/depth-profile');
    adapters.fs.deleteFile = vi.fn().mockResolvedValue(undefined);
    adapters.fs.writeFile = vi.fn().mockResolvedValue(undefined);
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValue(result(128, 'fatal: depth 2147483648 is not a positive number\n'));
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'fetch',
        [['--all'], ['--depth', '2147483648']],
        true,
      ),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    expect(adapters.fs.deleteFile).toHaveBeenCalledTimes(1);
  });
  it('runs the observation without tracing and hides it from audit callbacks', async () => {
    const adapters = createNodeAdapters();
    adapters.fs.createTempFile = vi.fn().mockResolvedValue('/fixture/depth-profile');
    adapters.fs.deleteFile = vi.fn().mockResolvedValue(undefined);
    adapters.fs.writeFile = vi.fn().mockResolvedValue(undefined);
    adapters.exec.spawn = vi.fn().mockImplementation(async (options, handlers) => {
      const traced = Object.keys(options.env).filter((key) => /^GIT_TRACE/.test(key));
      // A traced Git prefixes its diagnostics with trace lines on the same stream.
      const trace = '12:34:56.789012 git.c:463               trace: built-in: git clone\n';
      if (traced.length > 0) {
        handlers?.onStderr?.(trace);
      }
      return result(
        128,
        `${traced.length > 0 ? trace : ''}fatal: depth 2147483648 is not a positive number\n`,
      );
    });
    const onAudit = vi.fn();
    const onTrace = vi.fn();
    const runner = new CliRunner(adapters, {
      env: { GIT_TRACE_PACKET: '1', GIT_TRACE2: '1' },
      audit: { onAudit, onTrace },
    });
    await expect(
      runner.runCommand({ type: 'global' }, 'fetch', [['--all'], ['--depth', '2147483648']], true, {
        env: { GIT_TRACE_SETUP: '1' },
      }),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    const env = adapters.exec.spawn.mock.calls[0]![0].env as Record<string, string>;
    expect(Object.keys(env).filter((key) => /^GIT_TRACE/.test(key))).toEqual([]);
    expect(onAudit).not.toHaveBeenCalled();
    expect(onTrace).not.toHaveBeenCalled();
  });
  it('keeps tracing and auditing the user command after an internal observation', async () => {
    const adapters = createNodeAdapters();
    adapters.fs.createTempFile = vi.fn().mockResolvedValue('/fixture/depth-profile');
    adapters.fs.deleteFile = vi.fn().mockResolvedValue(undefined);
    adapters.fs.writeFile = vi.fn().mockResolvedValue(undefined);
    adapters.exec.spawn = vi
      .fn()
      .mockImplementation(async (options) =>
        options.argv.includes('type-git-depth-profile:invalid')
          ? result(
              128,
              "fatal: destination path '/fixture/depth-profile' already exists and is not an empty directory.\n",
            )
          : result(0),
      );
    const onAudit = vi.fn();
    const runner = new CliRunner(adapters, { audit: { onAudit, onTrace: vi.fn() } });
    await runner.runCommand(
      { type: 'global' },
      'fetch',
      [['--all'], ['--depth', '2147483648']],
      true,
    );
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    expect(adapters.exec.spawn.mock.calls[0]![0].env.GIT_TRACE).toBeUndefined();
    expect(adapters.exec.spawn.mock.calls[1]![0].env.GIT_TRACE).toBe('1');
    expect(onAudit.mock.calls.map(([event]) => [event.type, event.argv])).toEqual([
      ['start', ['git', 'fetch', '--all', '--depth=2147483648']],
      ['end', ['git', 'fetch', '--all', '--depth=2147483648']],
    ]);
  });
  it('validates convenience depth against the observed saturation profile', async () => {
    const adapters = createNodeAdapters();
    adapters.fs.createTempFile = vi.fn().mockResolvedValue('/fixture/depth-profile');
    adapters.fs.deleteFile = vi.fn().mockResolvedValue(undefined);
    adapters.fs.writeFile = vi.fn().mockResolvedValue(undefined);
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValue(
        result(
          128,
          "fatal: destination path '/fixture/depth-profile' already exists and is not an empty directory.\n",
        ),
      );
    await expect(
      new CliRunner(adapters).validateFilterOptions({ type: 'global' }, 'clone', {
        depth: 2147483648,
      }),
    ).resolves.toBeUndefined();
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it('preserves native fallback for unknown output and cleans up the observation file', async () => {
    const adapters = createNodeAdapters();
    adapters.fs.createTempFile = vi.fn().mockResolvedValue('/fixture/depth-profile');
    adapters.fs.deleteFile = vi.fn().mockResolvedValue(undefined);
    adapters.fs.writeFile = vi.fn().mockResolvedValue(undefined);
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(result(128, 'erreur : profondeur invalide'))
      .mockResolvedValueOnce(result(128, 'native original'));
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'fetch',
      [['--all'], ['--depth', '2147483648']],
      true,
    );
    expect(actual.stderr).toBe('native original');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    expect(adapters.fs.deleteFile).toHaveBeenCalledTimes(1);
  });
  it('stops after an aborted observation and retains byte output shape', async () => {
    const adapters = createNodeAdapters();
    adapters.fs.createTempFile = vi.fn().mockResolvedValue('/fixture/depth-profile');
    adapters.fs.deleteFile = vi.fn().mockResolvedValue(undefined);
    adapters.fs.writeFile = vi.fn().mockResolvedValue(undefined);
    adapters.exec.spawn = vi.fn().mockResolvedValue({ ...result(143), aborted: true });
    adapters.exec.spawnBytes = vi.fn();
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'fetch',
      [['--depth', '2147483648']],
      true,
      { stdout: 'bytes' },
    );
    expect(actual.aborted).toBe(true);
    expect(actual.stdout).toEqual(new Uint8Array(0));
    expect(adapters.exec.spawnBytes).not.toHaveBeenCalled();
    expect(adapters.fs.deleteFile).toHaveBeenCalledTimes(1);
  });
  it('rejects NUL before creating an observation file', async () => {
    const adapters = createNodeAdapters();
    adapters.fs.createTempFile = vi.fn();
    adapters.exec.spawn = vi.fn();
    await expect(
      new CliRunner(adapters).runCommand({ type: 'global' }, 'fetch', [['--depth', '1\0']], true),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.fs.createTempFile).not.toHaveBeenCalled();
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
  it('skips observation when help preempts final depth validation', async () => {
    const adapters = createNodeAdapters();
    adapters.fs.createTempFile = vi.fn();
    adapters.exec.spawn = vi.fn().mockResolvedValue(result(0, 'usage: git fetch\n'));
    await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'fetch',
      [['--depth', 'bad'], ['-h']],
      true,
    );
    expect(adapters.fs.createTempFile).not.toHaveBeenCalled();
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
});

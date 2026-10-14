import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { commandArguments } from '../commands/build.js';
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

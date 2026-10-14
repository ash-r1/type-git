import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { commandArguments } from '../commands/build.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

/** Readonly helper observation, separate from the original command result. */
const response = (exitCode: number, stdout = '', stderr = '') => ({
  exitCode,
  stdout,
  stderr,
  aborted: false,
});
describe('observed submodule helper init alias', () => {
  it('preserves frontend spelling under the helper that accepts the alias', () => {
    for (const args of [[['-i']], [['--init'], ['-i']]]) {
      expect(
        commandArguments('submodule update', args, true, {
          longBits: 64,
          sizeTBits: 64,
          submoduleInitAlias: true,
        }),
      ).toEqual(['submodule', 'update', ...args.map(([flag]) => flag)]);
      expect(() =>
        commandArguments('submodule update', args, true, {
          longBits: 64,
          sizeTBits: 64,
          submoduleInitAlias: false,
        }),
      ).toThrow(GitArgumentError);
    }
  });
  it('checks the helper alias before even a later overwrite', () => {
    const args = [['-i'], ['--init']];
    expect(
      commandArguments('submodule--helper update', args, true, {
        longBits: 64,
        sizeTBits: 64,
        submoduleInitAlias: true,
      }),
    ).toEqual(['submodule--helper', 'update', '-i', '--init']);
    expect(() =>
      commandArguments('submodule--helper update', args, true, {
        longBits: 64,
        sizeTBits: 64,
        submoduleInitAlias: false,
      }),
    ).toThrow(GitArgumentError);
  });
  it('observes acceptance without command stdin and retains environment and cancellation', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(response(0, 'usage: git submodule update\n'))
      .mockResolvedValueOnce(response(0));
    const env = { TYPE_GIT_SUBMODULE_TEST: 'yes' };
    const signal = new AbortController().signal;
    await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'submodule update',
      [['-i']],
      true,
      { env, signal, stdin: 'original' },
    );
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    expect(adapters.exec.spawn.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        argv: ['git', 'submodule--helper', 'update', '-i', '-h'],
        env: expect.objectContaining(env),
        signal,
      }),
    );
    expect(adapters.exec.spawn.mock.calls[0]![0].stdin).toBeUndefined();
    expect(adapters.exec.spawn.mock.calls[1]![0].stdin).toBe('original');
  });
  it('rejects a forwarded alias when the selected helper rejects it', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValue(
        response(129, '', "error: unknown switch `i'\nusage: git submodule update\n"),
      );
    await expect(
      new CliRunner(adapters).runCommand({ type: 'global' }, 'submodule update', [['-i']], true),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it('delegates to the original frontend when this older Git has no update helper', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(
        response(128, '', "fatal: 'update' is not a valid submodule--helper subcommand\n"),
      )
      .mockResolvedValueOnce(response(0));
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'submodule update',
      [['-i']],
      true,
    );
    expect(actual.exitCode).toBe(0);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
  });
});

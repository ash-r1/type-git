import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

describe('selected-native pack-redundant deprecation policy', () => {
  for (const outcome of [
    { exitCode: 0, stdout: 'fixture.idx\nfixture.pack\n', stderr: '', aborted: false },
    { exitCode: 128, stdout: '', stderr: 'native deprecation diagnosis', aborted: false },
  ]) {
    it(`forwards one original call and preserves native exit ${outcome.exitCode}`, async () => {
      const adapters = createNodeAdapters();
      const spawn = vi.fn().mockResolvedValue(outcome);
      adapters.exec.spawn = spawn;
      const signal = new AbortController().signal;
      const env = { PACK_REDUNDANT_FIXTURE: 'yes' };
      const actual = await new CliRunner(adapters).runCommand(
        { type: 'global' },
        'pack-redundant',
        [['--all']],
        true,
        { signal, env, stdin: 'caller-input' },
      );
      expect(actual.exitCode).toBe(outcome.exitCode);
      expect(actual.stdout).toBe(outcome.stdout);
      expect(actual.stderr).toBe(outcome.stderr);
      expect(spawn).toHaveBeenCalledTimes(1);
      expect(spawn.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          signal,
          stdin: 'caller-input',
          env: expect.objectContaining(env),
        }),
      );
      expect(spawn.mock.calls[0]?.[0].argv.slice(-2)).toEqual(['pack-redundant', '--all']);
    });
  }
  it('rejects missing pack/all input before spawning', async () => {
    const adapters = createNodeAdapters();
    const spawn = vi.fn();
    adapters.exec.spawn = spawn;
    await expect(
      new CliRunner(adapters).runCommand({ type: 'global' }, 'pack-redundant', [], true),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(spawn).not.toHaveBeenCalled();
  });
});

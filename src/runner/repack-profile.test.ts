import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { commandUsesRepackMaxPackSize } from '../commands/build.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

const response = (exitCode: number, stdout = '', stderr = '', aborted = false) => ({
  exitCode,
  stdout,
  stderr,
  aborted,
});
const args = [['--max-pack-size', 'invalid'], ['-h']];
describe('selected repack callback timing', () => {
  it('observes deferred timing with env/signal and without consuming stdin', async () => {
    const a = createNodeAdapters();
    a.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(response(129, 'usage: git repack\n'))
      .mockResolvedValueOnce(response(129, 'original help'));
    const env = { TYPE_GIT_REPACK_PROFILE: 'yes' };
    const signal = new AbortController().signal;
    const result = await new CliRunner(a).runCommand({ type: 'global' }, 'repack', args, true, {
      env,
      signal,
      stdin: 'original',
    });
    expect(result.stdout).toBe('original help');
    expect(a.exec.spawn).toHaveBeenCalledTimes(2);
    expect(vi.mocked(a.exec.spawn).mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        argv: ['git', 'repack', '--max-pack-size=type-git-profile-invalid', '-h'],
        env: expect.objectContaining(env),
        signal,
      }),
    );
    expect(vi.mocked(a.exec.spawn).mock.calls[0]![0].stdin).toBeUndefined();
    expect(vi.mocked(a.exec.spawn).mock.calls[1]![0].stdin).toBe('original');
  });
  it('keeps an observed immediate callback error', async () => {
    const a = createNodeAdapters();
    a.exec.spawn = vi
      .fn()
      .mockResolvedValue(
        response(
          129,
          '',
          "error: option `max-pack-size' expects a non-negative integer value with an optional k/m/g suffix\n",
        ),
      );
    await expect(
      new CliRunner(a).runCommand({ type: 'global' }, 'repack', args, true),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(a.exec.spawn).toHaveBeenCalledTimes(1);
  });
  for (const diagnostic of [
    'fatal: not a git repository\n',
    'erreur: valeur inconnue\n',
    'error: unrelated integer problem\n',
  ]) {
    it(`forwards the original argv when observation is unknown: ${diagnostic.trim()}`, async () => {
      const a = createNodeAdapters();
      a.exec.spawn = vi
        .fn()
        .mockResolvedValueOnce(response(128, '', diagnostic))
        .mockResolvedValueOnce(response(128, '', 'original failure'));
      const result = await new CliRunner(a).runCommand({ type: 'global' }, 'repack', args, true);
      expect(result.stderr).toBe('original failure');
      expect(vi.mocked(a.exec.spawn).mock.calls[1]![0].argv).toEqual([
        'git',
        'repack',
        '--max-pack-size=invalid',
        '-h',
      ]);
    });
  }
  it('propagates aborts before executing the original command', async () => {
    const a = createNodeAdapters();
    a.exec.spawn = vi.fn().mockResolvedValue(response(130, '', 'aborted', true));
    const result = await new CliRunner(a).runCommand({ type: 'global' }, 'repack', args, true);
    expect(result.aborted).toBe(true);
    expect(a.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it('checks malformed argv before observing the executable', async () => {
    const a = createNodeAdapters();
    a.exec.spawn = vi.fn();
    await expect(
      new CliRunner(a).runCommand(
        { type: 'global' },
        'repack',
        [['--max-pack-size', true], ['-h']],
        true,
      ),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(a.exec.spawn).not.toHaveBeenCalled();
  });
  it('does not discover a timing trait after help or an end marker', () => {
    expect(commandUsesRepackMaxPackSize('repack', [['-h'], ['--max-pack-size', 'invalid']])).toBe(
      false,
    );
    expect(
      commandUsesRepackMaxPackSize('repack', [['--help'], ['--max-pack-size', 'invalid'], ['-h']]),
    ).toBe(false);
    expect(
      commandUsesRepackMaxPackSize('repack', [['--max-pack-size', 'invalid'], ['--'], ['-h']]),
    ).toBe(false);
    expect(commandUsesRepackMaxPackSize('repack', [['--max-pack-size', 'invalid']])).toBe(false);
    expect(commandUsesRepackMaxPackSize('repack', args)).toBe(true);
  });
});

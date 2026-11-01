import { expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

const response = (exitCode: number, stderr = '', aborted = false) => ({
  exitCode,
  stdout: '',
  stderr,
  aborted,
});
it('retains an empty callback accepted by the selected old executable', async () => {
  const adapters = createNodeAdapters();
  adapters.exec.spawn = vi
    .fn()
    .mockResolvedValueOnce(
      response(
        129,
        "error: unknown option `type-git-pickaxe-probe'\nusage: git diff --no-index [<options>] <path> <path>\n",
      ),
    )
    .mockResolvedValueOnce(response(0));
  const result = await new CliRunner(adapters).runCommand(
    { type: 'global' },
    'diff',
    [
      ['-S', ''],
      ['-S', 'one'],
    ],
    true,
  );
  expect(result.exitCode).toBe(0);
  expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
});
it('rejects a reached empty callback on the modern executable even if overwritten', async () => {
  const adapters = createNodeAdapters();
  adapters.exec.spawn = vi
    .fn()
    .mockResolvedValue(response(129, 'error: -S requires a non-empty argument\n'));
  await expect(
    new CliRunner(adapters).runCommand(
      { type: 'global' },
      'diff',
      [
        ['-S', ''],
        ['-S', 'one'],
      ],
      true,
    ),
  ).rejects.toBeInstanceOf(GitArgumentError);
  expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
});
it('retains original stdin, environment and cancellation after unknown observations', async () => {
  const adapters = createNodeAdapters();
  adapters.exec.spawn = vi
    .fn()
    .mockResolvedValueOnce(response(129, 'localized output\n'))
    .mockResolvedValueOnce(response(134, 'native original crash'));
  const signal = new AbortController().signal;
  const env = { TYPE_GIT_PICKAXE_TEST: 'yes' };
  const result = await new CliRunner(adapters).runCommand(
    { type: 'global' },
    'diff',
    [['-S', '']],
    true,
    { stdin: 'original', env, signal },
  );
  expect(result.exitCode).toBe(134);
  expect(result.stderr).toBe('native original crash');
  expect(adapters.exec.spawn.mock.calls[0]![0].stdin).toBeUndefined();
  expect(adapters.exec.spawn.mock.calls[0]![0]).toEqual(
    expect.objectContaining({ signal, env: expect.objectContaining(env) }),
  );
  expect(adapters.exec.spawn.mock.calls[1]![0].stdin).toBe('original');
});
it('returns an aborted observation without executing the original command', async () => {
  const adapters = createNodeAdapters();
  adapters.exec.spawn = vi.fn().mockResolvedValue(response(-1, '', true));
  const result = await new CliRunner(adapters).runCommand(
    { type: 'global' },
    'diff',
    [['-S', '']],
    true,
  );
  expect(result.aborted).toBe(true);
  expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
});
it('does not mistake a help-looking pattern for a parser exit', async () => {
  const adapters = createNodeAdapters();
  adapters.exec.spawn = vi.fn().mockResolvedValue(response(129, 'usage: git diff\n'));
  await new CliRunner(adapters).runCommand({ type: 'global' }, 'diff', [['-S', '-h']], true);
  expect(adapters.exec.spawn.mock.calls.map((call) => call[0].argv)).toEqual([
    ['git', 'diff', '-S', '-h'],
  ]);
});

it('still observes a callback reached after a nonterminal diff help word', async () => {
  const adapters = createNodeAdapters();
  adapters.exec.spawn = vi
    .fn()
    .mockResolvedValue(response(129, 'error: -S requires a non-empty argument\n'));
  await expect(
    new CliRunner(adapters).runCommand({ type: 'global' }, 'diff', [['-h'], ['-S', '']], true),
  ).rejects.toBeInstanceOf(GitArgumentError);
  expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
});
it('preserves native failure code and stderr under the old callback family', async () => {
  const adapters = createNodeAdapters();
  adapters.exec.spawn = vi
    .fn()
    .mockResolvedValueOnce(
      response(
        129,
        "error: unknown option `type-git-pickaxe-probe'\nusage: git diff --no-index [<options>] <path> <path>\n",
      ),
    )
    .mockResolvedValueOnce({ ...response(-1, 'native abort'), signal: 'SIGABRT' });
  const result = await new CliRunner(adapters).runCommand(
    { type: 'global' },
    'diff',
    [['-S', '']],
    true,
  );
  expect(result.exitCode).toBe(-1);
  expect(result.stderr).toBe('native abort');
});
it('does not observe delegated callbacks when final tool-help returns first', async () => {
  const adapters = createNodeAdapters();
  adapters.exec.spawn = vi.fn().mockResolvedValue(response(0));
  await new CliRunner(adapters).runCommand(
    { type: 'global' },
    'difftool',
    [['-S', ''], ['--tool-help']],
    true,
  );
  expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
});

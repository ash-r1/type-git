import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

describe('documentation transport before local parser profiles', () => {
  it('does not probe clone depth or create profile files after documentation exits', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValue({ exitCode: 129, stdout: '', stderr: 'usage: git help', aborted: false });
    adapters.fs.createTempFile = vi.fn().mockResolvedValue('/unused-documentation-profile');
    adapters.fs.writeFile = vi.fn().mockResolvedValue(undefined);
    adapters.fs.deleteFile = vi.fn().mockResolvedValue(undefined);
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'clone',
      [['--help'], ['--help-all'], ['--depth', 'bad']],
      true,
      { stdin: 'original input' },
    );
    expect(actual.exitCode).toBe(129);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        argv: ['git', 'clone', '--help', '--help-all', '--depth=bad'],
        stdin: 'original input',
      }),
      undefined,
    );
    expect(adapters.fs.createTempFile).not.toHaveBeenCalled();
    expect(adapters.fs.writeFile).not.toHaveBeenCalled();
  });

  it('rejects an active documentation grammar error before any depth profile probe', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValue({ exitCode: 129, stdout: '', stderr: 'usage: git help', aborted: false });
    adapters.fs.createTempFile = vi.fn().mockResolvedValue('/unused-documentation-profile');
    adapters.fs.writeFile = vi.fn().mockResolvedValue(undefined);
    adapters.fs.deleteFile = vi.fn().mockResolvedValue(undefined);
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'clone',
        [['--help'], ['--depth', 'bad']],
        true,
      ),
    ).rejects.toThrow(GitArgumentError);
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
    expect(adapters.fs.createTempFile).not.toHaveBeenCalled();
  });
});

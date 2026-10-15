import { describe, expect, it, vi } from 'vitest';
import type { RuntimeAdapters } from '../core/adapters.js';
import { CliRunner } from './cli-runner.js';

/** Model distinct observed filename parser results without a Git version guess. */
function runtime(negate: number, empty: number): RuntimeAdapters {
  return {
    exec: {
      getCapabilities: () => ({
        canSpawnProcess: true,
        canReadEnv: true,
        canWriteTemp: true,
        supportsAbortSignal: true,
        supportsKillSignal: true,
        runtime: 'node',
      }),
      spawn: vi.fn(async ({ argv }) => {
        const probe = argv.includes('type-git-profile-readonly');
        const code = probe ? (argv.includes('--no-file') ? negate : empty) : 0;
        return {
          exitCode: code,
          stdout: probe ? '' : 'executed',
          stderr: code === 129 ? 'usage: git tag [options]\n' : code ? 'not a repository\n' : '',
          aborted: false,
        };
      }),
    },
    fs: {
      createTempFile: async () => '',
      deleteFile: async () => undefined,
      deleteDirectory: async () => undefined,
      tail: async () => undefined,
      exists: async () => false,
    },
  };
}
const negated = [['--list'], ['--file', 'message'], ['--no-file']];
describe('selected native filename profile', () => {
  it.each([
    false,
    true,
  ])('rejects checked shortlog overflow before probes (filename=%s)', async (filename) => {
    const adapters = runtime(0, 0);
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'shortlog',
        [...(filename ? [['-O', '']] : []), ['-w', '4294967297,0,0']],
        true,
      ),
    ).rejects.toThrow('invalid shortlog-wrap');
  });
  it.each([
    [0, 129],
    [0, 0],
  ])('uses observed clearing negation without a Git version guess (%i/%i)', async (negate, empty) => {
    const adapters = runtime(negate, empty);
    const result = await new CliRunner(adapters)
      .withOptions({ env: { BASE: 'retained' } })
      .runCommand({ type: 'global' }, 'tag', negated, true, { env: { CALL: 'same' } });
    expect(result.stdout).toBe('executed');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(3);
    for (const [options] of vi.mocked(adapters.exec.spawn).mock.calls) {
      expect(options.env).toMatchObject({ BASE: 'retained', CALL: 'same' });
    }
  });
  it('retains the filename when the observed parser ignores negation', async () => {
    const adapters = runtime(129, 0);
    await expect(
      new CliRunner(adapters).runCommand({ type: 'global' }, 'tag', negated, true),
    ).rejects.toThrow('Tag creation options');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
  });
  it('defers an unrecognized/non-repository profile to native execution', async () => {
    const adapters = runtime(128, 128);
    expect(
      (await new CliRunner(adapters).runCommand({ type: 'global' }, 'tag', negated, true)).stdout,
    ).toBe('executed');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(3);
  });
  it('rejects malformed IO before performing profile probes', async () => {
    const adapters = runtime(0, 0);
    await expect(
      new CliRunner(adapters).runCommand({ type: 'global' }, 'tag', negated, true, {
        stdout: 'invalid' as 'text',
      }),
    ).rejects.toThrow();
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
  it('rejects an independent invalid option before performing profile probes', async () => {
    const adapters = runtime(0, 0);
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'tag',
        [...negated, ['--unknown']],
        true,
      ),
    ).rejects.toThrow();
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
  it('skips both profile probes when all ABI and filename variants accept the input', async () => {
    const adapters = runtime(0, 0);
    await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'shortlog',
      [
        ['-O', ''],
        ['-w', '80,6,9'],
      ],
      true,
    );
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
});

describe('optional filename lookup through selected Git', () => {
  it('observes each path independently and preserves command stdin and environment', async () => {
    const adapters = runtime(129, 0);
    vi.mocked(adapters.exec.spawn).mockImplementation(async ({ argv }) => {
      const probe = argv.includes('type-git-profile-readonly');
      const code = !probe
        ? 0
        : argv.includes('--no-file') || argv.includes('--file=:(optional)paths')
          ? 129
          : 0;
      return {
        exitCode: code,
        stdout: probe ? '' : 'executed',
        stderr: code ? 'usage: git tag' : '',
        aborted: false,
      };
    });
    const result = await new CliRunner(adapters, { gitBinary: 'selected-git' }).runCommand(
      { type: 'worktree', workdir: '/repo' },
      'commit',
      [
        ['-m', 'mixed'],
        ['--file', ':(optional)missing'],
        ['--pathspec-from-file', ':(optional)paths'],
        ['--pathspec-file-nul'],
      ],
      true,
      { env: { PATH: '/selected' }, stdin: 'command input' },
    );
    expect(result.stdout).toBe('executed');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(5);
    const calls = vi.mocked(adapters.exec.spawn).mock.calls;
    for (const [options] of calls) {
      expect(options.argv.slice(0, 3)).toEqual(['selected-git', '-C', '/repo']);
      expect(options.env).toMatchObject({ PATH: '/selected' });
      if (options.argv.includes('type-git-profile-readonly')) {
        expect(options.stdin).toBeUndefined();
      } else {
        expect(options.stdin).toBe('command input');
      }
    }
  });
  it('returns cancellation during lookup without executing the command', async () => {
    const adapters = runtime(129, 0);
    vi.mocked(adapters.exec.spawn).mockImplementation(async ({ argv }) => ({
      exitCode: argv.includes('--file=:(optional)missing')
        ? -1
        : argv.includes('--no-file')
          ? 129
          : 0,
      stdout: '',
      stderr: argv.includes('--no-file') ? 'usage: git tag' : '',
      aborted: argv.includes('--file=:(optional)missing'),
    }));
    const result = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'tag',
      [['--list'], ['--file', ':(optional)missing']],
      true,
    );
    expect(result.aborted).toBe(true);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(3);
  });
  it('defers native stat failures instead of interpreting them as missing paths', async () => {
    const adapters = runtime(129, 0);
    vi.mocked(adapters.exec.spawn).mockImplementation(async ({ argv }) => ({
      exitCode: argv.includes('--file=:(optional)denied')
        ? 128
        : argv.includes('--no-file')
          ? 129
          : 0,
      stdout: '',
      stderr: argv.includes('--file=:(optional)denied')
        ? 'fatal: could not stat denied: Permission denied'
        : argv.includes('--no-file')
          ? 'usage: git tag'
          : '',
      aborted: false,
    }));
    const result = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'tag',
      [['--list'], ['--file', ':(optional)denied']],
      true,
    );
    expect(result.exitCode).toBe(128);
    expect(result.stderr).toContain('Permission denied');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(4);
  });
});

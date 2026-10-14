import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import type { SpawnResult } from '../core/adapters.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

const result = (exitCode = 0, stderr = '', stdout = ''): SpawnResult => ({
  exitCode,
  stderr,
  stdout,
  aborted: false,
});
const cases = [
  {
    command: 'daemon',
    args: [['--timeout', '1k'], ['-h']],
    modern: result(128, "fatal: invalid timeout '1k', expecting a non-negative integer\n"),
  },
  {
    command: 'daemon',
    args: [['--init-timeout', '1k'], ['-h']],
    modern: result(128, "fatal: invalid init-timeout '1k', expecting a non-negative integer\n"),
  },
  {
    command: 'rev-list',
    args: [['--max-count', '1k'], ['--all']],
    modern: result(128, "fatal: '1k': not an integer\n"),
  },
  {
    command: 'diff-files',
    args: [['--unified', '-1']],
    modern: result(129, 'error: --unified expects a non-negative integer\n'),
  },
  {
    command: 'apply',
    args: [['-p', '1k'], ['--check']],
    modern: result(128, "fatal: option -p expects a non-negative integer, got '1k'\n"),
  },
  {
    command: 'daemon',
    args: [['--max-connections', '1k'], ['-h']],
    modern: result(128, "fatal: invalid max-connections '1k', expecting an integer\n"),
  },
] as const;

/** Probe transport must preserve the actual command's context without consuming its input. */
describe('numeric callback probe transport', () => {
  for (const item of cases) {
    for (const family of ['modern', 'legacy'] as const) {
      it(`selects ${family} ${item.command} independently`, async () => {
        const adapters = createNodeAdapters();
        adapters.exec.spawn = vi
          .fn()
          .mockResolvedValueOnce(
            family === 'modern' ? item.modern : result(129, '', 'usage: git command\n'),
          )
          .mockResolvedValue(result(0, '', 'actual-output'));
        const runner = new CliRunner(adapters, { gitBinary: '/selected/git' });
        const controller = new AbortController();
        const promise = runner.runCommand(
          { type: 'worktree', workdir: '/selected/repo' },
          item.command,
          item.args,
          true,
          {
            env: { TYPE_GIT_CALLBACK_FIXTURE: 'value' },
            signal: controller.signal,
            stdin: 'command-input',
          },
        );
        if (family === 'modern') {
          await expect(promise).rejects.toBeInstanceOf(GitArgumentError);
        } else {
          expect((await promise).stdout).toBe('actual-output');
        }
        expect(adapters.exec.spawn).toHaveBeenCalledTimes(family === 'modern' ? 1 : 2);
        expect(adapters.exec.spawn).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            argv: expect.arrayContaining(['/selected/git', '-C', '/selected/repo']),
            cwd: '/selected/repo',
            signal: controller.signal,
            env: expect.objectContaining({ TYPE_GIT_CALLBACK_FIXTURE: 'value' }),
            stdin: undefined,
          }),
          undefined,
        );
        if (family === 'legacy') {
          expect(adapters.exec.spawn).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ stdin: 'command-input' }),
            undefined,
          );
        }
      });
    }
  }

  it('delegates an unrecognized probe result to the original native argv', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(result(128, 'fatal: localized or custom frontend\n'))
      .mockResolvedValue(result(128, 'original native error\n'));
    const runner = new CliRunner(adapters);
    const actual = await runner.runCommand(
      { type: 'global' },
      'rev-list',
      [['--max-count', '1k'], ['--all']],
      true,
      { stdin: 'input' },
    );
    expect(actual.exitCode).toBe(128);
    expect(actual.stderr).toBe('original native error\n');
    expect(adapters.exec.spawn).toHaveBeenLastCalledWith(
      expect.objectContaining({
        argv: ['git', 'rev-list', '--max-count=1k', '--all'],
        stdin: 'input',
      }),
      undefined,
    );
  });

  it('returns cancellation from a callback probe before byte execution', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue({ ...result(143), aborted: true });
    adapters.exec.spawnBytes = vi.fn();
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'apply',
      [['-p', '1k'], ['--check']],
      true,
      { stdout: 'bytes', stdin: new Uint8Array([1]) },
    );
    expect(actual.aborted).toBe(true);
    expect(actual.stdout).toEqual(new Uint8Array(0));
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    expect(adapters.exec.spawnBytes).not.toHaveBeenCalled();
  });

  it('rejects unsafe numbers before probing every callback family', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn();
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'rev-list',
        [['--max-count', 9007199254740992], ['--all']],
        true,
      ),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });

  it('rejects a NUL in the original numeric word before any callback probe', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn();
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'rev-list',
        [['--max-count', '1\0bad'], ['--all']],
        true,
      ),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
});

describe('selected executable width for convenience mainline checks', () => {
  for (const width of [4, 8] as const) {
    it(`uses reported C long ${width * 8} independently of the Node platform`, async () => {
      const adapters = createNodeAdapters();
      adapters.exec.spawn = vi
        .fn()
        .mockResolvedValue(result(0, '', `sizeof-long: ${width}\nsizeof-size_t: 8\n`));
      const promise = new CliRunner(adapters, {
        gitBinary: '/selected/git',
      }).validateMainlineOptions({ type: 'worktree', workdir: '/selected/repo' }, 'cherryPick', {
        mainline: 2147483648,
      });
      if (width === 4) {
        await expect(promise).resolves.toBeUndefined();
      } else {
        await expect(promise).rejects.toBeInstanceOf(GitArgumentError);
      }
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: ['/selected/git', '-C', '/selected/repo', 'version', '--build-options'],
        }),
        undefined,
      );
    });
  }
  it('retains native validation when the executable cannot report its C long width', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue(result(0, '', 'git version custom\n'));
    await expect(
      new CliRunner(adapters).validateMainlineOptions({ type: 'global' }, 'revert', {
        mainline: 2147483648,
      }),
    ).resolves.toBeUndefined();
  });
});

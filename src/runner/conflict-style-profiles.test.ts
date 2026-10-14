import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { commandArguments } from '../commands/build.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

/** Minimal adapter response used to exercise parser-profile transport behavior. */
const result = (exitCode: number, stderr = '', stdout = '') => ({
  exitCode,
  stderr,
  stdout,
  aborted: false,
});
const abi = { longBits: 64, sizeTBits: 64 } as const;
describe('selected conflict callback timing', () => {
  for (const command of ['checkout', 'switch', 'restore'] as const) {
    it(`${command} checks whole tuples under each source parser family`, () => {
      const args = [['--conflict', 'bad'], ['-h']];
      expect(() =>
        commandArguments(command, args, true, { ...abi, conflictStyle: 'immediate' }),
      ).toThrow(GitArgumentError);
      expect(commandArguments(command, args, true, { ...abi, conflictStyle: 'deferred' })).toEqual([
        command,
        '--conflict=bad',
        '-h',
      ]);
      expect(() =>
        commandArguments(command, [['--conflict', 'bad']], true, {
          ...abi,
          conflictStyle: 'deferred',
        }),
      ).toThrow(GitArgumentError);
      expect(
        commandArguments(command, [['--conflict', 'bad'], ['--conflict', 'merge'], ['-h']], true, {
          ...abi,
          conflictStyle: 'deferred',
        }),
      ).toEqual([command, '--conflict=bad', '--conflict=merge', '-h']);
    });
  }
  it('keeps first --help dispatcher validation distinct from internal help exits', () => {
    for (const conflictStyle of ['immediate', 'deferred'] as const) {
      for (const value of ['bad', 'merge']) {
        expect(() =>
          commandArguments('switch', [['--help'], ['--conflict', value]], true, {
            ...abi,
            conflictStyle,
          }),
        ).toThrow(GitArgumentError);
        expect(
          commandArguments('switch', [['--help'], ['-h'], ['--conflict', value]], true, {
            ...abi,
            conflictStyle,
          }),
        ).toEqual(['switch', '--help', '-h', `--conflict=${value}`]);
      }
    }
  });
  for (const family of ['immediate', 'deferred'] as const) {
    it(`observes ${family} from a readonly help probe with original execution context`, async () => {
      const adapters = createNodeAdapters();
      adapters.exec.spawn = vi
        .fn()
        .mockResolvedValueOnce(
          family === 'immediate'
            ? result(129, "error: unknown conflict style 'bad'\n")
            : result(129, 'usage: git switch\n'),
        )
        .mockResolvedValue(result(129, 'usage: git switch\n'));
      const controller = new AbortController();
      const run = new CliRunner(adapters, { gitBinary: '/chosen/git' }).runCommand(
        { type: 'worktree', workdir: '/chosen/repo' },
        'switch',
        [['--conflict', 'bad'], ['-h']],
        true,
        {
          env: { TYPE_GIT_CONFLICT_TEST: 'yes' },
          signal: controller.signal,
          stdin: 'actual input',
        },
      );
      if (family === 'immediate') {
        await expect(run).rejects.toBeInstanceOf(GitArgumentError);
      } else {
        expect((await run).exitCode).toBe(129);
      }
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(family === 'immediate' ? 1 : 2);
      expect(adapters.exec.spawn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          argv: ['/chosen/git', '-C', '/chosen/repo', 'switch', '--conflict=bad', '-h'],
          cwd: '/chosen/repo',
          stdin: undefined,
          signal: controller.signal,
          env: expect.objectContaining({ TYPE_GIT_CONFLICT_TEST: 'yes' }),
        }),
        undefined,
      );
      if (family === 'deferred') {
        expect(adapters.exec.spawn).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ stdin: 'actual input' }),
          undefined,
        );
      }
    });
  }
  it('lets the original native command validate an unrecognized probe outcome', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(result(128, 'unrecognized probe'))
      .mockResolvedValue(result(128, 'native original error'));
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'switch',
      [['--conflict', 'bad'], ['-h']],
      true,
      { stdin: 'actual input' },
    );
    expect(actual.stderr).toBe('native original error');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
  });
  it('does not execute after a cancelled probe, including binary output', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue({ ...result(143), aborted: true });
    adapters.exec.spawnBytes = vi.fn();
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'switch',
      [['--conflict', 'bad'], ['-h']],
      true,
      { stdout: 'bytes' },
    );
    expect(actual.aborted).toBe(true);
    expect(actual.stdout).toEqual(new Uint8Array(0));
    expect(adapters.exec.spawnBytes).not.toHaveBeenCalled();
  });
});

describe('native conflict callback ordering', () => {
  let cwd: string;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'type-git-conflict-'));
    env = {
      ...process.env,
      HOME: cwd,
      GIT_CONFIG_GLOBAL: join(cwd, 'unused'),
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_COUNT: '0',
      LC_ALL: 'C',
    };
    for (const key of [
      'GIT_DIR',
      'GIT_WORK_TREE',
      'GIT_COMMON_DIR',
      'GIT_INDEX_FILE',
      'GIT_OBJECT_DIRECTORY',
      'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    ]) {
      delete env[key];
    }
    const init = spawnSync('git', ['init', '-q'], { cwd, env, encoding: 'utf8', timeout: 10000 });
    expect(init.error).toBeUndefined();
    expect(init.status).toBe(0);
  });
  afterAll(async () => {
    await rm(cwd, { recursive: true, force: true });
  });
  for (const command of ['checkout', 'switch', 'restore'] as const) {
    for (const args of [
      [['--conflict', 'bad'], ['-h']],
      [['-h'], ['--conflict', 'bad']],
      [['--conflict', 'bad'], ['--conflict', 'merge'], ['-h']],
    ]) {
      it(`${command} retains source-specific help ordering ${JSON.stringify(args)}`, async () => {
        const argv = args.map(([flag, value]) =>
          value === undefined ? flag! : `${flag}=${value}`,
        );
        const native = spawnSync('git', [command, ...argv], {
          cwd,
          env,
          encoding: 'utf8',
          timeout: 10000,
        });
        expect(native.error).toBeUndefined();
        expect([0, 129]).toContain(native.status);
        const run = new CliRunner(createNodeAdapters()).runCommand(
          { type: 'worktree', workdir: cwd },
          command,
          args,
          true,
          { env },
        );
        if ((native.stderr + native.stdout).startsWith('usage:')) {
          const actual = await run;
          expect(actual.exitCode).toBe(native.status);
          expect(actual.stderr).toBe(native.stderr);
          expect(actual.stdout).toBe(native.stdout);
        } else {
          expect(native.stderr).toContain("unknown conflict style 'bad'");
          await expect(run).rejects.toBeInstanceOf(GitArgumentError);
        }
      });
    }
  }
});

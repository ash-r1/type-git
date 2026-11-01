import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

/** Adapter transcript for readonly parser capability observations. */
const response = (exitCode: number, stdout = '', stderr = '') => ({
  exitCode,
  stdout,
  stderr,
  aborted: false,
});
describe('boolean parser observations', () => {
  it('observes preserve support independently of integer grammar and retains command stdin', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(response(129, '', 'usage: git pull\n'))
      .mockResolvedValue(response(129, '', 'usage: git pull\n'));
    const env = { TYPE_GIT_BOOL_TEST: 'yes' };
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'pull',
      [['--rebase', 'preserve'], ['-h']],
      true,
      { env, stdin: 'original stdin' },
    );
    expect(actual.exitCode).toBe(129);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    expect(adapters.exec.spawn.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        argv: ['git', 'pull', '--rebase=preserve', '-h'],
        stdin: undefined,
        env: expect.objectContaining(env),
      }),
    );
    expect(adapters.exec.spawn.mock.calls[1]![0].stdin).toBe('original stdin');
  });
  it('rejects a removed rebase mode using the original callback probe', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValue(response(129, '', "error: preserve: 'preserve' superseded by 'merges'\n"));
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'pull',
        [['--rebase', 'p'], ['-h']],
        true,
      ),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it('does not infer a hidden transition from config integer grammar', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValue(
        response(128, '', 'fatal: bad recurse-submodules argument: only-is-on-demand\n'),
      );
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'push',
        [['--recurse-submodules', 'only-is-on-demand'], ['-h']],
        true,
      ),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it('keeps native execution for an unrecognized localized capability response', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValue(response(129, '', 'erreur : valeur inconnue\n'));
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'pull',
      [['--rebase', 'p'], ['-h']],
      true,
      { stdin: 'original' },
    );
    expect(actual.stderr).toBe('erreur : valeur inconnue\n');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
  });
  it('stops after an aborted capability observation and preserves binary result shape', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue({ ...response(143), aborted: true });
    adapters.exec.spawnBytes = vi.fn();
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'pull',
      [['--rebase', 'p'], ['-h']],
      true,
      { stdout: 'bytes' },
    );
    expect(actual.aborted).toBe(true);
    expect(actual.stdout).toEqual(new Uint8Array(0));
    expect(adapters.exec.spawnBytes).not.toHaveBeenCalled();
  });
  it('observes the config grammar in the command context without consuming its stdin', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(response(128, '', 'fatal: bad boolean config value'))
      .mockResolvedValueOnce(response(0, 'true\n'))
      .mockResolvedValueOnce(response(129, '', 'usage: git checkout\n'));
    const signal = new AbortController().signal;
    const env = { TYPE_GIT_BOOL_TEST: 'grammar' };
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'worktree', workdir: '/isolated-context' },
      'checkout',
      [['--recurse-submodules', '-2147483648'], ['-h']],
      true,
      { env, signal, stdin: 'original' },
    );
    expect(actual.exitCode).toBe(129);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(3);
    for (const call of adapters.exec.spawn.mock.calls.slice(0, 2)) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          argv: expect.arrayContaining([
            'config',
            '--type=bool',
            '--get',
            'typegitprofile.boolean',
          ]),
          cwd: '/isolated-context',
          env: expect.objectContaining(env),
          signal,
        }),
      );
      expect(call[0].stdin).toBeUndefined();
    }
    expect(adapters.exec.spawn.mock.calls[2]![0].stdin).toBe('original');
  });
  it('keeps binary integer support independent of the config source family', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValue(response(128, '', 'fatal: bad numeric config value'));
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'checkout',
        [['--recurse-submodules', '0b1'], ['-h']],
        true,
      ),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    expect(adapters.exec.spawn.mock.calls[0]![0].argv).toContain('typegitprofile.boolean=0b1');
  });
  it('retains original argv on an unrecognized config response', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(response(128, '', 'erreur : valeur inconnue'))
      .mockResolvedValueOnce(response(129, '', 'usage: git checkout\n'));
    await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'checkout',
      [['--recurse-submodules', 'm'], ['-h']],
      true,
      { stdin: 'original' },
    );
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    expect(adapters.exec.spawn.mock.calls[1]![0]).toEqual(
      expect.objectContaining({
        argv: ['git', 'checkout', '--recurse-submodules=m', '-h'],
        stdin: 'original',
      }),
    );
  });
  it('returns an aborted config observation without running the command', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue({ ...response(143), aborted: true });
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'checkout',
      [['--recurse-submodules', 'm'], ['-h']],
      true,
    );
    expect(actual.aborted).toBe(true);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it('rejects NUL before either a capability or config observation', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn();
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'pull',
        [['--rebase', 'p'], ['-h'], { operand: 'a\0b' }],
        true,
      ),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
  it('avoids observations for ignored words after help', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue(response(129, '', 'usage: git pull\n'));
    await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'pull',
      [['-h'], ['--rebase', 'p']],
      true,
    );
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
});

describe('selected native boolean callbacks', () => {
  let cwd: string;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'type-git-bool-native-'));
    env = {
      ...process.env,
      HOME: cwd,
      GIT_CONFIG_GLOBAL: join(cwd, 'unused-config'),
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
  const cases = [
    ['checkout', '--recurse-submodules', 'm'],
    ['checkout', '--recurse-submodules', '-2147483648'],
    ['checkout', '--recurse-submodules', '0b1'],
    ['pull', '--rebase', 'preserve'],
    ['pull', '--rebase', 'm'],
    ['push', '--recurse-submodules', 'only-is-on-demand'],
    ['push', '--recurse-submodules', 'm'],
  ] as const;
  for (const [command, flag, value] of cases) {
    it(`matches actual ${command} ${flag}=${value} before help`, async () => {
      const native = spawnSync('git', [command, `${flag}=${value}`, '-h'], {
        cwd,
        env,
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(native.error).toBeUndefined();
      const run = new CliRunner(createNodeAdapters()).runCommand(
        { type: 'worktree', workdir: cwd },
        command,
        [[flag, value], ['-h']],
        true,
        { env },
      );
      if (
        [0, 129].includes(native.status!) &&
        (native.stderr + native.stdout).startsWith('usage:')
      ) {
        const actual = await run;
        expect(actual.exitCode).toBe(native.status);
        expect(actual.stdout).toBe(native.stdout);
        expect(actual.stderr).toBe(native.stderr);
      } else {
        expect(native.stderr).toMatch(/rebase|recurse-submodules/);
        await expect(run).rejects.toBeInstanceOf(GitArgumentError);
      }
    });
  }
});

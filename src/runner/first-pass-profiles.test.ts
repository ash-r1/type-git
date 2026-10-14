import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import {
  commandArguments,
  commandUsesBooleanSource,
  commandUsesNativeABI,
} from '../commands/build.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

/** Adapter response for the selected executable's readonly parser observation. */
const response = (exitCode: number, stdout = '', stderr = '') => ({
  exitCode,
  stdout,
  stderr,
  aborted: false,
});
describe('observed initial parser profiles', () => {
  it('preserves an unknown --empty word in the older initial parser before help', () => {
    const args = [['--empty', 'bad'], ['-h']];
    expect(
      commandArguments('cherry-pick', args, true, {
        longBits: 64,
        sizeTBits: 64,
        firstPassEmpty: false,
      }),
    ).toEqual(['cherry-pick', '--empty=bad', '-h']);
    expect(() =>
      commandArguments('cherry-pick', args, true, {
        longBits: 64,
        sizeTBits: 64,
        firstPassEmpty: true,
      }),
    ).toThrow(GitArgumentError);
  });
  it('executes ordinary empty handling once without a parser observation', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue(response(0));
    await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'cherry-pick',
      [['--empty', 'drop'], { operand: 'HEAD' }],
      true,
    );
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    expect(adapters.exec.spawn.mock.calls[0]![0].argv).toEqual([
      'git',
      'cherry-pick',
      '--empty=drop',
      'HEAD',
    ]);
  });
  it('falls back for an unrelated empty diagnostic instead of selecting an option set', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(response(129, '', 'error: empty object directory is invalid\n'))
      .mockResolvedValueOnce(response(128, '', 'native original'));
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'cherry-pick',
      [['--empty', 'bad'], ['-h']],
      true,
    );
    expect(actual.stderr).toBe('native original');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
  });
  it('observes empty behavior without consuming command stdin', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue(response(129, '', 'usage: git cherry-pick\n'));
    const env = { TYPE_GIT_FIRST_PASS_TEST: 'yes' };
    const signal = new AbortController().signal;
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'cherry-pick',
      [['--empty', 'bad'], ['-h']],
      true,
      { env, signal, stdin: 'original' },
    );
    expect(actual.exitCode).toBe(129);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    expect(adapters.exec.spawn.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        argv: ['git', 'cherry-pick', '--empty=type-git-invalid', '-h'],
        env: expect.objectContaining(env),
        signal,
      }),
    );
    expect(adapters.exec.spawn.mock.calls[0]![0].stdin).toBeUndefined();
    expect(adapters.exec.spawn.mock.calls[1]![0].stdin).toBe('original');
  });
  it('retains native execution for an unrecognized localized response', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(response(128, '', 'erreur : choix inconnu'))
      .mockResolvedValueOnce(response(129, '', 'native original'));
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'cherry-pick',
      [['--empty', 'bad'], ['-h']],
      true,
    );
    expect(actual.stderr).toBe('native original');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
  });
  it('stops after an aborted first-pass observation and preserves byte output shape', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue({ ...response(143), aborted: true });
    adapters.exec.spawnBytes = vi.fn();
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'cherry-pick',
      [['--empty', 'bad'], ['-h']],
      true,
      { stdout: 'bytes' },
    );
    expect(actual.aborted).toBe(true);
    expect(actual.stdout).toEqual(new Uint8Array(0));
    expect(adapters.exec.spawnBytes).not.toHaveBeenCalled();
  });
  it('discovers a boolean callback consumed from a numeric API value without help', () => {
    expect(commandUsesBooleanSource('log', [['-n', '--decorate=m'], ['--all']])).toBe(true);
  });
  it('matches selected Git when an initial callback consumes a numeric API value', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'type-git-hidden-traits-'));
    try {
      const env = {
        ...process.env,
        HOME: cwd,
        XDG_CONFIG_HOME: cwd,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: join(cwd, 'config'),
        GIT_CONFIG_COUNT: '0',
        LC_ALL: 'C',
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      };
      for (const name of [
        'GIT_DIR',
        'GIT_WORK_TREE',
        'GIT_COMMON_DIR',
        'GIT_INDEX_FILE',
        'GIT_OBJECT_DIRECTORY',
        'GIT_ALTERNATE_OBJECT_DIRECTORIES',
      ]) {
        delete (env as NodeJS.ProcessEnv)[name];
      }
      for (const args of [
        ['init', '-q'],
        ['commit', '--allow-empty', '-qm', 'one'],
      ]) {
        const init = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
        expect(init.status, init.stderr).toBe(0);
      }
      const native = spawnSync('git', ['log', '-n', '--decorate=m', '--all'], {
        cwd,
        env,
        encoding: 'utf8',
      });
      const run = new CliRunner(createNodeAdapters()).runCommand(
        { type: 'worktree', workdir: cwd },
        'log',
        [['-n', '--decorate=m'], ['--all']],
        true,
        { env },
      );
      if (native.status === 0) {
        const actual = await run;
        expect(actual.exitCode).toBe(0);
        expect(actual.stdout).toBe(native.stdout);
      } else {
        expect(native.stderr).toContain('invalid --decorate');
        await expect(run).rejects.toBeInstanceOf(GitArgumentError);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
  it('discovers only callbacks reached before a split value becomes initial help', () => {
    const args = [
      ['-G', '-h'],
      ['--decorate', 'm'],
    ];
    expect(commandUsesBooleanSource('log', args)).toBe(false);
    expect(commandUsesNativeABI('log', args)).toBe(false);
    expect(
      commandUsesBooleanSource('log', [
        ['--decorate', 'm'],
        ['-G', '-h'],
      ]),
    ).toBe(true);
  });
  it('does not observe an empty option after an initial help word', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue(response(129, '', 'usage: git cherry-pick\n'));
    await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'cherry-pick',
      [['-h'], ['--empty', 'bad']],
      true,
    );
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it('rejects NUL before initial parser observations', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn();
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'cherry-pick',
        [['--empty', 'bad'], ['-h'], { operand: 'bad\0word' }],
        true,
      ),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
  it('matches actual selected empty callback behavior before help', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'type-git-firstpass-native-'));
    try {
      const env = {
        ...process.env,
        HOME: cwd,
        XDG_CONFIG_HOME: cwd,
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
      const native = spawnSync('git', ['cherry-pick', '--empty=bad', '-h'], {
        cwd,
        env,
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(native.error).toBeUndefined();
      const run = new CliRunner(createNodeAdapters()).runCommand(
        { type: 'worktree', workdir: cwd },
        'cherry-pick',
        [['--empty', 'bad'], ['-h']],
        true,
        { env },
      );
      if (
        [0, 129].includes(native.status!) &&
        (native.stderr + native.stdout).startsWith('usage:')
      ) {
        const actual = await run;
        expect(actual.exitCode).toBe(native.status);
        expect(actual.stderr).toBe(native.stderr);
        expect(actual.stdout).toBe(native.stdout);
      } else {
        expect(native.stderr).toContain('empty');
        await expect(run).rejects.toBeInstanceOf(GitArgumentError);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

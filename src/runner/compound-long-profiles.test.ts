import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { commandArguments } from '../commands/build.js';
import { validCompoundDecimal } from '../constraints/compound-decimal.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

/** Adapter response preserving native width metadata or command output. */
const response = (exitCode: number, stdout = '', stderr = '') => ({
  exitCode,
  stdout,
  stderr,
  aborted: false,
});
describe('complete compound long profiles', () => {
  it('keeps 32 and 64 bit conversions distinct in each complete field list', () => {
    expect(validCompoundDecimal('shortlog-wrap', '-4294967220', 32)).toBe(true);
    expect(validCompoundDecimal('shortlog-wrap', '-4294967220', 64)).toBe(false);
    expect(validCompoundDecimal('shortlog-wrap', '-18446744073709551540', 32)).toBe(false);
    expect(validCompoundDecimal('shortlog-wrap', '-18446744073709551540', 64)).toBe(true);
    for (const longBits of [32, 64] as const) {
      expect(
        validCompoundDecimal('shortlog-wrap', '-4294967220,-18446744073709551610,9', longBits),
      ).toBe(false);
      expect(() =>
        commandArguments(
          'shortlog',
          [['-w', '-4294967220'], ['-w', '-18446744073709551540'], ['-h']],
          true,
          { longBits, sizeTBits: 64 },
        ),
      ).toThrow(GitArgumentError);
    }
  });
  it('delegates original argv when the selected executable cannot report widths', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(response(0, 'git version vendor\n'))
      .mockResolvedValueOnce(response(129, '', 'usage: git shortlog\n'));
    const env = { TYPE_GIT_COMPOUND_TEST: 'yes' };
    const signal = new AbortController().signal;
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'shortlog',
      [['-w', '-18446744073709551540'], ['-h']],
      true,
      { env, signal, stdin: 'original' },
    );
    expect(actual.exitCode).toBe(129);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    expect(adapters.exec.spawn.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        argv: ['git', 'version', '--build-options'],
        env: expect.objectContaining(env),
        signal,
      }),
    );
    expect(adapters.exec.spawn.mock.calls[0]![0].stdin).toBeUndefined();
    expect(adapters.exec.spawn.mock.calls[1]![0]).toEqual(
      expect.objectContaining({
        argv: ['git', 'shortlog', '-w-18446744073709551540', '-h'],
        stdin: 'original',
      }),
    );
  });
  it('uses reported LLP64 widths rather than the host or the corpus default', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(response(0, 'sizeof-long: 4\nsizeof-size_t: 8\n'))
      .mockResolvedValueOnce(response(129, '', 'usage: git shortlog\n'));
    await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'shortlog',
      [['-w', '-4294967220'], ['-h']],
      true,
    );
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
  });
  it('does not query widths for values after an audited help exit', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue(response(129, '', 'usage: git shortlog\n'));
    await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'shortlog',
      [['-h'], ['-w', '-4294967220']],
      true,
    );
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it('stops after an aborted width observation and preserves binary result shape', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue({ ...response(143), aborted: true });
    adapters.exec.spawnBytes = vi.fn();
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'shortlog',
      [['-w', '-4294967220'], ['-h']],
      true,
      { stdout: 'bytes' },
    );
    expect(actual.aborted).toBe(true);
    expect(actual.stdout).toEqual(new Uint8Array(0));
    expect(adapters.exec.spawnBytes).not.toHaveBeenCalled();
  });
  it('rejects a tuple requiring inconsistent widths before any observations', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn();
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'shortlog',
        [['-w', '-4294967220'], ['-w', '-18446744073709551540'], ['-h']],
        true,
      ),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
  it('observes negative overflow independently of width and executes the native mixed tuple', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(response(129, '', 'usage: git shortlog\n'))
      .mockResolvedValueOnce(response(0, 'sizeof-long: 4\nsizeof-size_t: 8\n'))
      .mockResolvedValueOnce(response(129, '', 'usage: git shortlog\n'));
    const value = '-4294967220,-18446744073709551610,9';
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'shortlog',
      [['-w', value], ['-h']],
      true,
      { stdin: 'original' },
    );
    expect(actual.exitCode).toBe(129);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(3);
    expect(adapters.exec.spawn.mock.calls[0]![0].argv).toEqual([
      'git',
      'shortlog',
      '-w2,-18446744073709551616,0',
      '-h',
    ]);
    expect(adapters.exec.spawn.mock.calls[0]![0].stdin).toBeUndefined();
    expect(adapters.exec.spawn.mock.calls[2]![0].stdin).toBe('original');
  });
  it('keeps standard negative overflow invalid rather than selecting a successful hypothetical profile', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValue(response(129, '', 'error: -w[<width>[,<indent1>[,<indent2>]]]'));
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'shortlog',
        [['-w', '-4294967220,-18446744073709551610,9'], ['-h']],
        true,
      ),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
  });
  it('delegates an unrecognized overflow observation to original native argv', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(response(129, '', 'erreur : valeur inconnue'))
      .mockResolvedValueOnce(response(129, '', 'native original failure'));
    const value = '-4294967220,-18446744073709551610,9';
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'shortlog',
      [['-w', value], ['-h']],
      true,
      { stdin: 'original' },
    );
    expect(actual.stderr).toBe('native original failure');
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(2);
    expect(adapters.exec.spawn.mock.calls[1]![0]).toEqual(
      expect.objectContaining({ argv: ['git', 'shortlog', `-w${value}`, '-h'], stdin: 'original' }),
    );
  });
  it('stops after an aborted overflow observation before querying widths or running the command', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue({ ...response(143), aborted: true });
    adapters.exec.spawnBytes = vi.fn();
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'shortlog',
      [['-w', '-4294967220,-18446744073709551610,9'], ['-h']],
      true,
      { stdout: 'bytes' },
    );
    expect(actual.aborted).toBe(true);
    expect(actual.stdout).toEqual(new Uint8Array(0));
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    expect(adapters.exec.spawnBytes).not.toHaveBeenCalled();
  });
  it('rejects representation errors before querying widths', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn();
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'shortlog',
        [['-w', '-4294967220'], ['-h'], { operand: 'bad\0word' }],
        true,
      ),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
});

describe('selected native compound callback results', () => {
  let cwd: string;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'type-git-compound-native-'));
    env = {
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
  });
  afterAll(async () => {
    await rm(cwd, { recursive: true, force: true });
  });
  for (const value of [
    '76',
    '-4294967220',
    '-18446744073709551540',
    '-4294967220,-18446744073709551610,9',
    '76\n',
    '1,-18446744073709551616,0',
    '2,-18446744073709551616,0',
    '2,18446744073709551616,0',
  ]) {
    it(`matches selected native -w ${JSON.stringify(value)} before help`, async () => {
      const native = spawnSync('git', ['shortlog', `-w${value}`, '-h'], {
        cwd,
        env,
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(native.error).toBeUndefined();
      expect(native.signal).toBeNull();
      if (value.includes('18446744073709551616')) {
        console.info(
          'Native compound overflow control',
          JSON.stringify({
            value,
            status: native.status,
            diagnostic: (native.stderr + native.stdout).split('\n')[0],
          }),
        );
      }
      const run = new CliRunner(createNodeAdapters()).runCommand(
        { type: 'worktree', workdir: cwd },
        'shortlog',
        [['-w', value], ['-h']],
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
        expect(native.status).toBe(129);
        expect(native.stderr).toContain('error:');
        try {
          const actual = await run;
          expect(actual.exitCode).toBe(native.status);
          expect(actual.stderr).toBe(native.stderr);
        } catch (error) {
          expect(error).toBeInstanceOf(GitArgumentError);
          expect((error as Error).message).not.toContain('Cannot determine integer widths');
        }
      }
    });
  }
});

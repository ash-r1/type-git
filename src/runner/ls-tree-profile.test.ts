import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

const result = (exitCode: number, stdout = '', stderr = '', aborted = false) => ({
  exitCode,
  stdout,
  stderr,
  aborted,
});
const usage = result(129, 'usage: git ls-tree\n');
const pairs = [
  ['--name-only', '--long'],
  ['--long', '--name-only'],
  ['--name-status', '--name-only'],
];
const modern = pairs.map(([second, first]) =>
  result(129, '', `error: options '${second}' and '${first}' cannot be used together\n`),
);
const args = [['--long'], ['--name-only'], ['-h']];
describe('selected ls-tree mode observation', () => {
  it('observes all mode pairs and retains env, signal and caller stdin boundaries', async () => {
    const a = createNodeAdapters();
    const spawn = vi.fn();
    for (const r of [usage, usage, usage, result(129, 'original help')]) {
      spawn.mockResolvedValueOnce(r);
    }
    a.exec.spawn = spawn;
    const signal = new AbortController().signal;
    const env = { LS_TREE_PROFILE_TEST: 'yes' };
    const actual = await new CliRunner(a).runCommand({ type: 'global' }, 'ls-tree', args, true, {
      env,
      signal,
      stdin: 'caller',
    });
    expect(actual.stdout).toBe('original help');
    expect(spawn).toHaveBeenCalledTimes(4);
    for (const call of spawn.mock.calls.slice(0, 3)) {
      expect(call[0]).toEqual(
        expect.objectContaining({ env: expect.objectContaining(env), signal }),
      );
      expect(call[0].stdin).toBeUndefined();
      expect(call[0].argv.at(-1)).toBe('-h');
    }
    expect(spawn.mock.calls[3]?.[0].stdin).toBe('caller');
  });
  it('observes the old family for a non-help listing before forwarding original argv', async () => {
    const a = createNodeAdapters();
    const spawn = vi.fn();
    for (const r of [usage, usage, usage, result(0, 'file\n')]) {
      spawn.mockResolvedValueOnce(r);
    }
    a.exec.spawn = spawn;
    const listingArgs = [['--long'], ['--name-only'], { operand: 'HEAD' }];
    const actual = await new CliRunner(a).runCommand(
      { type: 'global' },
      'ls-tree',
      listingArgs,
      true,
    );
    expect(actual.stdout).toBe('file\n');
    expect(spawn).toHaveBeenCalledTimes(4);
    expect(spawn.mock.calls[3]?.[0].argv.slice(-4)).toEqual([
      'ls-tree',
      '--long',
      '--name-only',
      'HEAD',
    ]);
  });
  it('retains observed modern reached mode conflicts', async () => {
    const a = createNodeAdapters();
    const spawn = vi.fn();
    for (const r of modern) {
      spawn.mockResolvedValueOnce(r);
    }
    a.exec.spawn = spawn;
    await expect(
      new CliRunner(a).runCommand({ type: 'global' }, 'ls-tree', args, true),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(spawn).toHaveBeenCalledTimes(3);
  });
  for (const observations of [
    [usage, usage, modern[2]],
    [result(128, '', 'fatal: not a git repository'), usage, usage],
    [result(129, '', 'erreur: modes'), usage, usage],
  ]) {
    it('delegates the original argv when the joint observations are unknown', async () => {
      const a = createNodeAdapters();
      const spawn = vi.fn();
      for (const r of [...observations, result(128, '', 'original native error')]) {
        spawn.mockResolvedValueOnce(r);
      }
      a.exec.spawn = spawn;
      const actual = await new CliRunner(a).runCommand({ type: 'global' }, 'ls-tree', args, true);
      expect(actual.stderr).toBe('original native error');
      expect(spawn).toHaveBeenCalledTimes(4);
      expect(spawn.mock.calls[3]?.[0].argv.slice(-4)).toEqual([
        'ls-tree',
        '--long',
        '--name-only',
        '-h',
      ]);
    });
  }
  it('propagates probe abortion with bytes output and runs no original command', async () => {
    const a = createNodeAdapters();
    const spawn = vi.fn().mockResolvedValueOnce(result(-1, '', '', true));
    a.exec.spawn = spawn;
    const actual = await new CliRunner(a).runCommand({ type: 'global' }, 'ls-tree', args, true, {
      stdout: 'bytes',
    });
    expect(actual.aborted).toBe(true);
    expect(actual.stdout).toEqual(new Uint8Array(0));
    expect(spawn).toHaveBeenCalledTimes(1);
  });
  it('validates representation before any native observation', async () => {
    const a = createNodeAdapters();
    const spawn = vi.fn();
    a.exec.spawn = spawn;
    await expect(
      new CliRunner(a).runCommand({ type: 'global' }, 'ls-tree', [...args, ['--long', true]], true),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(spawn).not.toHaveBeenCalled();
  });
});

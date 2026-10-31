import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

const response = (exitCode: number, stdout = '', stderr = '', aborted = false) => ({
  exitCode,
  stdout,
  stderr,
  aborted,
});
const usage = response(129, 'usage: git read-tree\n');
const legacy = [
  usage,
  usage,
  response(128, '', 'fatal: more than one --exclude-per-directory given.\n'),
];
const modern = [
  response(128, '', 'fatal: --exclude-per-directory is meaningless unless -u\n'),
  response(128, '', 'fatal: --exclude-per-directory argument must be .gitignore\n'),
  usage,
];
const args = [['--exclude-per-directory', 'other'], ['-h']];
describe('selected read-tree exclude callback observation', () => {
  it('observes all three axes with env/signal and no caller stdin', async () => {
    const a = createNodeAdapters();
    const spawn = vi.fn();
    for (const result of [...legacy, response(129, 'original help')]) {
      spawn.mockResolvedValueOnce(result);
    }
    a.exec.spawn = spawn;
    const env = { READ_TREE_PROFILE_TEST: 'yes' };
    const signal = new AbortController().signal;
    const result = await new CliRunner(a).runCommand({ type: 'global' }, 'read-tree', args, true, {
      env,
      signal,
      stdin: 'caller',
    });
    expect(result.stdout).toBe('original help');
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
  it('profiles a non-help callback and forwards the original dry-run payload', async () => {
    const a = createNodeAdapters();
    const spawn = vi.fn();
    for (const result of [...legacy, response(0)]) {
      spawn.mockResolvedValueOnce(result);
    }
    a.exec.spawn = spawn;
    const payload = [
      ['--dry-run'],
      ['--exclude-per-directory', 'other'],
      ['-m'],
      { operand: 'HEAD' },
      ['-u'],
    ];
    const result = await new CliRunner(a).runCommand(
      { type: 'global' },
      'read-tree',
      payload,
      true,
    );
    expect(result.exitCode).toBe(0);
    expect(spawn).toHaveBeenCalledTimes(4);
    expect(spawn.mock.calls[3]?.[0].argv).toEqual([
      'git',
      'read-tree',
      '--dry-run',
      '--exclude-per-directory=other',
      '-m',
      'HEAD',
      '-u',
    ]);
  });
  it('retains an observed modern prerequisite error', async () => {
    const a = createNodeAdapters();
    const spawn = vi.fn();
    for (const result of modern) {
      spawn.mockResolvedValueOnce(result);
    }
    a.exec.spawn = spawn;
    await expect(
      new CliRunner(a).runCommand({ type: 'global' }, 'read-tree', args, true),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(spawn).toHaveBeenCalledTimes(3);
  });
  for (const results of [
    [response(128, '', 'fatal: not a git repository'), usage, usage],
    [usage, usage, usage],
    [usage, usage, response(128, '', 'erreur: option repetee')],
  ]) {
    it('falls back to original argv for unknown or mixed observations', async () => {
      const a = createNodeAdapters();
      const spawn = vi.fn();
      for (const result of [...results, response(128, '', 'original failure')]) {
        spawn.mockResolvedValueOnce(result);
      }
      a.exec.spawn = spawn;
      const result = await new CliRunner(a).runCommand({ type: 'global' }, 'read-tree', args, true);
      expect(result.stderr).toBe('original failure');
      expect(spawn).toHaveBeenCalledTimes(4);
      expect(spawn.mock.calls[3]?.[0].argv).toEqual([
        'git',
        'read-tree',
        '--exclude-per-directory=other',
        '-h',
      ]);
    });
  }
  it('stops on an aborted second probe and preserves byte output mode', async () => {
    const a = createNodeAdapters();
    a.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce(usage)
      .mockResolvedValueOnce(response(130, '', 'aborted', true));
    const result = await new CliRunner(a).runCommand({ type: 'global' }, 'read-tree', args, true, {
      stdout: 'bytes',
    });
    expect(result.aborted).toBe(true);
    expect(result.stdout).toEqual(new Uint8Array(0));
    expect(a.exec.spawn).toHaveBeenCalledTimes(2);
  });
  it('does not spawn when already aborted', async () => {
    const a = createNodeAdapters();
    a.exec.spawn = vi.fn();
    const control = new AbortController();
    control.abort();
    const result = await new CliRunner(a).runCommand({ type: 'global' }, 'read-tree', args, true, {
      signal: control.signal,
    });
    expect(result.aborted).toBe(true);
    expect(a.exec.spawn).not.toHaveBeenCalled();
  });
  it('validates NUL/shape before observing Git', async () => {
    const a = createNodeAdapters();
    a.exec.spawn = vi.fn();
    for (const value of [true, '\0']) {
      await expect(
        new CliRunner(a).runCommand(
          { type: 'global' },
          'read-tree',
          [['--exclude-per-directory', value], ['-h']],
          true,
        ),
      ).rejects.toBeInstanceOf(GitArgumentError);
    }
    expect(a.exec.spawn).not.toHaveBeenCalled();
  });
});

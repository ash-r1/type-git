import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('retained revision initial parser phases', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  const native = (args: string[]) => {
    const result = spawnSync('git', ['-C', root, ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    return result;
  };
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-revision-initial-'));
    env = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] =>
            entry[1] !== undefined && !entry[0].toUpperCase().startsWith('GIT_'),
        ),
      ),
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      LC_ALL: 'C',
      GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
    };
    for (const args of [
      ['init', '-q'],
      ['config', 'user.name', 'Fixture'],
      ['config', 'user.email', 'fixture@example.invalid'],
    ]) {
      expect(native(args).status).toBe(0);
    }
    await writeFile(join(root, 'file'), 'base\n');
    expect(native(['add', 'file']).status).toBe(0);
    expect(native(['commit', '-qm', 'base']).status).toBe(0);
    await writeFile(join(root, 'file'), 'second\n');
    expect(native(['add', 'file']).status).toBe(0);
    expect(native(['commit', '-qm', 'second']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  it.each([
    'backfill',
    'last-modified',
    'replay',
  ] as const)('preserves help before retained callbacks for %s in both argv orders', async (command) => {
    for (const first of [false, true]) {
      const args = first ? [['-h'], ['--date', 'invalid']] : [['--date', 'invalid'], ['-h']];
      const words = first ? ['-h', '--date=invalid'] : ['--date=invalid', '-h'];
      const expected = native([command, ...words]);
      const actual = await repo.command(command, args as never);
      expect(actual.exitCode).toBe(expected.status);
      expect(actual.stdout).toBe(expected.stdout);
      expect(actual.stderr).toBe(expected.stderr);
    }
  }, 120_000);

  it.each([
    ['backfill', '--min-batch-size'],
    ['last-modified', '--max-depth'],
  ] as const)(
    'preserves immediate native %s %s callbacks relative to help',
    async (command, flag) => {
      for (const first of [false, true]) {
        const args = first ? [['-h'], [flag, 'invalid']] : [[flag, 'invalid'], ['-h']];
        const words = first ? ['-h', `${flag}=invalid`] : [`${flag}=invalid`, '-h'];
        const expected = native([command, ...words]);
        const outcome = await repo.command(command, args as never).then(
          (result) => ({ ok: true as const, value: result }),
          (error: unknown) => ({ ok: false as const, error }),
        );
        if (!outcome.ok) {
          expect(outcome.error).toBeInstanceOf(GitArgumentError);
          expect(expected.status).not.toBe(0);
          expect(first).toBe(false);
        } else {
          expect(outcome.value.exitCode).toBe(expected.status);
          expect(outcome.value.stdout).toBe(expected.stdout);
          expect(outcome.value.stderr).toBe(expected.stderr);
        }
      }
    },
    120_000,
  );

  it.each([
    'backfill',
    'last-modified',
    'replay',
  ] as const)('lets initial help preempt the unused separator for %s', async (command) => {
    const expected = native([command, '-h', '--', '--date=invalid']);
    const actual = await repo.command(command, [['-h'], ['--'], ['--date', 'invalid']] as never);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
  }, 120_000);

  it('keeps replay mode conflicts after the initial help pass', async () => {
    for (const first of [false, true]) {
      const args = first
        ? [['-h'], ['--onto', 'HEAD'], ['--advance', 'branch']]
        : [['--onto', 'HEAD'], ['--advance', 'branch'], ['-h']];
      const words = first
        ? ['-h', '--onto=HEAD', '--advance=branch']
        : ['--onto=HEAD', '--advance=branch', '-h'];
      const expected = native(['replay', ...words]);
      const actual = await repo.command('replay', args as never);
      expect(actual.exitCode).toBe(expected.status);
      expect(actual.stdout).toBe(expected.stdout);
      expect(actual.stderr).toBe(expected.stderr);
    }
  }, 120_000);

  it.each([
    'backfill',
    'last-modified',
    'replay',
  ] as const)('matches selected native direct date outcomes for %s', async (command) => {
    const prefix =
      command === 'replay'
        ? [
            ['--onto', 'HEAD'],
            ['--ref-action', 'print'],
          ]
        : [];
    const revision = command === 'replay' ? 'HEAD^..HEAD' : 'HEAD';
    for (const value of ['invalid', 'iso']) {
      const args = [...prefix, ['--date', value], { operand: revision }];
      const expected = native([
        command,
        ...prefix.map((a) => `${a[0]}=${a[1]}`),
        `--date=${value}`,
        revision,
      ]);
      if (expected.status === 128 && expected.stderr.includes('unknown date format')) {
        await expect(repo.command(command, args as never)).rejects.toBeInstanceOf(GitArgumentError);
      } else {
        const outcome = await repo.command(command, args as never).then(
          (result) => ({ ok: true as const, value: result }),
          (error: unknown) => ({ ok: false as const, error }),
        );
        if (!outcome.ok) {
          expect(outcome.error).toBeInstanceOf(GitArgumentError);
          expect(expected.status).not.toBe(0);
        } else {
          expect(outcome.value.exitCode).toBe(expected.status);
          expect(outcome.value.stdout).toBe(expected.stdout);
          expect(outcome.value.stderr).toBe(expected.stderr);
        }
      }
    }
  }, 120_000);

  it('retains backfill command-specific deferred diff semantics', async () => {
    const expected = native(['backfill', '--diff-merges=cc', 'HEAD']);
    expect(expected.status).not.toBe(0);
    await expect(
      repo.command('backfill', [['--diff-merges', 'cc'], { operand: 'HEAD' }] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  }, 120_000);
  it('preserves integer number representation checks only before reached callbacks', async () => {
    const large = 9007199254740992;
    for (const help of [false, true]) {
      const args = [
        ['--min-batch-size', large],
        ['--min-batch-size', 1],
        ...(help ? [['-h']] : []),
      ];
      await expect(repo.command('backfill', args as never)).rejects.toBeInstanceOf(
        GitArgumentError,
      );
    }
    for (const value of [String(large), BigInt(large)]) {
      const expected = native([
        'backfill',
        `--min-batch-size=${value}`,
        '--min-batch-size=1',
        '-h',
      ]);
      const actual = await repo.command('backfill', [
        ['--min-batch-size', value],
        ['--min-batch-size', 1],
        ['-h'],
      ] as never);
      expect(actual.exitCode).toBe(expected.status);
      expect(actual.stdout).toBe(expected.stdout);
      expect(actual.stderr).toBe(expected.stderr);
    }
    // An exact string before help must not acquire a later ignored number's representation.
    for (const first of [false, true]) {
      const args = first
        ? [['-h'], ['--min-batch-size', large]]
        : [['--min-batch-size', String(large)], ['-h'], ['--min-batch-size', large]];
      const words = first
        ? ['-h', `--min-batch-size=${large}`]
        : [`--min-batch-size=${large}`, '-h', `--min-batch-size=${large}`];
      const expected = native(['backfill', ...words]);
      const actual = await repo.command('backfill', args as never);
      expect(actual.exitCode).toBe(expected.status);
      expect(actual.stdout).toBe(expected.stdout);
      expect(actual.stderr).toBe(expected.stderr);
    }
  }, 120_000);
});

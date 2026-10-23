import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import type { GitCommandName } from './types.js';

const commands: readonly [GitCommandName, readonly string[]][] = [
  ['log', ['HEAD']],
  ['show', ['HEAD']],
  ['rev-list', ['HEAD']],
  ['whatchanged', ['HEAD']],
  ['shortlog', ['HEAD']],
  ['reflog', ['HEAD']],
  ['reflog show', ['HEAD']],
  ['format-patch', ['--stdout', 'HEAD']],
  ['diff', []],
  ['diff-files', []],
  ['diff-tree', ['HEAD']],
  ['blame', ['HEAD', '--', 'file']],
  ['annotate', ['HEAD', '--', 'file']],
  ['fast-export', ['HEAD']],
  ['stash show', []],
  ['last-modified', ['HEAD', '--', 'file']],
  ['pickaxe', ['HEAD', '--', 'file']],
];

describe('revision count shorthand', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  const native = (args: readonly string[], workdir = root) => {
    const result = spawnSync('git', ['-C', workdir, ...args], {
      env,
      input: '',
      encoding: 'utf8',
      // Bound one native invocation within the 120-second multi-process case budget.
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    return result;
  };
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-revision-count-'));
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
      GIT_PAGER: 'cat',
      PAGER: 'cat',
      GIT_TERMINAL_PROMPT: '0',
      GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
      GIT_EDITOR: 'true',
      GIT_SEQUENCE_EDITOR: 'true',
    };
    for (const args of [
      ['init'],
      ['config', 'user.name', 'Fixture'],
      ['config', 'user.email', 'fixture@example.invalid'],
    ]) {
      expect(native(args).status).toBe(0);
    }
    await writeFile(join(root, 'file'), 'one\n');
    expect(native(['add', 'file']).status).toBe(0);
    expect(native(['commit', '-m', 'fixture']).status).toBe(0);
    await writeFile(join(root, 'file'), 'two\n');
    expect(native(['stash', 'push', '-m', 'fixture stash']).status).toBe(0);
    expect(native(['branch', 'baseline']).status).toBe(0);
    expect(native(['checkout', '-qb', 'side']).status).toBe(0);
    await writeFile(join(root, 'sidefile'), 'side\n');
    expect(native(['add', 'sidefile']).status).toBe(0);
    expect(native(['commit', '-m', 'side']).status).toBe(0);
    expect(native(['checkout', '-q', 'baseline']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.each(commands)(
    'preserves native digit counts for %s',
    async (command, suffix) => {
      for (const count of ['-0', '-3', '-01', '-2147483647']) {
        const expected = native([...command.split(' '), count, ...suffix]);
        expect([0, 1, 128, 129]).toContain(expected.status);
        if (expected.status !== 0) {
          // Actual executable availability and semantic failures remain native failures.
          expect(expected.stdout + expected.stderr).not.toBe('');
        }
        const args = [
          [count],
          ...suffix.map((word) =>
            word === '--' || word === '--stdout' ? [word] : { operand: word },
          ),
        ];
        if (command === 'diff-files' && expected.status === 129) {
          // diff-files rejects a final parsed count above3 before running its diff.
          expect(expected.stderr).toContain('usage: git diff-files');
          await expect(repo.command(command, args as never)).rejects.toBeInstanceOf(
            GitArgumentError,
          );
          continue;
        }
        const actual = await repo.command(command, args as never);
        expect(actual.exitCode).toBe(expected.status);
        expect(actual.stdout).toBe(expected.stdout);
        expect(actual.stderr).toBe(expected.stderr);
      }
    },
    120_000,
  );

  it.each([
    ['cherry-pick', ['baseline..side']],
    ['revert', ['baseline']],
    ['replay', ['--onto', 'baseline', 'baseline..side']],
    ['backfill', []],
  ] as const)(
    'matches native counts for %s in fresh independent repository copies',
    async (command, suffix) => {
      for (const count of ['-0', '-1', '-3']) {
        const copies = await mkdtemp(join(tmpdir(), 'type-git-count-copies-'));
        try {
          const nativeRoot = join(copies, 'native');
          const actualRoot = join(copies, 'actual');
          await cp(root, nativeRoot, { recursive: true });
          await cp(root, actualRoot, { recursive: true });
          const expected = native([command, count, ...suffix], nativeRoot);
          expect([0, 1, 128]).toContain(expected.status);
          // Older replay can return 1 silently for an empty commit set.
          // Preserve the exact native failure and both streams below.
          const actualRepo = await new TypeGit({ home: root, inheritEnv: false, env }).open(
            actualRoot,
          );
          const args = [
            [count],
            ...(command === 'replay'
              ? [['--onto', 'baseline'], { operand: 'baseline..side' }]
              : suffix.map((word) => ({ operand: word }))),
          ];
          const actual = await actualRepo.command(command, args as never);
          expect(actual.exitCode).toBe(expected.status);
          expect(actual.stdout).toBe(expected.stdout);
          expect(actual.stderr).toBe(expected.stderr);
        } finally {
          await rm(copies, { recursive: true, force: true });
        }
      }
    },
    120_000,
  );

  it('preserves the selected Git deprecation prerequisite with and without explicit opt-in', async () => {
    for (const optIn of [false, true]) {
      const words = [...(optIn ? ['--i-still-use-this'] : []), 'HEAD'];
      const expected = native(['whatchanged', ...words]);
      expect([0, 128]).toContain(expected.status);
      if (expected.status === 128) {
        expect(expected.stderr).not.toBe('');
      }
      const actual = await repo.command('whatchanged', [
        ...(optIn ? [['--i-still-use-this']] : []),
        { operand: 'HEAD' },
      ] as never);
      expect(actual.exitCode).toBe(expected.status);
      expect(actual.stdout).toBe(expected.stdout);
      expect(actual.stderr).toBe(expected.stderr);
    }
  });

  it.each([
    ['log', ['-2147483648', '-h']],
    ['log', ['-h', '-2147483648']],
    ['shortlog', ['-h', '-2147483648']],
  ] as const)('retains documentation exit ordering for %s', async (command, words) => {
    const expected = native([command, ...words]);
    expect([0, 129]).toContain(expected.status);
    expect(expected.stdout + expected.stderr).toContain('usage:');
    const actual = await repo.command(command, words.map((word) => [word]) as never);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
  });

  it('rejects shortlog overflow that precedes its help exit', async () => {
    const expected = native(['shortlog', '-2147483648', '-h']);
    expect(expected.status).toBe(128);
    await expect(
      repo.command('shortlog', [['-2147483648'], ['-h']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });

  it.each([
    [['-3'], ['--max-count', '0']],
    [['--max-count', '0'], ['-3']],
  ] as const)('retains overwrite order with named counts: %j', async (...tokens) => {
    const words = tokens.flatMap(([flag, value]) =>
      value === undefined ? [flag] : [`${flag}=${value}`],
    );
    const expected = native(['log', ...words, 'HEAD']);
    expect(expected.status).toBe(0);
    const actual = await repo.command('log', [...tokens, { operand: 'HEAD' }] as never);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
  });

  it('keeps numeric path operands behind a separator outside the count parser', async () => {
    const expected = native(['log', 'HEAD', '--', '-2147483648']);
    expect(expected.status).toBe(0);
    const actual = await repo.command('log', [
      { operand: 'HEAD' },
      ['--'],
      { operand: '-2147483648' },
    ] as never);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
  });

  it('checks decimal overflow even when the selected Git uses legacy atoi for named counts', async () => {
    const expected = native(['log', '-2147483648', 'HEAD']);
    expect(expected.status).toBe(128);
    expect(expected.stderr).toMatch(/not (?:an integer|a non-negative integer)/);
    await expect(
      repo.command('log', [['-2147483648'], { operand: 'HEAD' }] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });
});

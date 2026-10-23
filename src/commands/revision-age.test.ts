import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

const VALUES = [
  '',
  ' ',
  '0',
  '1',
  '-1',
  '+1',
  '01',
  ' \t+1',
  '1\n',
  '1x',
  '0x10',
  '4294967295',
  '2147483648',
  '-2147483648',
  '18446744073709551615',
  '-18446744073709551615',
  '18446744073709551616',
  '-18446744073709551616',
  '-0',
];

describe('selected native revision timestamp callback', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  const native = (words: readonly string[]) => {
    const result = spawnSync('git', ['-C', root, ...words], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).not.toBeNull();
    return result;
  };
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-revision-age-'));
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
      GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
    };
    for (const words of [
      ['init', '-q'],
      ['config', 'user.name', 'Fixture'],
      ['config', 'user.email', 'fixture@example.invalid'],
    ]) {
      expect(native(words).status).toBe(0);
    }
    await writeFile(join(root, 'file'), 'base\n');
    expect(native(['add', 'file']).status).toBe(0);
    expect(native(['commit', '-qm', 'fixture']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  it.each([
    ['log', '--min-age'],
    ['log', '--max-age'],
    ['diff-index', '--min-age'],
    ['diff-index', '--max-age'],
  ] as const)(
    'matches native %s %s including legacy acceptance and modern rejection',
    async (command, flag) => {
      for (const value of VALUES) {
        const expected = native([command, `${flag}=${value}`, 'HEAD']);
        const args = [[flag, value], { operand: 'HEAD' }];
        if (
          expected.status === 128 &&
          expected.stderr.includes('not a number of seconds since epoch')
        ) {
          await expect(repo.command(command, args as never)).rejects.toBeInstanceOf(
            GitArgumentError,
          );
        } else if (command === 'diff-index' && expected.status === 129) {
          // Parsed non-default age filters are forbidden by diff-index's final state check.
          expect(expected.stderr).toContain('usage: git diff-index');
          await expect(repo.command(command, args as never)).rejects.toBeInstanceOf(
            GitArgumentError,
          );
        } else {
          const actual = await repo.command(command, args as never);
          expect(actual.exitCode, `${flag}=${JSON.stringify(value)}`).toBe(expected.status);
          expect(actual.stdout).toBe(expected.stdout);
          expect(actual.stderr).toBe(expected.stderr);
        }
      }
    },
    120_000,
  );

  it.each([
    ['log', ['--max-age=invalid', '-h'], [['--max-age', 'invalid'], ['-h']]],
    ['log', ['-h', '--max-age=invalid'], [['-h'], ['--max-age', 'invalid']]],
    ['rev-list', ['--max-age=invalid', '-h'], [['--max-age', 'invalid'], ['-h']]],
    [
      'rev-list',
      ['--max-age=18446744073709551616', '--max-age=-1', 'HEAD'],
      [['--max-age', '18446744073709551616'], ['--max-age', '-1'], { operand: 'HEAD' }],
    ],
  ] as const)(
    'retains help and immediate-error order for %s: %j',
    async (command, words, args) => {
      const expected = native([command, ...words]);
      if (
        expected.status === 128 &&
        expected.stderr.includes('not a number of seconds since epoch')
      ) {
        await expect(repo.command(command, args as never)).rejects.toBeInstanceOf(GitArgumentError);
      } else {
        const actual = await repo.command(command, args as never);
        expect(actual.exitCode).toBe(expected.status);
        expect(actual.stdout).toBe(expected.stdout);
        expect(actual.stderr).toBe(expected.stderr);
      }
    },
    120_000,
  );
});

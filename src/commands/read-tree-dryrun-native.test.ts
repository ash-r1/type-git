import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError, type RawResult } from '../core/types.js';

describe('read-tree exclude callbacks in dry-run payloads', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-read-tree-help-'));
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
    await writeFile(join(root, '--help'), 'base\n');
    expect(native(['add', '--', 'file', '--help']).status).toBe(0);
    expect(native(['commit', '-qm', 'base']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  it('matches native success and rejects invalid callback families without changing index/file/HEAD bytes', async () => {
    const paths = ['.git/index', 'file', '.git/HEAD'];
    const snapshot = () => Promise.all(paths.map((path) => readFile(join(root, path))));
    const before = await snapshot();
    for (const value of ['.gitignore', 'other-ignore', '']) {
      const exclude = ['--exclude-per-directory', value];
      for (const args of [
        [['--dry-run'], exclude, ['-u'], ['-m'], { operand: 'HEAD' }],
        [['--dry-run'], ['-u'], exclude, ['-m'], { operand: 'HEAD' }],
        [['--dry-run'], exclude, ['-m'], { operand: 'HEAD' }],
        [
          ['--dry-run'],
          ['-u'],
          exclude,
          ['--exclude-per-directory', '.gitignore'],
          ['-m'],
          { operand: 'HEAD' },
        ],
        [['--dry-run'], exclude, ['-m'], { operand: 'HEAD' }, ['-u']],
        [['--dry-run'], ['-u'], exclude, ['--reset'], { operand: 'HEAD' }],
      ]) {
        const words = args.map((arg) =>
          Array.isArray(arg)
            ? arg.length === 1
              ? arg[0]
              : `${arg[0]}=${arg[1]}`
            : (arg as { operand: string }).operand,
        );
        const expected = native(['read-tree', ...words]);
        expect(await snapshot()).toEqual(before);
        let actual: RawResult | undefined;
        try {
          actual = await repo.command('read-tree', args as never);
        } catch (error) {
          expect(error).toBeInstanceOf(GitArgumentError);
          expect(expected.status).not.toBe(0);
        }
        if (actual) {
          expect(actual.exitCode).toBe(expected.status);
          expect(actual.stdout).toBe(expected.stdout);
          expect(actual.stderr).toBe(expected.stderr);
        }
        expect(await snapshot()).toEqual(before);
      }
    }
  }, 120_000);
});

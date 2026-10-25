import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('merge-ours internal help and callback order', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-merge-ours-help-'));
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

  const compare = async (args: readonly unknown[], words: string[]) => {
    const paths = ['.git/index', 'file', '.git/HEAD'];
    const snapshot = () => Promise.all(paths.map((path) => readFile(join(root, path))));
    const before = await snapshot();
    const expected = native(['merge-ours', ...words]);
    expect(await snapshot()).toEqual(before);
    const actual = await repo.command('merge-ours', args as never);
    expect(await snapshot()).toEqual(before);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  it('matches clean and staged index outcomes without performing a merge', async () => {
    const cases: Array<{ args: readonly unknown[]; words: string[]; ignored: boolean }> = [
      { args: [], words: [], ignored: true },
      { args: [['--help-all']], words: ['--help-all'], ignored: false },
      { args: [['-h']], words: ['-h'], ignored: false },
      {
        args: [['--help-all'], { operand: 'ignored' }],
        words: ['--help-all', 'ignored'],
        ignored: true,
      },
      {
        args: [{ operand: '--git-completion-helper' }],
        words: ['--git-completion-helper'],
        ignored: true,
      },
      { args: [{ operand: '--not-a-real-option' }], words: ['--not-a-real-option'], ignored: true },
      {
        args: [{ operand: 'base' }, { operand: '--' }, { operand: 'HEAD' }, { operand: 'remote' }],
        words: ['base', '--', 'HEAD', 'remote'],
        ignored: true,
      },
      {
        args: [{ operand: 'HEAD' }, { operand: '--help' }],
        words: ['HEAD', '--help'],
        ignored: true,
      },
    ];
    for (const staged of [false, true]) {
      if (staged) {
        await writeFile(join(root, 'file'), 'staged-change\n');
        expect(native(['add', 'file']).status).toBe(0);
      }
      for (const test of cases) {
        const result = await compare(test.args, test.words);
        if (test.ignored) {
          expect(result.status).toBe(staged ? 2 : 0);
          expect(result.stdout).toBe('');
          expect(result.stderr).toBe('');
        }
      }
    }
  });
  it('preserves a tagged separator while rejecting a separator option tuple', async () => {
    await compare([{ operand: '--' }], ['--']);
    await expect(repo.command('merge-ours', [['--']] as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
  });
});

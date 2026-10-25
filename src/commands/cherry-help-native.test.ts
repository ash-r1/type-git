import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('cherry internal help and callback order', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-cherry-help-'));
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
    const expected = native(['cherry', ...words]);
    expect(await snapshot()).toEqual(before);
    const actual = await repo.command('cherry', args as never);
    expect(await snapshot()).toEqual(before);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  it('matches ordered help and completion with selected native exit codes', async () => {
    for (const flag of [
      '-h',
      '--help-all',
      '--git-completion-helper',
      '--git-completion-helper-all',
    ]) {
      await compare([[flag]], [flag]);
    }
    await compare([['--verbose'], ['--help']], ['--verbose', '--help']);
    await compare(
      [['--help-all'], ['--git-completion-helper']],
      ['--help-all', '--git-completion-helper'],
    );
    await compare(
      [{ operand: 'missing-commit' }, ['--help-all']],
      ['missing-commit', '--help-all'],
    );
  });
  it('matches abbreviation callback order without hiding reached errors', async () => {
    await compare([['--abbrev', '-1'], ['--help-all']], ['--abbrev=-1', '--help-all']);
    await compare([['--help-all'], ['--abbrev', 'bad']], ['--help-all', '--abbrev=bad']);
    for (const value of ['bad', '--help-all']) {
      await expect(
        repo.command('cherry', [['--abbrev', value], ['--help-all']] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
      const result = native(['cherry', `--abbrev=${value}`, '--help-all']);
      expect(result.status).toBe(129);
      expect(result.stderr).toContain('numerical value');
    }
  });
  it('retains end-of-options literals and reached completion errors', async () => {
    await compare([['--'], { operand: '--help-all' }], ['--', '--help-all']);
    await expect(repo.command('cherry', [['--'], ['--help-all']] as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await expect(
      repo.command('cherry', [['--git-completion-helper'], ['--help-all']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(native(['cherry', '--git-completion-helper', '--help-all']).status).toBe(129);
  });
  it('preserves the local identical-upstream success control', async () => {
    const result = await compare(
      [['--verbose'], { operand: 'HEAD' }, { operand: 'HEAD' }],
      ['--verbose', 'HEAD', 'HEAD'],
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});

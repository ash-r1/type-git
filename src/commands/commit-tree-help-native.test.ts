import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('commit-tree internal help and callback order', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-commit-tree-help-'));
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
    const expected = native(['commit-tree', ...words]);
    expect(await snapshot()).toEqual(before);
    const actual = await repo.command('commit-tree', args as never);
    expect(await snapshot()).toEqual(before);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  it('matches native help and completion without generating commits', async () => {
    for (const flag of [
      '-h',
      '--help-all',
      '--git-completion-helper',
      '--git-completion-helper-all',
    ]) {
      await compare([[flag]], [flag]);
    }
    await compare([['-m', 'message'], ['--help']], ['-m', 'message', '--help']);
    await compare(
      [['--help-all'], ['--git-completion-helper']],
      ['--help-all', '--git-completion-helper'],
    );
  });
  it('preserves parent resolution before help and skips it afterward', async () => {
    const failed = await compare(
      [['-p', 'missing-parent'], ['--help-all']],
      ['-p', 'missing-parent', '--help-all'],
    );
    expect(failed.status).toBe(128);
    await compare(
      [['--help-all'], ['-p', 'missing-parent']],
      ['--help-all', '-p', 'missing-parent'],
    );
    await compare([['-p', 'HEAD'], ['--help-all']], ['-p', 'HEAD', '--help-all']);
  });
  it('preserves file reads before help and skips missing files afterward', async () => {
    const missing = join(root, 'missing-message');
    const failed = await compare([['-F', missing], ['--help-all']], ['-F', missing, '--help-all']);
    expect(failed.status).toBe(128);
    await compare([['--help-all'], ['-F', missing]], ['--help-all', '-F', missing]);
    await compare(
      [['-F', join(root, 'file')], ['--help-all']],
      ['-F', join(root, 'file'), '--help-all'],
    );
  });
  it('keeps consumed message values, literal operands and reached completion errors', async () => {
    await expect(
      repo.command('commit-tree', [['-m', '--help-all']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(native(['commit-tree', '-m', '--help-all']).status).toBe(128);
    await compare([['--'], { operand: '--help-all' }], ['--', '--help-all']);
    await expect(
      repo.command('commit-tree', [['--'], ['--help-all']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    await expect(
      repo.command('commit-tree', [['--git-completion-helper'], ['--help-all']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(native(['commit-tree', '--git-completion-helper', '--help-all']).status).toBe(129);
  });
});

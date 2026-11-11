/**
 * strict(): grammar-checked command() on top of lightweight clients and repositories
 */

import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNodeAdapters, TypeGit } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { createGitSync } from '../impl/git-impl.js';
import { strict } from './index.js';

describe('strict()', () => {
  let root: string;
  const env = {
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
  };

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'type-git-strict-')));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('adds command() to clients, worktree repositories, and bare repositories', async () => {
    const git = new TypeGit({ inheritEnv: true, env });
    const repo = strict(await git.init(join(root, 'repo')));
    const bare = strict(await git.init(join(root, 'bare.git'), { bare: true }));
    const factory = strict(
      createGitSync({ adapters: createNodeAdapters(), inheritEnv: true, env }),
    );

    expect('command' in repo).toBe(true);
    expect((await strict(git).command('version', [])).stdout).toMatch(/^git version /);
    expect((await factory.command('version', [])).stdout).toMatch(/^git version /);

    await writeFile(join(repo.workdir, 'file.txt'), 'content\n');
    const stored = await repo.command('hash-object', [['-w'], { operand: 'file.txt' }]);
    expect(stored.exitCode).toBe(0);
    const oid = stored.stdout.trim();
    expect((await repo.command('cat-file', [['-t'], { operand: oid }])).stdout.trim()).toBe('blob');

    const bareStored = await bare.command('hash-object', [['-w'], ['--stdin']], { stdin: 'x\n' });
    expect(bareStored.exitCode).toBe(0);
    expect(bareStored.stdout.trim()).toMatch(/^[0-9a-f]{40,64}$/);
  });

  it('keeps every original member and reaches the original object', async () => {
    const git = new TypeGit({ inheritEnv: true, env });
    const plain = await git.init(join(root, 'repo'));
    const repo = strict(plain);

    expect(repo.workdir).toBe(plain.workdir);
    expect(repo.kind).toBe('worktree');
    expect(await repo.status()).toEqual(await plain.status());
    await writeFile(join(repo.workdir, 'a.txt'), 'a\n');
    await repo.add('a.txt');
    expect((await plain.status()).entries.map((entry) => entry.path)).toEqual(['a.txt']);
  });

  it('keeps the grammar checks of command()', async () => {
    const repo = strict(await new TypeGit({ inheritEnv: true, env }).init(join(root, 'repo')));
    await expect(repo.command('log', [['--no-such-option']] as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await expect(
      repo.command('hash-object', [{ operand: '--stdin' }] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });

  it('rejects objects not created by type-git', () => {
    expect(() => strict({} as never)).toThrow(GitArgumentError);
    expect(() => strict(null as never)).toThrow(GitArgumentError);
  });
});

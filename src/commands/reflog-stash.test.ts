import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';
describe('reflog operations and stash diff delegation', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-reflog-stash-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'global'),
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await repo.add('tracked');
    await repo.commit({ message: 'initial' });
    await writeFile(join(repo.workdir, 'tracked'), 'two\n');
    expect((await repo.command('stash push', [['--message', 'saved']])).exitCode).toBe(0);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const direct = (args: string[]) =>
    spawnSync('git', ['-C', repo.workdir, ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });

  it('initializes reflog traversal before user options and preserves XOR ordering', async () => {
    expect((await repo.command('reflog show', [['--grep-reflog', 'initial']])).stdout).toContain(
      'initial',
    );
    expect((await repo.command('reflog show', [['--reverse'], ['--reverse']])).exitCode).toBe(0);
    for (const flag of ['--graph', '--reverse', '--children']) {
      expect(direct(['reflog', 'show', flag]).status).not.toBe(0);
      expect(() => commandArguments('reflog show', [[flag]])).toThrow(GitArgumentError);
    }
  });
  it('accepts ignored extra exists operands and independent expire selections', async () => {
    expect((await repo.command('reflog exists', [{ operand: 'HEAD' }])).exitCode).toBe(0);
    const extra = direct(['reflog', 'exists', 'HEAD', 'ignored-extra']);
    if (legacy) {
      expect(extra.status).not.toBe(0);
    } else {
      expect(extra.status).toBe(0);
      expect(
        (await repo.command('reflog exists', [{ operand: 'HEAD' }, { operand: 'ignored-extra' }]))
          .exitCode,
      ).toBe(0);
    }
    expect(() => commandArguments('reflog exists', [])).toThrow(GitArgumentError);
    expect(direct(['reflog', 'exists']).status).not.toBe(0);
    for (const args of [[], ['--single-worktree'], ['--all', 'HEAD']]) {
      expect(direct(['reflog', 'expire', '--dry-run', ...args]).status).toBe(0);
    }
    expect(
      (await repo.command('reflog expire', [['--dry-run'], ['--single-worktree']])).exitCode,
    ).toBe(0);
    expect(
      (await repo.command('reflog expire', [['--dry-run'], ['--all'], { operand: 'HEAD' }]))
        .exitCode,
    ).toBe(0);
    expect(
      (await repo.command('reflog delete', [['--dry-run'], { operand: 'HEAD@{0}' }])).exitCode,
    ).toBe(0);
    expect(() => commandArguments('reflog delete', [])).toThrow(GitArgumentError);
  });
  it.skipIf(legacy)('executes list, write and drop and checks their distinct arities', async () => {
    const oid = direct(['rev-parse', 'HEAD']).stdout.trim();
    expect(direct(['update-ref', '--create-reflog', 'refs/heads/temporary', oid]).status).toBe(0);
    expect((await repo.command('reflog list', [])).stdout).toContain('refs/heads/temporary');
    expect(
      (
        await repo.command('reflog write', [
          { operand: 'refs/heads/temporary' },
          { operand: oid },
          { operand: oid },
          { operand: 'recorded' },
        ])
      ).exitCode,
    ).toBe(0);
    expect(direct(['reflog', 'show', 'refs/heads/temporary']).stdout).toContain('recorded');
    expect(() => commandArguments('reflog list', [{ operand: 'HEAD' }])).toThrow(GitArgumentError);
    expect(direct(['reflog', 'list', 'HEAD']).status).not.toBe(0);
    expect(() => commandArguments('reflog write', [{ operand: 'HEAD' }])).toThrow(GitArgumentError);
    expect(direct(['reflog', 'write', 'HEAD']).status).not.toBe(0);
    expect(() =>
      commandArguments('reflog drop', [['--all'], { operand: 'refs/heads/temporary' }]),
    ).toThrow(GitArgumentError);
    expect(direct(['reflog', 'drop', '--all', 'refs/heads/temporary']).status).not.toBe(0);
    expect((await repo.command('reflog drop', [])).exitCode).toBe(0);
    expect(
      (await repo.command('reflog drop', [{ operand: 'refs/heads/temporary' }])).exitCode,
    ).toBe(0);
    expect(direct(['reflog', 'exists', 'refs/heads/temporary']).status).toBe(1);
  });
  it('attaches short option values before stash separates revision options and operands', async () => {
    expect(commandArguments('stash show', [['-S', 'two'], ['-n', 1], ['-p']])).toEqual([
      'stash',
      'show',
      '-Stwo',
      '-n1',
      '-p',
    ]);
    const result = await repo.command('stash show', [['-S', 'two'], ['-n', 1], ['-p']]);
    const actual = direct(['stash', 'show', '-Stwo', '-n1', '-p']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(actual.stdout);
    expect((await repo.command('stash show', [['-p']])).stdout).toContain('+two');
    expect(direct(['stash', 'show', '-S', 'two', '-p']).status).not.toBe(0);
    expect(() =>
      commandArguments('stash show', [{ operand: 'stash@{0}' }, { operand: 'stash@{0}' }]),
    ).toThrow(GitArgumentError);
    expect(direct(['stash', 'show', 'stash@{0}', 'stash@{0}']).status).not.toBe(0);
    expect(() => commandArguments('stash show', [['--default', 'stash@{0}']])).toThrow(
      GitArgumentError,
    );
    expect(direct(['stash', 'show', '--default', 'stash@{0}']).status).not.toBe(0);
  });
});

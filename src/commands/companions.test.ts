import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createNodeAdapters, TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { createGitSync } from '../impl/git-impl.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

const available = !spawnSync('scalar', ['version'], { encoding: 'utf8' }).error;
describe.skipIf(!available)('scalar native grammar and routing', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-scalar-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_GLOBAL: join(root, 'global'),
      GIT_CONFIG_NOSYSTEM: '1',
    };
    await writeFile(join(root, 'global'), '[scalar]\n\trepo = /fixture\n');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const compare = (
    command: GitCommandName,
    args: readonly unknown[],
    words: string[],
    valid: boolean,
  ) => {
    const actual = spawnSync(
      'scalar',
      ['-C', repo.workdir, ...command.split(' ').slice(1), ...words],
      { env, encoding: 'utf8', timeout: 10000 },
    );
    const label = `${command} ${words.join(' ')}: ${actual.stderr}`;
    expect(actual.error, label).toBeUndefined();
    expect(actual.signal, label).toBe(null);
    expect(actual.status === 0, label).toBe(valid);
    const build = () => commandArguments(command, args, true);
    if (valid) {
      expect(build()).toEqual([...command.split(' '), ...words]);
    } else {
      expect(build, label).toThrow(GitArgumentError);
    }
  };
  it('executes real scalar instead of a nonexistent git subcommand', async () => {
    const result = await repo.command('scalar version', [['--build-options']]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('git version');
    const dispatched = await repo.command('scalar', [{ operand: 'version' }, ['--build-options']]);
    expect(dispatched.exitCode).toBe(0);
    expect(dispatched.stderr).toBe(result.stderr);
    compare('scalar list', [], [], true);
    compare('scalar list', [{ operand: 'extra' }], ['extra'], false);
    compare('scalar version', [{ operand: 'extra' }], ['extra'], false);
  });
  it('checks all scalar operation arities without cloning, deleting or scheduling', () => {
    compare('scalar', [], [], false);
    compare('scalar', [{ operand: 'unknown' }], ['unknown'], false);
    compare('scalar clone', [], [], false);
    compare('scalar delete', [], [], false);
    compare('scalar run', [{ operand: 'unknown' }], ['unknown'], false);
    for (const operation of ['diagnose', 'register', 'unregister']) {
      compare(
        `scalar ${operation}` as GitCommandName,
        [{ operand: 'one' }, { operand: 'two' }],
        ['one', 'two'],
        false,
      );
    }
    compare('scalar help', [{ operand: 'extra' }], ['extra'], false);
  });
  it('checks final maintenance selection only in the all branch', () => {
    compare('scalar reconfigure', [['--maintenance', 'invalid']], ['--maintenance=invalid'], true);
    compare(
      'scalar reconfigure',
      [['--all'], ['--maintenance', 'invalid']],
      ['--all', '--maintenance=invalid'],
      false,
    );
    compare('scalar reconfigure', [['--all'], { operand: 'one' }], ['--all', 'one'], false);
    // No configured enlistments remain: all mode performs no maintenance work.
    expect(
      spawnSync('git', ['config', '--file', join(root, 'global'), '--unset-all', 'scalar.repo'], {
        env,
      }).status,
    ).toBe(0);
    compare(
      'scalar reconfigure',
      [['--all'], ['--maintenance', 'invalid'], ['--maintenance', 'keep']],
      ['--all', '--maintenance=invalid', '--maintenance=keep'],
      true,
    );
  });
});

describe('GUI and CGI executable selection', () => {
  it('routes configured programs without launching a window or server', async () => {
    const adapters = createNodeAdapters();
    const spawn = vi
      .spyOn(adapters.exec, 'spawn')
      .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, aborted: false });
    const git = createGitSync({
      adapters,
      companionBinaries: { gitk: '/fixture/gitk', gitweb: '/fixture/gitweb.cgi' },
    });
    await git.command('gitk', [
      ['--select-commit', 'HEAD'],
      { operand: '--all' },
      ['--'],
      { operand: 'path' },
    ]);
    expect(spawn).toHaveBeenLastCalledWith(
      expect.objectContaining({
        argv: ['/fixture/gitk', '--select-commit=HEAD', '--all', '--', 'path'],
      }),
      undefined,
    );
    await git.command('gitweb', [['--nproc', 2]]);
    expect(spawn).toHaveBeenLastCalledWith(
      expect.objectContaining({ argv: ['/fixture/gitweb.cgi', '--nproc=2'] }),
      undefined,
    );
  });
});

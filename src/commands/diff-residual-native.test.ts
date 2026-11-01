import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';

describe('selected Git diff residual dispatch and raw-word scans', () => {
  let root: string;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-diff-residual-'));
    env = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('GIT_')),
      ),
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'global'),
      LC_ALL: 'C',
      GIT_PAGER: 'cat',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    await writeFile(join(root, 'global'), '');
    await mkdir(join(root, 'repo', 'd1'), { recursive: true });
    await mkdir(join(root, 'repo', 'd2'), { recursive: true });
    for (const [path, content] of [
      // Pickaxe and regex values of --no-index match this file only after a no-index switch.
      ['a', '--no-index\n'],
      ['b', 'two\n'],
      ['d1/f', 'left\n'],
      ['d2/f', 'right\n'],
    ] as const) {
      await writeFile(join(root, 'repo', path), content);
    }
    for (const args of [
      ['init', '-q'],
      ['add', '--', '.'],
      ['commit', '-qm', 'seed'],
    ]) {
      expect(git(args).status).toBe(0);
    }
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const git = (args: string[]) => {
    const result = spawnSync('git', ['-C', join(root, 'repo'), ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    return result;
  };
  const rejects = (command: 'diff' | 'diff --no-index', args: readonly unknown[]) =>
    expect(() => commandArguments(command, args, true)).toThrow(GitArgumentError);

  it('rejects residual words that the no-revision branches report, in every selected Git', () => {
    const files = git(['diff', '--merge-base']);
    expect(files.status).not.toBe(0);
    expect(files.stderr).toContain('invalid option: --merge-base');
    rejects('diff', [['--merge-base']]);

    // builtin/diff.c usage() reports on stderr, unlike the parse_options -h exit.
    const cached = git(['diff', '--cached', '--base']);
    expect(cached.status).toBe(129);
    expect(cached.stderr).toMatch(/^usage:/);
    rejects('diff', [['--cached'], ['--base']]);

    expect(git(['diff', '--cached', '-n', '1']).status).toBe(129);
    rejects('diff', [['--cached'], ['-n', 1]]);

    // setup_revisions finishes diff option checks before the residual -h is reached.
    const exclusive = git(['diff', '--name-only', '--name-status', '-h']);
    expect(exclusive.status).toBe(128);
    rejects('diff', [['--name-only'], ['--name-status'], ['-h']]);

    expect(git(['diff', '-h', '--merge-base']).status).toBe(129);
    expect(commandArguments('diff', [['-h'], ['--merge-base']], true)).toEqual([
      'diff',
      '-h',
      '--merge-base',
    ]);
  });

  it('records the legacy HEAD-by-hand --merge-base difference explicitly', () => {
    const result = git(['diff', '--cached', '--merge-base']);
    // Git 2.25 predates diff --merge-base; its diff-index residual loop prints usage.
    // The typed API follows the pinned Git 2.55 grammar and accepts the spelling.
    expect(result.status).toBe(legacy ? 129 : 0);
    expect(commandArguments('diff', [['--cached'], ['--merge-base']], true)).toEqual([
      'diff',
      '--cached',
      '--merge-base',
    ]);
  });

  it('rejects detached values that switch to no-index or become the path separator', () => {
    // Both selected releases scan raw argv for --no-index before setup_revisions.
    const switched = git(['diff', '-S', '--no-index', 'a', 'b']);
    expect(switched.status).toBe(1);
    expect(switched.stdout).toMatch(/^diff --git/);
    rejects('diff', [['-S', '--no-index'], { operand: 'a' }, { operand: 'b' }]);

    expect(git(['diff', '-n', '3', '-S', '--no-index']).status).toBe(0);
    expect(
      commandArguments(
        'diff',
        [
          ['-n', 3],
          ['-S', '--no-index'],
        ],
        true,
      ),
    ).toEqual(['diff', '-n', '3', '-S', '--no-index']);

    expect(git(['diff', '-S', '--']).status).not.toBe(0);
    rejects('diff', [['-S', '--']]);
  });

  it('limits stdin comparisons to two paths and records legacy pathspec arity', () => {
    expect(git(['diff', '--no-index', '-', 'b', 'a']).status).toBe(129);
    rejects('diff --no-index', [{ operand: '-' }, { operand: 'b' }, { operand: 'a' }]);

    const pathspec = git(['diff', '--no-index', 'd1', 'd2', 'f']);
    // Git 2.25 (and other releases before no-index pathspecs) requires exactly two paths;
    // Git 2.55 limits two directories by pathspec. Directory detection is filesystem-dependent,
    // so the typed API follows the pinned grammar and leaves the decision to the selected Git.
    if (legacy) {
      expect(pathspec.status).toBe(129);
    } else {
      expect([1, 129]).toContain(pathspec.status);
    }
    expect(
      commandArguments(
        'diff --no-index',
        [{ operand: 'd1' }, { operand: 'd2' }, { operand: 'f' }],
        true,
      ),
    ).toEqual(['diff', '--no-index', 'd1', 'd2', 'f']);
  });
});

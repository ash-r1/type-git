/**
 * Empty revision operands and option values in the convenience APIs.
 *
 * These values used to be dropped by truthiness checks, so `repo.reset('')` ran `git reset` and
 * unstaged changes, while Git itself rejects `git reset ''` in every repository. Each case checks
 * three things: native Git rejects the faithful argv, the API refuses the call before spawning, and
 * the repository state is unchanged. One representative per field suffices because Git's verdict
 * depends only on the value being empty; option-like values are covered by operand-injection tests.
 */

import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

const USE_LEGACY_VERSION = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';

describe('convenience APIs keep empty revisions and option values', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;

  const native = (args: readonly string[]) =>
    spawnSync('git', ['-C', repo.workdir, ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });

  /** Index, worktree, HEAD, branches and stashes: everything the refused calls could change. */
  const snapshot = () =>
    [
      ['status', '--porcelain=v2', '--branch'],
      ['rev-parse', 'HEAD'],
      ['for-each-ref', '--format=%(refname) %(objectname)'],
      ['diff', '--no-color'],
    ].map((args) => native(args).stdout);

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-empty-operands-'));
    env = {
      PATH: process.env.PATH ?? '',
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_COUNT: '0',
      LC_ALL: 'C',
      // An editor would mean a dropped -m; fail fast instead of waiting.
      GIT_EDITOR: 'false',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    const git = new TypeGit({
      home: root,
      inheritEnv: false,
      env,
      useLegacyVersion: USE_LEGACY_VERSION,
    });
    repo = await git.init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await repo.add('tracked');
    await repo.commit({ message: 'one' });
    await writeFile(join(repo.workdir, 'tracked'), 'two\n');
    await repo.commit({ message: 'two', all: true });
    // A staged change and a separate worktree change, so reset/restore/checkout would show.
    await writeFile(join(repo.workdir, 'tracked'), 'staged\n');
    await repo.add('tracked');
    await writeFile(join(repo.workdir, 'tracked'), 'worktree\n');
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const cases: readonly [string, (r: WorktreeRepo) => Promise<unknown>, readonly string[]][] = [
    ['reset target', (r) => r.reset(''), ['reset', '']],
    ['reset target with a mode', (r) => r.reset('', { mode: 'hard' }), ['reset', '--hard', '']],
    ['diff target', (r) => r.diff(''), ['diff', '']],
    ['log ref', (r) => r.log({ ref: '' }), ['log', '']],
    ['rebase upstream', (r) => r.rebase({ upstream: '' }), ['rebase', '']],
    [
      'rebase onto',
      (r) => r.rebase({ onto: '', upstream: 'HEAD' }),
      ['rebase', '--onto', '', 'HEAD'],
    ],
    [
      'restore source',
      (r) => r.restore('tracked', { source: '' }),
      ['restore', '--source', '', '--', 'tracked'],
    ],
    [
      'path checkout source',
      (r) => r.checkout(['tracked'], { source: '' }),
      ['checkout', '', '--', 'tracked'],
    ],
    [
      'switch start point',
      (r) => r.switch('created', { create: true, startPoint: '' }),
      ['switch', '-c', 'created', ''],
    ],
    [
      'branch start point',
      (r) => r.branch.create('created', { startPoint: '' }),
      ['branch', 'created', ''],
    ],
    [
      'checkout start point',
      (r) => r.checkout('created', { createBranch: true, startPoint: '' }),
      ['checkout', '-b', 'created', ''],
    ],
    [
      'commit fixup',
      (r) => r.commit({ fixup: '', allowEmpty: true }),
      ['commit', '--allow-empty', '--fixup', ''],
    ],
    [
      'commit squash',
      (r) => r.commit({ squash: '', allowEmpty: true }),
      ['commit', '--allow-empty', '--squash', ''],
    ],
    [
      'commit reuseMessage',
      (r) => r.commit({ reuseMessage: '', allowEmpty: true }),
      ['commit', '--allow-empty', '--reuse-message', ''],
    ],
    [
      'commit file',
      (r) => r.commit({ file: '', allowEmpty: true }),
      ['commit', '--allow-empty', '--file', ''],
    ],
  ];

  for (const [label, call, faithful] of cases) {
    it(`refuses an empty ${label} that Git rejects, without touching the repository`, async () => {
      const before = snapshot();
      const result = native(faithful);
      // Git exits 128 for each today; any failure is enough to show the word is never accepted.
      expect(result.status, JSON.stringify(faithful)).not.toBe(0);
      expect(snapshot()).toEqual(before);
      await expect(call(repo)).rejects.toBeInstanceOf(GitArgumentError);
      expect(snapshot()).toEqual(before);
    });
  }

  it('still emits nonempty revisions and option values', async () => {
    const before = snapshot();
    await repo.restore('tracked', { source: 'HEAD', worktree: true });
    expect(native(['diff', '--no-color']).stdout).toContain('+two');
    await writeFile(join(repo.workdir, 'tracked'), 'worktree\n');
    expect(snapshot()).toEqual(before);
    const commits = await repo.log({ ref: 'HEAD~1' });
    expect(commits.map((c) => c.subject)).toEqual(['one']);
    const diff = await repo.diff('HEAD~1', { paths: ['tracked'] });
    expect('raw' in diff && diff.raw).toContain('+worktree');
  });

  it('forwards an empty commit message instead of opening an editor', async () => {
    // Without allowEmptyMessage, Git aborts on the empty message itself.
    await expect(repo.commit({ message: '', allowEmpty: true })).rejects.toThrow(
      /empty commit message/,
    );
    const native0 = native(['rev-parse', 'HEAD']).stdout;
    const result = await repo.commit({ message: '', allowEmpty: true, allowEmptyMessage: true });
    expect(result.summary).toBe('');
    expect(native(['rev-parse', 'HEAD~1']).stdout).toBe(native0);
    expect(native(['log', '-1', '--format=%B']).stdout.trim()).toBe('');
  });
});

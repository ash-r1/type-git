import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

const EMPTY_PATHSPEC = 'empty string is not a valid pathspec';

describe('stash push empty pathspec', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-stash-pathspec-'));
    env = {
      PATH: process.env.PATH ?? '',
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_COUNT: '0',
      LC_ALL: 'C',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'initial\n');
    await repo.add('tracked');
    await repo.commit({ message: 'tracked' });
    // Local changes make the rejection independent of the "no local changes" early exit.
    await writeFile(join(repo.workdir, 'tracked'), 'changed\n');
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const direct = (args: string[]) =>
    spawnSync('git', ['-C', repo.workdir, 'stash', ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });

  it('refuses an empty pathspec that native Git rejects after option parsing', () => {
    for (const [command, args, words] of [
      ['stash push', [['--'], { operand: '' }], ['push', '--', '']],
      ['stash push', [{ operand: '' }], ['push', '']],
      [
        'stash push',
        [['-m', 'x'], ['--'], { operand: 'tracked' }, { operand: '' }],
        ['push', '-m', 'x', '--', 'tracked', ''],
      ],
      ['stash', [['--'], { operand: '' }], ['--', '']],
      ['stash', [{ operand: 'push' }, ['--'], { operand: '' }], ['push', '--', '']],
    ] as const) {
      const label = JSON.stringify(words);
      const native = direct([...words]);
      expect(native.status, label).toBe(128);
      expect(native.stderr, label).toContain(EMPTY_PATHSPEC);
      expect(() => commandArguments(command, args), label).toThrow(GitArgumentError);
    }
    // Nothing was stashed by the rejected native calls.
    expect(direct(['list']).stdout).toBe('');
  });

  it('keeps the earlier help exit and nonempty paths', async () => {
    const help = await repo.command('stash push', [['-h'], ['--'], { operand: '' }]);
    const native = direct(['push', '-h', '--', '']);
    // Usage exits 129 up to Git 2.55 and 0 from Git 2.56; either way it precedes the pathspec.
    expect([0, 129]).toContain(native.status);
    expect(native.stdout).toContain('usage: git stash');
    expect(help.exitCode).toBe(native.status);
    expect(help.stdout).toBe(native.stdout);
    expect(commandArguments('stash push', [['--'], { operand: 'tracked' }])).toEqual([
      'stash',
      'push',
      '--',
      'tracked',
    ]);
  });
});

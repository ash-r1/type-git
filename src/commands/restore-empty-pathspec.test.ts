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

describe('restore empty pathspec', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-restore-pathspec-'));
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
    await writeFile(join(repo.workdir, 'paths'), 'tracked\n');
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const direct = (args: readonly string[]) =>
    spawnSync('git', ['-C', repo.workdir, 'restore', ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });

  it('refuses an empty pathspec in every restore mode, as native Git does', () => {
    // --pathspec-from-file arrived in Git 2.26, so the legacy 2.25 job checks the other modes.
    const fileOption = (direct(['-h']).stdout ?? '').includes('--pathspec-from-file');
    const fileCases = [
      // A pathspec file conflicts with operands, but the empty pathspec is already fatal.
      [
        [['--pathspec-from-file', 'paths'], ['--'], { operand: '' }],
        ['--pathspec-from-file=paths', '--', ''],
      ],
    ] as const;
    const cases = [
      [
        [['--'], { operand: '' }],
        ['--', ''],
      ],
      [[{ operand: '' }], ['']],
      [
        [{ operand: 'tracked' }, { operand: '' }],
        ['tracked', ''],
      ],
      [
        [['--staged'], ['--'], { operand: '' }],
        ['--staged', '--', ''],
      ],
      [
        [['--source', 'HEAD'], ['--'], { operand: '' }],
        ['--source=HEAD', '--', ''],
      ],
    ] as const;
    for (const [args, words] of fileOption ? [...cases, ...fileCases] : cases) {
      const label = JSON.stringify(words);
      const native = direct(words);
      expect(native.status, label).toBe(128);
      expect(native.stderr, label).toContain(EMPTY_PATHSPEC);
      expect(() => commandArguments('restore', args), label).toThrow(GitArgumentError);
    }
  });

  it('keeps the earlier help exit and nonempty paths', async () => {
    const help = await repo.command('restore', [['-h'], ['--'], { operand: '' }]);
    const native = direct(['-h', '--', '']);
    // Usage exits 129 up to Git 2.55 and 0 from Git 2.56; either way it precedes the pathspec.
    expect([0, 129]).toContain(native.status);
    expect(native.stdout).toContain('usage: git restore');
    expect(help.exitCode).toBe(native.status);
    expect(help.stdout).toBe(native.stdout);
    expect(commandArguments('restore', [['--'], { operand: 'tracked' }])).toEqual([
      'restore',
      '--',
      'tracked',
    ]);
  });
});

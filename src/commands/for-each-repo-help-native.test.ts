import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('for-each-repo internal help and callback order', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-for-each-repo-help-'));
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
    const expected = native(['for-each-repo', ...words]);
    expect(await snapshot()).toEqual(before);
    const actual = await repo.command('for-each-repo', args as never);
    expect(await snapshot()).toEqual(before);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  it('matches native help/completion including unsupported legacy command outcomes', async () => {
    for (const flag of [
      '-h',
      '--help-all',
      '--git-completion-helper',
      '--git-completion-helper-all',
    ]) {
      await compare([[flag]], [flag]);
    }
    await compare([['--keep-going'], ['--help']], ['--keep-going', '--help']);
    await compare(
      [['--help-all'], ['--git-completion-helper']],
      ['--help-all', '--git-completion-helper'],
    );
  });
  it('keeps help-looking config values and final config lookup separate', async () => {
    const value = await compare([['--config', '--help-all']], ['--config=--help-all']);
    expect(value.status).not.toBe(0);
    await compare(
      [['--config', '--help-all'], ['--help-all']],
      ['--config=--help-all', '--help-all'],
    );
    await compare(
      [['--config', 'invalid-key'], ['--help-all']],
      ['--config=invalid-key', '--help-all'],
    );
    const invalid = await compare([['--config', 'invalid-key']], ['--config=invalid-key']);
    expect(invalid.status).not.toBe(0);
  });
  it('uses an unconfigured key without launching a delegated child', async () => {
    expect(native(['config', '--get-all', 'typegit.missing']).status).toBe(1);
    await compare([['--config', 'typegit.missing']], ['--config=typegit.missing']);
    await compare(
      [
        ['--config', 'typegit.missing'],
        { operand: 'type-git-must-not-run' },
        { operand: '--help-all' },
      ],
      ['--config=typegit.missing', 'type-git-must-not-run', '--help-all'],
    );
    await compare(
      [['--config', 'typegit.missing'], ['--'], { operand: '--help-all' }],
      ['--config=typegit.missing', '--', '--help-all'],
    );
  });
  it('retains reached completion and representation errors', async () => {
    await expect(
      repo.command('for-each-repo', [
        ['--config', 'typegit.missing'],
        { operand: 'unused' },
        ['--help-all'],
      ] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    await expect(
      repo.command('for-each-repo', [['--git-completion-helper'], ['--help-all']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(native(['for-each-repo', '--git-completion-helper', '--help-all']).status).not.toBe(0);
  });
});

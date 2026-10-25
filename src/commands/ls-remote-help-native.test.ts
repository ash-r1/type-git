import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('ls-remote internal help and callback order', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-ls-remote-help-'));
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
    const expected = native(['ls-remote', ...words]);
    expect(await snapshot()).toEqual(before);
    const actual = await repo.command('ls-remote', args as never);
    expect(await snapshot()).toEqual(before);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  it('preserves native help and sole completion including old unsupported words', async () => {
    for (const flag of [
      '-h',
      '--help-all',
      '--git-completion-helper',
      '--git-completion-helper-all',
    ]) {
      await compare([[flag]], [flag]);
    }
    await compare([['--refs'], ['--help']], ['--refs', '--help']);
    await compare([['-h'], ['--help-all']], ['-h', '--help-all']);
    await compare(
      [['--help-all'], ['--git-completion-helper']],
      ['--help-all', '--git-completion-helper'],
    );
  });
  it('keeps multiword -h as heads and retains reached completion failure', async () => {
    const result = await compare(
      [['--get-url'], ['-h'], { operand: root }],
      ['--get-url', '-h', root],
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${root}\n`);
    await expect(
      repo.command('ls-remote', [['-h'], ['--git-completion-helper']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    const failed = native(['ls-remote', '-h', '--git-completion-helper']);
    expect(failed.status).toBe(129);
    expect(failed.stderr).toContain('unknown option');
  });
  it('stops parsing at the first operand and retains tagged literal patterns', async () => {
    for (const flag of ['--help-all', '--git-completion-helper']) {
      const result = await compare(
        [['--get-url'], { operand: root }, { operand: flag }],
        ['--get-url', root, flag],
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`${root}\n`);
    }
    await compare(
      [['--get-url'], ['--'], { operand: root }, { operand: '-h' }],
      ['--get-url', '--', root, '-h'],
    );
    await expect(
      repo.command('ls-remote', [['--get-url'], { operand: root }, ['--help-all']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });
  it('does not mistake required help-looking values for exits', async () => {
    await compare(
      [['--upload-pack', '--help-all'], ['--help-all']],
      ['--upload-pack=--help-all', '--help-all'],
    );
    await compare(
      [['--server-option', '-h'], ['--help-all']],
      ['--server-option=-h', '--help-all'],
    );
    await expect(
      repo.command('ls-remote', [
        ['--upload-pack', '--help-all'],
        ['--git-completion-helper'],
      ] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(
      native(['ls-remote', '--upload-pack=--help-all', '--git-completion-helper']).status,
    ).toBe(129);
  });
  it('preserves selected native sort callback timing without contacting a transport', async () => {
    await compare(
      [['--sort', 'type-git-invalid-sort'], ['--help-all']],
      ['--sort=type-git-invalid-sort', '--help-all'],
    );
    await compare(
      [['--help-all'], ['--sort', 'type-git-invalid-sort']],
      ['--help-all', '--sort=type-git-invalid-sort'],
    );
    await compare(
      [['--get-url'], ['--sort', 'type-git-invalid-sort'], { operand: root }],
      ['--get-url', '--sort=type-git-invalid-sort', root],
    );
    const result = await compare(
      [['--get-url'], ['--upload-pack', 'type-git-program-must-not-run'], { operand: root }],
      ['--get-url', '--upload-pack=type-git-program-must-not-run', root],
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${root}\n`);
  });
});

import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

describe('ls-tree internal help and callback order', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-ls-tree-help-'));
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
    const expected = native(['ls-tree', ...words]);
    expect(await snapshot()).toEqual(before);
    const actual = await repo.command('ls-tree', args as never);
    expect(await snapshot()).toEqual(before);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  it('retains ordinary non-help long output on the selected native Git', async () => {
    const actual = await compare([['--long'], { operand: 'HEAD' }], ['--long', 'HEAD']);
    expect(actual.status).toBe(0);
  });
  it('matches help/completion and preserves unsupported old words', async () => {
    for (const flag of [
      '-h',
      '--help-all',
      '--git-completion-helper',
      '--git-completion-helper-all',
    ]) {
      await compare([[flag]], [flag]);
    }
    await compare([['--full-tree'], ['--help']], ['--full-tree', '--help']);
    await compare(
      [['--help-all'], ['--git-completion-helper']],
      ['--help-all', '--git-completion-helper'],
    );
    await expect(
      repo.command('ls-tree', [['--git-completion-helper'], ['--help-all']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(native(['ls-tree', '--git-completion-helper', '--help-all']).status).toBe(129);
  });
  it('skips only numeric callbacks after a real help exit', async () => {
    await compare([['-h'], ['--abbrev', 'bad']], ['-h', '--abbrev=bad']);
    await expect(
      repo.command('ls-tree', [['--abbrev', 'bad'], ['-h']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(native(['ls-tree', '--abbrev=bad', '-h']).status).toBe(129);
  });
  it('observes old bit combinations or modern reached mode conflicts', async () => {
    for (const flags of [
      ['--long', '--name-only'],
      ['--name-only', '--long'],
      ['--name-only', '--name-status'],
    ]) {
      const words = [...flags, '-h'];
      const expected = native(['ls-tree', ...words]);
      if (expected.stderr.startsWith('error: options ')) {
        await expect(
          repo.command('ls-tree', words.map((flag) => [flag]) as never),
        ).rejects.toBeInstanceOf(GitArgumentError);
      } else {
        await compare(
          words.map((flag) => [flag]),
          words,
        );
      }
    }
    await compare([['-h'], ['--long'], ['--name-only']], ['-h', '--long', '--name-only']);
  });
  it('bypasses final format checks and retains old unsupported option errors', async () => {
    const expected = native(['ls-tree', '--format=%(path)', '--long', '--help-all']);
    if (expected.stderr.startsWith('error: unknown option')) {
      await expect(
        repo.command('ls-tree', [['--format', '%(path)'], ['--long'], ['--help-all']] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    } else {
      await compare(
        [['--format', '%(path)'], ['--long'], ['--help-all']],
        ['--format=%(path)', '--long', '--help-all'],
      );
    }
    await compare([['--format', '-h'], ['--help-all']], ['--format=-h', '--help-all']);
    await compare([['--help-all'], ['--'], { operand: '-h' }], ['--help-all', '--', '-h']);
    expect(() =>
      commandArguments('ls-tree', [
        ['--format', '-h'],
        ['--abbrev', 'bad'],
      ]),
    ).toThrow(GitArgumentError);
  });
});

import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError, type RawResult } from '../core/types.js';

describe('ls-tree non-help mode families', () => {
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

  it('retains native failure when no tree operand is supplied', async () => {
    const result = native(['ls-tree', '--long', '--name-only']);
    expect(result.status).toBe(129);
    await expect(
      repo.command('ls-tree', [['--long'], ['--name-only']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });
  it('matches native listings or rejects native-invalid mode/value combinations without changing fixture bytes', async () => {
    const paths = ['.git/index', 'file', '.git/HEAD'];
    const snapshot = () => Promise.all(paths.map((path) => readFile(join(root, path))));
    const before = await snapshot();
    const tree = { operand: 'HEAD' };
    for (const args of [
      [['--long'], tree],
      [['--name-only'], tree],
      [['--name-status'], tree],
      [['--object-only'], tree],
      [['--long'], ['--name-only'], tree],
      [['--name-only'], ['--long'], tree],
      [['--name-only'], ['--name-status'], tree],
      [['--long'], ['--name-status'], tree],
      [['--name-status'], ['--long'], tree],
      [['-l'], ['--name-only'], tree],
      [['--name-only'], ['--name-only'], tree],
      [['--long'], tree, ['--name-only']],
      [tree, ['--long'], ['--name-only']],
      [['--abbrev', '7'], ['--long'], ['--name-only'], tree],
      [['--format', '%(path)'], ['--long'], tree],
      [['--abbrev', 'bad'], ['--long'], tree],
    ]) {
      const words = args.map((arg) =>
        Array.isArray(arg)
          ? arg.length === 1
            ? arg[0]
            : `${arg[0]}=${arg[1]}`
          : (arg as { operand: string }).operand,
      );
      const expected = native(['ls-tree', ...words]);
      expect(await snapshot()).toEqual(before);
      let actual: RawResult | undefined;
      try {
        actual = await repo.command('ls-tree', args as never);
      } catch (error) {
        expect(error).toBeInstanceOf(GitArgumentError);
        expect(expected.status).not.toBe(0);
      }
      if (expected.status === 0) {
        expect(actual).toBeDefined();
      }
      if (actual) {
        expect(actual.exitCode).toBe(expected.status);
        expect(actual.stdout).toBe(expected.stdout);
        expect(actual.stderr).toBe(expected.stderr);
      }
      expect(await snapshot()).toEqual(before);
    }
  }, 120_000);
});

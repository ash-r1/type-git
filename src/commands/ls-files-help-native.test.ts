import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

describe('ls-files internal help and callback order', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-ls-files-help-'));
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
    const expected = native(['ls-files', ...words]);
    expect(await snapshot()).toEqual(before);
    const actual = await repo.command('ls-files', args as never);
    expect(await snapshot()).toEqual(before);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  it('preserves native help/completion exits and older unsupported completion errors', async () => {
    for (const flag of [
      '-h',
      '--help-all',
      '--git-completion-helper',
      '--git-completion-helper-all',
    ]) {
      await compare([[flag]], [flag]);
    }
    for (const flag of ['-h', '--help', '--help-all']) {
      await compare(
        [['--cached'], [flag], ['--git-completion-helper']],
        ['--cached', flag, '--git-completion-helper'],
      );
    }
    await expect(
      repo.command('ls-files', [['--git-completion-helper'], ['--help-all']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    const failed = native(['ls-files', '--git-completion-helper', '--help-all']);
    expect(failed.status).toBe(129);
    expect(failed.stderr).toContain('unknown option');
  });
  it('retains reached numeric callbacks but bypasses later ones', async () => {
    await compare([['-h'], ['--abbrev', 'bad']], ['-h', '--abbrev=bad']);
    await expect(
      repo.command('ls-files', [['--abbrev', 'bad'], ['-h']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    const failed = native(['ls-files', '--abbrev=bad', '-h']);
    expect(failed.status).toBe(129);
    expect(failed.stderr).toMatch(/error:|invalid/i);
  });
  it('delegates a reached exclude-file failure and skips file access after help', async () => {
    const failed = await compare(
      [['--exclude-from', 'missing-ignore-file'], ['-h']],
      ['--exclude-from=missing-ignore-file', '-h'],
    );
    expect(failed.status).toBe(128);
    expect(failed.stderr).toContain('missing-ignore-file');
    await compare(
      [['-h'], ['--exclude-from', 'missing-ignore-file']],
      ['-h', '--exclude-from=missing-ignore-file'],
    );
  });
  it('preserves final-mode help bypass and older unsupported format outcomes', async () => {
    await compare(
      [['--format', '%(path)'], ['-s'], ['--help-all']],
      ['--format=%(path)', '-s', '--help-all'],
    );
    await compare(
      [['--with-tree', 'missing-ref'], ['-s'], ['-h']],
      ['--with-tree=missing-ref', '-s', '-h'],
    );
    await compare(
      [['--recurse-submodules'], ['--error-unmatch'], ['-h']],
      ['--recurse-submodules', '--error-unmatch', '-h'],
    );
  });
  it('keeps consumed values and tagged words distinct from help exits', async () => {
    await compare([['--exclude', '-h'], ['--help-all']], ['--exclude=-h', '--help-all']);
    await compare([['--format', '-h'], ['--help-all']], ['--format=-h', '--help-all']);
    await compare([['--'], { operand: '-h' }], ['--', '-h']);
    await compare([['--help-all'], ['--'], { operand: '-h' }], ['--help-all', '--', '-h']);
    expect(() =>
      commandArguments('ls-files', [
        ['--exclude', '-h'],
        ['--abbrev', 'bad'],
      ]),
    ).toThrow(GitArgumentError);
  });
});

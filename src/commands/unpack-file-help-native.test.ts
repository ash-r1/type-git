import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('unpack-file internal help and callback order', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-unpack-file-help-'));
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
    const snapshot = () =>
      Promise.all([
        readdir(root).then((entries) => entries.sort()),
        ...paths.map((path) => readFile(join(root, path))),
      ]);
    const before = await snapshot();
    const expected = native(['unpack-file', ...words]);
    expect(await snapshot()).toEqual(before);
    const actual = await repo.command('unpack-file', args as never);
    expect(await snapshot()).toEqual(before);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  it('matches selected native sole help outcomes without extracting blobs', async () => {
    for (const flag of ['-h', '--help-all']) {
      await compare([[flag]], [flag]);
    }
    await compare([{ operand: '--help-all' }], ['--help-all']);
  });
  it('matches successful native blob extraction and cleans up both output files', async () => {
    const object = native(['rev-parse', 'HEAD:file']);
    expect(object.status).toBe(0);
    const blob = object.stdout.trim();
    const before = (await readdir(root)).sort();
    const expected = native(['unpack-file', blob]);
    expect(expected.status).toBe(0);
    expect(expected.stderr).toBe('');
    expect(expected.stdout.trim()).toMatch(/^\.merge_file_[A-Za-z0-9]+$/);
    const expectedFile = join(root, expected.stdout.trim());
    let expectedContents: Buffer;
    try {
      expectedContents = await readFile(expectedFile);
      expect(expectedContents.toString('utf8')).toBe('base\n');
    } finally {
      await rm(expectedFile);
    }
    const actual = await repo.command('unpack-file', [{ operand: blob }] as never);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stderr).toBe(expected.stderr);
    expect(actual.stdout.trim()).toMatch(/^\.merge_file_[A-Za-z0-9]+$/);
    const actualFile = join(root, actual.stdout.trim());
    try {
      expect(await readFile(actualFile)).toEqual(expectedContents);
    } finally {
      await rm(actualFile);
    }
    expect((await readdir(root)).sort()).toEqual(before);
  });
  it('preserves missing and wrong-type object failures before file creation', async () => {
    for (const object of ['missing-blob', 'HEAD', 'HEAD^{tree}', '--']) {
      const result = await compare([{ operand: object }], [object]);
      expect(result.status).toBe(128);
    }
  });
  it('keeps multiword usage and wrapper operand-count errors separate', async () => {
    for (const flag of ['-h', '--help-all']) {
      await expect(
        repo.command('unpack-file', [[flag], { operand: 'ignored' }] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
      expect(native(['unpack-file', flag, 'ignored']).status).not.toBe(0);
    }
    await expect(repo.command('unpack-file', [] as never)).rejects.toBeInstanceOf(GitArgumentError);
    expect(native(['unpack-file']).status).not.toBe(0);
    await expect(
      repo.command('unpack-file', [
        ['--help-all'],
        { operand: 'one' },
        { operand: 'two' },
      ] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(native(['unpack-file', '--help-all', 'one', 'two']).status).not.toBe(0);
  });
  it('preserves the literal marker control and invalid tuple boundary', async () => {
    await compare([{ operand: '--' }], ['--']);
    await expect(repo.command('unpack-file', [['--']] as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
  });
});

import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import type { Git } from '../core/git.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { parseGitLog, parseLsTree, parsePorcelainV2 } from '../parsers/index.js';
import { createGitSync } from './git-impl.js';

const LEGACY = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';
const HAS_LFS = spawnSync('git', ['lfs', 'version']).status === 0;
const SPECIAL_NAMES =
  process.platform === 'win32'
    ? ['日本語.txt', 'space name.txt']
    : [
        '日本語.txt',
        ' leading and trailing ',
        'tab\tname',
        'line\nname',
        'quote"name',
        'back\\slash',
      ];

describe('0.4 typed output contracts (real Git)', () => {
  let root: string;
  let git: Git;
  let repo: WorktreeRepo;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-contracts-'));
    git = createGitSync({
      adapters: createNodeAdapters(),
      home: root,
      env: {
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
    });
    repo = await git.init(join(root, 'repo'), { initialBranch: 'main' });
    await repo.commit({ message: 'initial', allowEmpty: true });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('round trips unusual names through status, ls-tree, diff, and bare repositories', async () => {
    for (const path of SPECIAL_NAMES) {
      await writeFile(join(repo.workdir, path), 'contents\n');
    }
    expect((await repo.status({ untracked: 'all' })).entries.map((e) => e.path).sort()).toEqual(
      [...SPECIAL_NAMES].sort(),
    );
    await repo.add(SPECIAL_NAMES);
    expect(await repo.diff(undefined, { staged: true, nameOnly: true })).toEqual(
      expect.arrayContaining(SPECIAL_NAMES),
    );
    expect((await repo.diff(undefined, { staged: true, nameStatus: true })).files).toEqual(
      expect.arrayContaining(SPECIAL_NAMES.map((path) => ({ path, status: 'A' }))),
    );
    await repo.commit({ message: 'files' });
    expect(await repo.lsTree('HEAD', { nameOnly: true })).toEqual(
      expect.arrayContaining(SPECIAL_NAMES),
    );
    const entries = await repo.lsTree('HEAD', { long: true });
    expect(entries).toHaveLength(SPECIAL_NAMES.length);
    expect(
      entries.every(
        (entry) => entry.type === 'blob' && entry.size === 9 && entry.hash.length === 40,
      ),
    ).toBe(true);
    const bare = await git.clone(repo.workdir, join(root, 'bare'), { bare: true });
    expect(bare.kind).toBe('bare');
    expect(await bare.lsTree('HEAD')).toEqual(await repo.lsTree('HEAD'));
    expect(await bare.lsTree('HEAD', { objectOnly: true })).toEqual(entries.map((e) => e.hash));
  });

  it('preserves both rename paths and the similarity score', async () => {
    const oldPath = SPECIAL_NAMES[0]!;
    const path = SPECIAL_NAMES[1]!;
    await writeFile(join(repo.workdir, oldPath), 'unchanged\n');
    await repo.add(oldPath);
    await repo.commit({ message: 'before rename' });
    await repo.mv(oldPath, path);
    expect((await repo.status()).entries).toEqual([
      { path, originalPath: oldPath, index: 'R', workdir: '.' },
    ]);
    expect(
      (await repo.diff(undefined, { staged: true, nameStatus: true, detectRenames: true })).files,
    ).toEqual([{ path, oldPath, status: 'R', similarity: 100 }]);
  });

  it('preserves control characters and whitespace in commit bodies with user log settings enabled', async () => {
    await repo.config.setRaw('log.showSignature', 'true');
    await repo.config.setRaw('log.showNotes', 'true');
    await repo.config.setRaw('log.decorate', 'full');
    await repo.config.setRaw('color.ui', 'always');
    const message = 'subject\n\n  body\x01with record-like text\nlast line  \n';
    await repo.commit({ message, allowEmpty: true, cleanup: 'verbatim' });
    const commits = await repo.log({ maxCount: 2 });
    expect(commits).toHaveLength(2);
    expect(commits[0]?.subject).toBe('subject');
    expect(commits[0]?.body).toBe('  body\x01with record-like text\nlast line  \n');
    expect(commits[1]?.subject).toBe('initial');
  });

  it('returns actual config values including whitespace, newlines, tabs, and empty strings in all contexts', async () => {
    const bare = await git.init(join(root, 'bare'), { bare: true });
    for (const config of [repo.config, bare.config, git.config]) {
      await config.setRaw('test.multi', '  first\nsecond\t= third  ');
      await config.setRaw('test.multi', '', { add: true });
      expect(await config.getRaw('test.multi', { all: true })).toEqual([
        '  first\nsecond\t= third  ',
        '',
      ]);
      expect(await config.getRaw('test.multi')).toBe('');
      expect(await config.getRaw('test.missing')).toBeUndefined();
      expect(await config.getRaw('test.missing', { all: true })).toEqual([]);
      expect(await config.getRaw('test.missing', { default: ' fallback ' })).toBe(' fallback ');
      const listed = (await config.list({ showOrigin: true, showScope: !LEGACY })).filter(
        (e) => e.key === 'test.multi',
      );
      expect(listed.map((e) => e.value)).toEqual(['  first\nsecond\t= third  ', '']);
      expect(listed.every((e) => e.origin?.startsWith('file:') && (LEGACY || e.scope))).toBe(true);
      await config.setRaw('core.filemode', 'yes');
      expect(await config.get('core.filemode')).toBe('true');
      await config.setRaw('core.filemode', '');
      expect(await config.get('core.filemode')).toBe('false');
      await config.setRaw('core.filemode', '2');
      expect(await config.get('core.filemode')).toBe('true');
      expect(await config.getRaw('core.filemode', { type: 'bool' })).toBe('true');
      await config.setRaw('push.default', 'nonsense');
      await expect(config.get('push.default')).rejects.toMatchObject({ kind: 'ParseError' });
      await config.setRaw('push.default', 'simple', { add: true });
      expect(await config.get('push.default')).toBe('simple');
      await expect(config.getAll('push.default')).rejects.toMatchObject({ kind: 'ParseError' });
    }
  });

  it('distinguishes implicit true from an explicitly empty false config value', async () => {
    await repo.raw(['config', '--unset-all', 'core.filemode']);
    await writeFile(join(repo.workdir, '.git', 'config'), '\n[core]\n filemode\n', { flag: 'a' });
    expect(await repo.config.get('core.filemode')).toBe('true');
    await repo.config.setRaw('core.filemode', '');
    expect(await repo.config.get('core.filemode')).toBe('false');
  });

  it('does not hide malformed config as a missing key', async () => {
    await writeFile(join(repo.workdir, '.git', 'config'), '[invalid');
    await expect(repo.config.get('user.name')).rejects.toMatchObject({ kind: 'NonZeroExit' });
    await expect(repo.config.getAll('user.name')).rejects.toMatchObject({ kind: 'NonZeroExit' });
    await expect(repo.config.getRaw('user.name')).rejects.toMatchObject({ kind: 'NonZeroExit' });
  });

  it('propagates cancellation across optional results and merge', async () => {
    const signal = AbortSignal.abort();
    for (const operation of [
      () => repo.config.get('user.name', { signal }),
      () => repo.config.getRaw('user.name', { signal }),
      () => repo.branch.current({ signal }),
      () => repo.merge('main', { signal }),
    ]) {
      await expect(operation()).rejects.toMatchObject({ kind: 'Aborted' });
    }
  });

  it('throws on failed merge operands instead of inventing a conflict result', async () => {
    await expect(repo.merge('missing-branch')).rejects.toMatchObject({ kind: 'NonZeroExit' });
  });

  it('returns all real unmerged paths, including modify/delete conflicts', async () => {
    await writeFile(join(repo.workdir, 'conflict'), 'base\n');
    await repo.add('conflict');
    await repo.commit({ message: 'base' });
    await repo.branch.create('other');
    await repo.rm('conflict');
    await repo.commit({ message: 'delete' });
    await repo.checkout('other');
    await writeFile(join(repo.workdir, 'conflict'), 'changed\n');
    await repo.add('conflict');
    await repo.commit({ message: 'modify' });
    expect(await repo.merge('main')).toMatchObject({ success: false, conflicts: ['conflict'] });
  });

  it('keeps pre-existing files when init or clone is cancelled', async () => {
    const destination = join(root, 'existing');
    await mkdir(destination);
    await writeFile(join(destination, 'keep'), 'user data');
    for (const operation of [
      () => git.init(destination, { signal: AbortSignal.abort() }),
      () => git.clone(repo.workdir, destination, { signal: AbortSignal.abort() }),
    ]) {
      await expect(operation()).rejects.toMatchObject({ kind: 'Aborted' });
      expect(await readFile(join(destination, 'keep'), 'utf8')).toBe('user data');
    }
  });

  it('uses the complete transport option set for bare repositories', async () => {
    const destination = await git.init(join(root, 'remote'), { bare: true });
    const bare = await git.clone(repo.workdir, join(root, 'source'), { bare: true });
    await bare.remote.add('destination', destination.gitDir);
    await bare.push({ remote: 'destination', refspec: 'main', dryRun: true });
    expect((await destination.raw(['show-ref'])).exitCode).toBe(1);
    await bare.push({
      remote: 'destination',
      refspec: 'main',
      forceWithLease: { refname: 'refs/heads/main', expect: '' },
    });
    expect((await destination.raw(['show-ref'])).exitCode).toBe(0);
  });

  it('rejects invalid runtime options before spawning Git', async () => {
    const adapters = createNodeAdapters();
    const spy = vi.spyOn(adapters.exec, 'spawn');
    const client = createGitSync({ adapters });
    const checkedRepo = await client.open(repo.workdir);
    spy.mockClear();
    const invalidCalls = [
      () => checkedRepo.log({ stat: true } as never),
      () => checkedRepo.status({ porcelain: 1 } as never),
      () => checkedRepo.lsTree('HEAD', { nameOnly: true, objectOnly: true } as never),
      () => checkedRepo.fetch({ all: true, remote: 'origin' } as never),
      () => checkedRepo.push({ force: true, forceWithLease: true } as never),
      () => checkedRepo.commit({ dryRun: true } as never),
      () => checkedRepo.revParse({ gitDir: true, isBareRepository: true } as never),
      () => checkedRepo.log({ maxCount: Number.NaN }),
      () => checkedRepo.diff(undefined, { context: -1 }),
    ];
    for (const call of invalidCalls) {
      await expect(call()).rejects.toBeInstanceOf(GitArgumentError);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it.runIf(HAS_LFS)('returns LFS status and file metadata from validated JSON', async () => {
    await repo.lfs.install();
    await repo.lfs.track('*.bin');
    expect((await repo.lfs.status()).files).toEqual([]);
    expect(await repo.lfs.lsFiles()).toEqual([]);
    await writeFile(join(repo.workdir, 'asset.bin'), 'contents');
    await repo.add('.');
    expect((await repo.lfs.status()).files).toContainEqual({ name: 'asset.bin', status: 'A' });
    await repo.remote.add('origin', repo.workdir);
    await repo.commit({ message: 'LFS file' });
    await repo.lfs.fetch({ remote: 'origin', dryRun: true, onLfsProgress: vi.fn() });
    const files = await repo.lfs.lsFiles();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ path: 'asset.bin', size: 8, status: 'checked-out' });
    expect(files[0]?.oid).toHaveLength(64);
  });
});

describe('malformed machine output', () => {
  it('throws ParseError instead of silently discarding records', () => {
    for (const parse of [
      () => parseGitLog('invalid'),
      () => parseLsTree('invalid'),
      () => parsePorcelainV2('1 invalid'),
    ]) {
      expect(parse).toThrow(expect.objectContaining({ kind: 'ParseError' }));
    }
  });
});

import { checkRepositoryContract } from '../../test/contracts/repository.js';
import { TypeGit } from '../adapters/node/index.js';

it('shared repository contracts through the Node TypeGit entrypoint', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'type-git-node-contracts-'));
  try {
    const git = await TypeGit.create({
      home: directory,
      useLegacyVersion: process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true',
    });
    await checkRepositoryContract(git, directory, (path, value) => writeFile(path, value));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('commit stats are independent of human-readable quiet output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'type-git-commit-stats-'));
  try {
    const git = createGitSync({ adapters: createNodeAdapters(), home: directory });
    const repo = await git.init(join(directory, 'repo'));
    await repo.config.set('user.name', 'Test');
    await repo.config.set('user.email', 'test@example.com');
    await writeFile(join(repo.workdir, 'file'), 'one\ntwo\n');
    await repo.add('file');
    expect(await repo.commit({ message: 'initial', quiet: true })).toMatchObject({
      filesChanged: 1,
      insertions: 2,
      deletions: 0,
    });
    await writeFile(join(repo.workdir, 'file'), 'one\n');
    await repo.stash.push({ message: 'subject: with punctuation' });
    const stashes = await repo.stash.list();
    expect(stashes).toHaveLength(1);
    expect(stashes[0]?.commit).toHaveLength(40);
    expect(stashes[0]?.message).toBe('subject: with punctuation');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

/**
 * Regression tests for option injection through convenience-API operands.
 *
 * A remote, URL, ref, or path that starts with `-` used to reach Git as an
 * option, so `--upload-pack=<cmd>` ran a command and `--output=<file>` wrote a
 * file. These tests use a marker file to prove nothing ran.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import type { Git } from '../core/git.js';
import type { BareRepo, WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { createGit } from './git-impl.js';

const USE_LEGACY_VERSION = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';

describe('convenience APIs reject option-like operands', () => {
  let git: Git;
  let tempDir: string;
  let upstream: string;
  let repo: WorktreeRepo;
  let bare: BareRepo;
  let marker: string;

  const uploadPack = () => `--upload-pack=touch ${marker};git-upload-pack`;
  const receivePack = () => `--receive-pack=touch ${marker};git-receive-pack`;
  const output = () => `--output=${marker}`;

  beforeAll(async () => {
    git = await createGit({ adapters: createNodeAdapters(), useLegacyVersion: USE_LEGACY_VERSION });
  });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'type-git-operand-'));
    marker = join(tempDir, 'pwned');
    upstream = join(tempDir, 'upstream');
    execFileSync('git', ['init', '-q', upstream]);
    execFileSync('git', [
      '-C',
      upstream,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'initial',
    ]);
    const workdir = join(tempDir, 'work');
    execFileSync('git', ['clone', '-q', upstream, workdir]);
    repo = (await git.open(workdir)) as WorktreeRepo;
    const bareDir = join(tempDir, 'bare.git');
    execFileSync('git', ['clone', '-q', '--bare', upstream, bareDir]);
    bare = (await git.openBare(bareDir)) as BareRepo;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function expectRejected(call: () => Promise<unknown>): Promise<void> {
    await expect(call()).rejects.toBeInstanceOf(GitArgumentError);
    expect(existsSync(marker)).toBe(false);
  }

  describe('command execution through transport options', () => {
    it('git.clone rejects an option-like url', async () => {
      await expectRejected(() => git.clone(uploadPack(), upstream));
    });

    it('git.clone rejects an option-like path', async () => {
      await expectRejected(() => git.clone(upstream, uploadPack()));
    });

    it('git.lsRemote rejects an option-like url', async () => {
      await expectRejected(() => git.lsRemote(uploadPack()));
    });

    it('repo.fetch rejects an option-like remote and refspec', async () => {
      await expectRejected(() => repo.fetch({ remote: uploadPack() }));
      await expectRejected(() => repo.fetch({ remote: 'origin', refspec: uploadPack() }));
      await expectRejected(() => repo.fetch({ remote: 'origin', refspec: ['main', uploadPack()] }));
    });

    it('repo.pull rejects an option-like remote and branch', async () => {
      await expectRejected(() => repo.pull({ remote: uploadPack() }));
      await expectRejected(() => repo.pull({ remote: 'origin', branch: uploadPack() }));
    });

    it('repo.push rejects an option-like remote and refspec', async () => {
      await expectRejected(() => repo.push({ remote: receivePack() }));
      await expectRejected(() => repo.push({ remote: 'origin', refspec: receivePack() }));
    });

    it('repo.lsRemote rejects an option-like remote', async () => {
      await expectRejected(() => repo.lsRemote(uploadPack()));
    });

    it('repo.remote.add and setUrl reject option-like operands', async () => {
      await expectRejected(() => repo.remote.add(uploadPack(), upstream));
      await expectRejected(() => repo.remote.add('other', uploadPack()));
      await expectRejected(() => repo.remote.setUrl('origin', uploadPack()));
    });

    it('repo.submodule.add rejects an option-like url', async () => {
      await expectRejected(() => repo.submodule.add(uploadPack(), 'sub'));
    });

    it('repo.rebase rejects an option-like upstream', async () => {
      await expectRejected(() => repo.rebase({ upstream: `--exec=touch ${marker}` }));
    });

    it('bare fetch, push, and lsRemote reject option-like remotes', async () => {
      await expectRejected(() => bare.fetch({ remote: uploadPack() }));
      await expectRejected(() => bare.push({ remote: receivePack() }));
      await expectRejected(() => bare.lsRemote(uploadPack()));
    });
  });

  describe('file writes through output options', () => {
    it('repo.log rejects an option-like ref', async () => {
      await expectRejected(() => repo.log({ ref: output() }));
    });

    it('repo.diff rejects an option-like target', async () => {
      await expectRejected(() => repo.diff(output()));
    });

    it('repo.show rejects an option-like object', async () => {
      await expectRejected(() => repo.show(output()));
    });
  });

  describe('refs and names', () => {
    it.each([
      ['checkout', (r: WorktreeRepo) => r.checkout('--orphan=x')],
      ['switch', (r: WorktreeRepo) => r.switch('--orphan=x')],
      ['merge', (r: WorktreeRepo) => r.merge('--no-verify')],
      ['reset', (r: WorktreeRepo) => r.reset('--hard')],
      ['branch.create', (r: WorktreeRepo) => r.branch.create('--force')],
      ['branch.delete', (r: WorktreeRepo) => r.branch.delete('--all')],
      ['tag.create', (r: WorktreeRepo) => r.tag.create('--force')],
      ['cherryPick', (r: WorktreeRepo) => r.cherryPick('--no-verify')],
      ['revert', (r: WorktreeRepo) => r.revert('--no-verify')],
      ['revParse', (r: WorktreeRepo) => r.revParse('--git-dir')],
      ['mv', (r: WorktreeRepo) => r.mv('--force', 'x')],
    ])('%s rejects an option-like operand', async (_name, call) => {
      await expectRejected(() => call(repo));
    });

    it.each([
      ['branch.rename', (r: WorktreeRepo) => r.branch.rename('main', '--force')],
      ['checkout startPoint', (r: WorktreeRepo) => r.checkout('x', { startPoint: '--orphan=y' })],
      ['switch startPoint', (r: WorktreeRepo) => r.switch('x', { startPoint: '--orphan=y' })],
      ['tag.list pattern', (r: WorktreeRepo) => r.tag.list({ pattern: '--contains=HEAD' })],
      ['remote.rename', (r: WorktreeRepo) => r.remote.rename('origin', '--progress')],
      ['remote.update', (r: WorktreeRepo) => r.remote.update(['--prune'])],
      ['remote.setBranches', (r: WorktreeRepo) => r.remote.setBranches('origin', ['--add'])],
      ['worktree.add', (r: WorktreeRepo) => r.worktree.add('--detach')],
      ['submodule.deinit', (r: WorktreeRepo) => r.submodule.deinit('--all')],
      ['lfs.preUpload remote', (r: WorktreeRepo) => r.lfsExtra.preUpload({ remote: '--dry-run' })],
      ['lfs.preUpload oids', (r: WorktreeRepo) => r.lfsExtra.preUpload({ oids: ['--dry-run'] })],
      ['lfs.preDownload remote', (r: WorktreeRepo) => r.lfsExtra.preDownload({ remote: '--all' })],
      ['lfs.preDownload ref', (r: WorktreeRepo) => r.lfsExtra.preDownload({ ref: '--all' })],
    ])('%s rejects an option-like operand', async (_name, call) => {
      await expectRejected(() => call(repo));
    });

    it('config APIs reject an option-like key', async () => {
      await expectRejected(() => repo.config.setRaw('--file=/tmp/x', 'value'));
      await expectRejected(() => repo.config.getRaw(`--file=${marker}`));
      await expectRejected(() => repo.config.unsetRaw('--global'));
      await expectRejected(() => git.config.setRaw('--file=/tmp/x', 'value'));
      await expectRejected(() => git.config.getRaw(`--file=${marker}`));
    });
  });

  describe('legitimate values still work', () => {
    it('config.setRaw stores a value that starts with "-"', async () => {
      await repo.config.setRaw('test.number', '-1');
      expect(await repo.config.getRaw('test.number')).toBe('-1');
    });

    it('accepts special operands that do not start with an option prefix', async () => {
      const initial = await repo.branch.current();
      await repo.branch.create('side');
      await repo.switch('side');
      await repo.switch('-');
      expect(await repo.branch.current()).toBe(initial);
      await repo.switch('@{-1}');
      expect(await repo.branch.current()).toBe('side');
      await repo.fetch({ remote: 'origin', refspec: '+refs/heads/*:refs/remotes/origin/*' });
      await repo.fetch({ remote: 'origin', refspec: ['HEAD', '^refs/heads/none'] });
    });

    it('fetch with a normal remote and refspec succeeds', async () => {
      await repo.fetch({ remote: 'origin', refspec: 'HEAD' });
    });
  });
});

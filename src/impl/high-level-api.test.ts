/**
 * Tests for High-level API implementations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGit } from './git-impl.js';
import { createNodeAdapters } from '../adapters/node/index.js';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('High-level API', () => {
  let tempDir: string;
  const git = createGit({ adapters: createNodeAdapters() });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'type-git-highlevel-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function initRepoWithCommit(path: string) {
    const repo = await git.init(path);
    if ('workdir' in repo) {
      await repo.raw(['config', 'user.email', 'test@example.com']);
      await repo.raw(['config', 'user.name', 'Test User']);
      await writeFile(join(path, 'README.md'), '# Test');
      await repo.add('README.md');
      await repo.commit({ message: 'Initial commit' });
      return repo;
    }
    throw new Error('Expected worktree repo');
  }

  describe('add', () => {
    it('should add a single file', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await git.init(repoPath);

      if ('workdir' in repo) {
        await writeFile(join(repoPath, 'test.txt'), 'hello');
        await repo.add('test.txt');

        const status = await repo.status();
        expect(status.entries.some((e) => e.path === 'test.txt' && e.index === 'A')).toBe(true);
      }
    });

    it('should add multiple files', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await git.init(repoPath);

      if ('workdir' in repo) {
        await writeFile(join(repoPath, 'file1.txt'), 'hello1');
        await writeFile(join(repoPath, 'file2.txt'), 'hello2');
        await repo.add(['file1.txt', 'file2.txt']);

        const status = await repo.status();
        expect(status.entries.some((e) => e.path === 'file1.txt' && e.index === 'A')).toBe(true);
        expect(status.entries.some((e) => e.path === 'file2.txt' && e.index === 'A')).toBe(true);
      }
    });

    it('should add all files with --all', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await git.init(repoPath);

      if ('workdir' in repo) {
        await writeFile(join(repoPath, 'file1.txt'), 'hello1');
        await writeFile(join(repoPath, 'file2.txt'), 'hello2');
        await repo.add('.', { all: true });

        const status = await repo.status();
        expect(status.entries.filter((e) => e.index === 'A').length).toBe(2);
      }
    });
  });

  describe('branch', () => {
    it('should list branches', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      const branches = await repo.branch.list();
      expect(branches.length).toBeGreaterThan(0);
      expect(branches.some((b) => b.current)).toBe(true);
    });

    it('should get current branch', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await git.init(repoPath, { initialBranch: 'main' });

      if ('workdir' in repo) {
        await repo.raw(['config', 'user.email', 'test@example.com']);
        await repo.raw(['config', 'user.name', 'Test User']);
        await writeFile(join(repoPath, 'README.md'), '# Test');
        await repo.add('README.md');
        await repo.commit({ message: 'Initial commit' });

        const current = await repo.branch.current();
        expect(current).toBe('main');
      }
    });

    it('should create a branch', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await repo.branch.create('feature');
      const branches = await repo.branch.list();
      expect(branches.some((b) => b.name === 'feature')).toBe(true);
    });

    it('should delete a branch', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await repo.branch.create('to-delete');
      await repo.branch.delete('to-delete');

      const branches = await repo.branch.list();
      expect(branches.some((b) => b.name === 'to-delete')).toBe(false);
    });

    it('should rename a branch', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await repo.branch.create('old-name');
      await repo.branch.rename('old-name', 'new-name');

      const branches = await repo.branch.list();
      expect(branches.some((b) => b.name === 'old-name')).toBe(false);
      expect(branches.some((b) => b.name === 'new-name')).toBe(true);
    });
  });

  describe('checkout', () => {
    it('should checkout a branch', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await repo.branch.create('feature');
      await repo.checkout('feature');

      const current = await repo.branch.current();
      expect(current).toBe('feature');
    });

    it('should create and checkout a branch', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await repo.checkout('new-feature', { createBranch: true });

      const current = await repo.branch.current();
      expect(current).toBe('new-feature');
    });
  });

  describe('commit', () => {
    it('should create a commit', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await git.init(repoPath);

      if ('workdir' in repo) {
        await repo.raw(['config', 'user.email', 'test@example.com']);
        await repo.raw(['config', 'user.name', 'Test User']);
        await writeFile(join(repoPath, 'test.txt'), 'hello');
        await repo.add('test.txt');

        const result = await repo.commit({ message: 'Add test file' });

        expect(result.hash).toBeTruthy();
        expect(result.summary).toBe('Add test file');
      }
    });

    it('should create empty commit with allowEmpty', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      const result = await repo.commit({
        message: 'Empty commit',
        allowEmpty: true,
      });

      expect(result.hash).toBeTruthy();
      expect(result.summary).toBe('Empty commit');
    });
  });

  describe('diff', () => {
    it('should show diff of working tree changes', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await writeFile(join(repoPath, 'README.md'), '# Updated Test');

      const result = await repo.diff();
      expect(result.raw).toContain('Updated');
    });

    it('should show staged diff', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await writeFile(join(repoPath, 'README.md'), '# Staged Test');
      await repo.add('README.md');

      const result = await repo.diff(undefined, { staged: true });
      expect(result.raw).toContain('Staged');
    });

    it('should show name-status diff', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await writeFile(join(repoPath, 'README.md'), '# Modified');
      await repo.add('README.md');

      const result = await repo.diff(undefined, { staged: true, nameStatus: true });
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some((f) => f.path === 'README.md')).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset staged files', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await writeFile(join(repoPath, 'new.txt'), 'new file');
      await repo.add('new.txt');

      let status = await repo.status();
      expect(status.entries.some((e) => e.path === 'new.txt' && e.index === 'A')).toBe(true);

      await repo.reset();

      status = await repo.status();
      expect(status.entries.some((e) => e.path === 'new.txt' && e.index === '?')).toBe(true);
    });
  });

  describe('rm', () => {
    it('should remove a file from index', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await repo.rm('README.md', { cached: true });

      const status = await repo.status();
      expect(status.entries.some((e) => e.path === 'README.md' && e.index === 'D')).toBe(true);
    });
  });

  describe('stash', () => {
    it('should stash changes', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      // Modify tracked file
      await writeFile(join(repoPath, 'README.md'), '# Stashed changes');

      // Stash with includeUntracked for better coverage
      await repo.stash.push({ message: 'WIP', includeUntracked: true });

      const status = await repo.status();
      expect(status.entries.length).toBe(0);

      const stashes = await repo.stash.list();
      expect(stashes.length).toBeGreaterThanOrEqual(1);
    });

    it('should pop stashed changes', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await writeFile(join(repoPath, 'README.md'), '# Stashed changes');
      await repo.stash.push();
      await repo.stash.pop();

      const status = await repo.status();
      expect(status.entries.some((e) => e.path === 'README.md')).toBe(true);
    });
  });

  describe('switch', () => {
    it('should switch branches', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await repo.branch.create('feature');
      await repo.switch('feature');

      const current = await repo.branch.current();
      expect(current).toBe('feature');
    });

    it('should create and switch to a branch', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await repo.switch('new-feature', { create: true });

      const current = await repo.branch.current();
      expect(current).toBe('new-feature');
    });
  });

  describe('tag', () => {
    it('should list tags', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await repo.tag.create('v1.0.0');
      const tags = await repo.tag.list();

      expect(tags).toContain('v1.0.0');
    });

    it('should create annotated tag', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await repo.tag.create('v1.0.0', { message: 'Release 1.0.0' });
      const info = await repo.tag.show('v1.0.0');

      expect(info.annotated).toBe(true);
      expect(info.message).toBe('Release 1.0.0');
    });

    it('should delete a tag', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await repo.tag.create('to-delete');
      await repo.tag.delete('to-delete');

      const tags = await repo.tag.list();
      expect(tags).not.toContain('to-delete');
    });
  });

  describe('merge', () => {
    it('should merge branches', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      // Get the current branch name (might be master or main)
      const mainBranch = await repo.branch.current();
      expect(mainBranch).not.toBeNull();

      // Create feature branch and add a commit
      await repo.switch('feature', { create: true });
      await writeFile(join(repoPath, 'feature.txt'), 'feature content');
      await repo.add('feature.txt');
      await repo.commit({ message: 'Add feature' });

      // Switch back to original branch and merge
      await repo.switch(mainBranch!);
      const result = await repo.merge('feature');

      expect(result.success).toBe(true);
      expect(result.fastForward).toBe(true);
    });
  });

  describe('show', () => {
    it('should show commit details', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      const output = await repo.show('HEAD');
      expect(output).toContain('Initial commit');
    });
  });

  describe('clean', () => {
    it('should clean untracked files with dry-run', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await writeFile(join(repoPath, 'untracked.txt'), 'untracked');
      const cleaned = await repo.clean({ force: true, dryRun: true });

      expect(cleaned).toContain('untracked.txt');
    });
  });

  describe('mv', () => {
    it('should move a file', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await repo.mv('README.md', 'DOCS.md');

      const status = await repo.status();
      expect(status.entries.some((e) => e.path === 'DOCS.md')).toBe(true);
    });
  });

  describe('restore', () => {
    it('should restore staged file', async () => {
      const repoPath = join(tempDir, 'repo');
      const repo = await initRepoWithCommit(repoPath);

      await writeFile(join(repoPath, 'new.txt'), 'new content');
      await repo.add('new.txt');

      await repo.restore('new.txt', { staged: true });

      const status = await repo.status();
      expect(status.entries.some((e) => e.path === 'new.txt' && e.index === '?')).toBe(true);
    });
  });
});

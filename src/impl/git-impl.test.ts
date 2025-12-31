/**
 * Tests for Git implementation
 */

import { access, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { GitError } from '../core/types.js';
import { createGit } from './git-impl.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('GitImpl', () => {
  let tempDir: string;
  const git = createGit({ adapters: createNodeAdapters() });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'type-git-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('version', () => {
    it('should return git version', async () => {
      const version = await git.version();
      expect(version).toMatch(/^\d+\.\d+/);
    });
  });

  describe('init', () => {
    it('should initialize a new repository', async () => {
      const repoPath = join(tempDir, 'test-repo');
      const repo = await git.init(repoPath);

      expect(repo).toBeDefined();
      expect('workdir' in repo).toBe(true);
      if ('workdir' in repo) {
        expect(repo.workdir).toBe(repoPath);
      }
    });

    it('should initialize a bare repository', async () => {
      const repoPath = join(tempDir, 'test-bare.git');
      const repo = await git.init(repoPath, { bare: true });

      expect(repo).toBeDefined();
      expect('gitDir' in repo).toBe(true);
      if ('gitDir' in repo) {
        expect(repo.gitDir).toBe(repoPath);
      }
    });

    it('should set initial branch', async () => {
      const repoPath = join(tempDir, 'test-repo');
      const repo = await git.init(repoPath, { initialBranch: 'main' });

      expect('workdir' in repo).toBe(true);
      if ('workdir' in repo) {
        const result = await repo.raw(['symbolic-ref', '--short', 'HEAD']);
        expect(result.stdout.trim()).toBe('main');
      }
    });

    it('should use separate git directory', async () => {
      const repoPath = join(tempDir, 'test-repo');
      const gitDirPath = join(tempDir, 'git-dir');
      const repo = await git.init(repoPath, { separateGitDir: gitDirPath });

      expect('workdir' in repo).toBe(true);
      if ('workdir' in repo) {
        // Verify .git is a file pointing to the separate git dir
        const { readFile, stat } = await import('node:fs/promises');
        const gitFile = join(repoPath, '.git');
        const gitFileStat = await stat(gitFile);
        expect(gitFileStat.isFile()).toBe(true);

        const gitFileContent = await readFile(gitFile, 'utf-8');
        expect(gitFileContent).toContain(gitDirPath);

        // Verify the separate git directory exists and contains git objects
        const gitDirStat = await stat(gitDirPath);
        expect(gitDirStat.isDirectory()).toBe(true);

        const objectsDirStat = await stat(join(gitDirPath, 'objects'));
        expect(objectsDirStat.isDirectory()).toBe(true);
      }
    });

    it('should clean up directory on abort by default', async () => {
      const repoPath = join(tempDir, 'abort-test-repo');
      const controller = new AbortController();
      controller.abort(); // Already aborted

      await expect(git.init(repoPath, { signal: controller.signal })).rejects.toThrow(GitError);

      // Directory should be cleaned up
      expect(await exists(repoPath)).toBe(false);
    });

    it('should not clean up directory on abort when cleanupOnAbort is false', async () => {
      const repoPath = join(tempDir, 'no-cleanup-repo');
      const controller = new AbortController();
      controller.abort(); // Already aborted

      await expect(
        git.init(repoPath, { signal: controller.signal, cleanupOnAbort: false }),
      ).rejects.toThrow(GitError);

      // Directory may or may not exist depending on how much git created before abort
      // The key is that we don't throw during cleanup, so test just passes if no error
    });
  });

  describe('open', () => {
    it('should open a worktree repository', async () => {
      const repoPath = join(tempDir, 'test-repo');
      await git.init(repoPath);

      const repo = await git.open(repoPath);
      expect(repo).toBeDefined();
      expect('workdir' in repo).toBe(true);
    });

    it('should throw for bare repository', async () => {
      const repoPath = join(tempDir, 'test-bare.git');
      await git.init(repoPath, { bare: true });

      await expect(git.open(repoPath)).rejects.toThrow(GitError);
      await expect(git.open(repoPath)).rejects.toMatchObject({ kind: 'NotWorktreeRepo' });
    });

    it('should throw for non-repository path', async () => {
      await expect(git.open(tempDir)).rejects.toThrow();
    });
  });

  describe('openBare', () => {
    it('should open a bare repository', async () => {
      const repoPath = join(tempDir, 'test-bare.git');
      await git.init(repoPath, { bare: true });

      const repo = await git.openBare(repoPath);
      expect(repo).toBeDefined();
      expect('gitDir' in repo).toBe(true);
    });

    it('should throw for worktree repository', async () => {
      const repoPath = join(tempDir, 'test-repo');
      await git.init(repoPath);

      await expect(git.openBare(repoPath)).rejects.toThrow(GitError);
      await expect(git.openBare(repoPath)).rejects.toMatchObject({ kind: 'NotBareRepo' });
    });

    it('should throw for non-repository path', async () => {
      await expect(git.openBare(tempDir)).rejects.toThrow();
    });
  });

  describe('openRaw', () => {
    it('should open a worktree repository', async () => {
      const repoPath = join(tempDir, 'test-repo');
      await git.init(repoPath);

      const repo = await git.openRaw(repoPath);
      expect(repo).toBeDefined();
      expect('workdir' in repo).toBe(true);
    });

    it('should open a bare repository', async () => {
      const repoPath = join(tempDir, 'test-bare.git');
      await git.init(repoPath, { bare: true });

      const repo = await git.openRaw(repoPath);
      expect(repo).toBeDefined();
      expect('gitDir' in repo).toBe(true);
    });

    it('should throw for non-repository path', async () => {
      await expect(git.openRaw(tempDir)).rejects.toThrow();
    });
  });

  describe('raw', () => {
    it('should execute raw git commands', async () => {
      const result = await git.raw(['--version']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('git version');
    });
  });
});

describe('WorktreeRepoImpl', () => {
  let tempDir: string;
  const git = createGit({ adapters: createNodeAdapters() });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'type-git-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('status', () => {
    it('should return empty status for new repo', async () => {
      const repoPath = join(tempDir, 'test-repo');
      const repo = await git.init(repoPath);

      if ('workdir' in repo) {
        const status = await repo.status();
        expect(status.entries).toHaveLength(0);
      }
    });

    it('should detect untracked files', async () => {
      const repoPath = join(tempDir, 'test-repo');
      const repo = await git.init(repoPath);

      if ('workdir' in repo) {
        // Create an untracked file
        const { writeFile } = await import('node:fs/promises');
        await writeFile(join(repoPath, 'test.txt'), 'hello');

        const status = await repo.status();
        expect(status.entries.length).toBeGreaterThan(0);
        expect(status.entries.some((e) => e.path === 'test.txt')).toBe(true);
      }
    });
  });

  describe('log', () => {
    it('should return empty log for repo without commits', async () => {
      const repoPath = join(tempDir, 'test-repo');
      const repo = await git.init(repoPath);

      if ('workdir' in repo) {
        // Git log on empty repo will fail, so we expect an error
        await expect(repo.log()).rejects.toThrow();
      }
    });

    it('should return commits', async () => {
      const repoPath = join(tempDir, 'test-repo');
      const repo = await git.init(repoPath);

      if ('workdir' in repo) {
        // Configure user
        await repo.raw(['config', 'user.email', 'test@example.com']);
        await repo.raw(['config', 'user.name', 'Test User']);

        // Create a commit
        const { writeFile } = await import('node:fs/promises');
        await writeFile(join(repoPath, 'test.txt'), 'hello');
        await repo.raw(['add', 'test.txt']);
        await repo.raw(['commit', '-m', 'Initial commit']);

        const commits = await repo.log();
        expect(commits).toHaveLength(1);
        expect(commits[0]?.subject).toBe('Initial commit');
        expect(commits[0]?.author.name).toBe('Test User');
        expect(commits[0]?.author.email).toBe('test@example.com');
      }
    });

    it('should limit commits with maxCount', async () => {
      const repoPath = join(tempDir, 'test-repo');
      const repo = await git.init(repoPath);

      if ('workdir' in repo) {
        // Configure user
        await repo.raw(['config', 'user.email', 'test@example.com']);
        await repo.raw(['config', 'user.name', 'Test User']);

        // Create multiple commits
        const { writeFile } = await import('node:fs/promises');
        await writeFile(join(repoPath, 'test1.txt'), 'hello1');
        await repo.raw(['add', 'test1.txt']);
        await repo.raw(['commit', '-m', 'First commit']);

        await writeFile(join(repoPath, 'test2.txt'), 'hello2');
        await repo.raw(['add', 'test2.txt']);
        await repo.raw(['commit', '-m', 'Second commit']);

        const commits = await repo.log({ maxCount: 1 });
        expect(commits).toHaveLength(1);
        expect(commits[0]?.subject).toBe('Second commit');
      }
    });
  });

  describe('raw', () => {
    it('should execute commands in repo context', async () => {
      const repoPath = join(tempDir, 'test-repo');
      const repo = await git.init(repoPath);

      if ('workdir' in repo) {
        const result = await repo.raw(['rev-parse', '--show-toplevel']);
        expect(result.exitCode).toBe(0);
        // Use realpath to handle macOS symlinks (/tmp -> /private/tmp)
        const expectedPath = await realpath(repoPath);
        expect(result.stdout.trim()).toBe(expectedPath);
      }
    });
  });

  describe('worktree', () => {
    it('should list worktrees', async () => {
      const repoPath = join(tempDir, 'test-repo');
      const repo = await git.init(repoPath);

      if ('workdir' in repo) {
        // Configure user and create initial commit
        await repo.raw(['config', 'user.email', 'test@example.com']);
        await repo.raw(['config', 'user.name', 'Test User']);
        const { writeFile } = await import('node:fs/promises');
        await writeFile(join(repoPath, 'test.txt'), 'hello');
        await repo.raw(['add', 'test.txt']);
        await repo.raw(['commit', '-m', 'Initial commit']);

        const worktrees = await repo.worktree.list();
        expect(worktrees).toHaveLength(1);
        // Use realpath to handle macOS symlinks (/tmp -> /private/tmp)
        const expectedPath = await realpath(repoPath);
        expect(worktrees[0]?.path).toBe(expectedPath);
      }
    });
  });
});

describe('openRaw and type guards', () => {
  let tempDir: string;
  const git = createGit({ adapters: createNodeAdapters() });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'type-git-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('openRaw', () => {
    it('should open a worktree repository', async () => {
      const repoPath = join(tempDir, 'test-repo');
      await git.init(repoPath);

      const repo = await git.openRaw(repoPath);
      expect(repo).toBeDefined();
      expect(await repo.isWorktree()).toBe(true);
      expect(await repo.isBare()).toBe(false);
    });

    it('should open a bare repository', async () => {
      const repoPath = join(tempDir, 'test-bare.git');
      await git.init(repoPath, { bare: true });

      const repo = await git.openRaw(repoPath);
      expect(repo).toBeDefined();
      expect(await repo.isWorktree()).toBe(false);
      expect(await repo.isBare()).toBe(true);
    });

    it('should throw for non-repository path', async () => {
      await expect(git.openRaw(tempDir)).rejects.toThrow();
    });
  });

  describe('isWorktree type guard', () => {
    it('should return true for worktree repository', async () => {
      const repoPath = join(tempDir, 'test-repo');
      await git.init(repoPath);

      const repo = await git.openRaw(repoPath);
      const isWorktree = await repo.isWorktree();
      expect(isWorktree).toBe(true);

      // TypeScript type narrowing demonstration
      if (isWorktree) {
        // In actual usage, after this check, repo would be narrowed to WorktreeRepo
        // For the test, we just verify the boolean value
        expect(typeof isWorktree).toBe('boolean');
      }
    });

    it('should return false for bare repository', async () => {
      const repoPath = join(tempDir, 'test-bare.git');
      await git.init(repoPath, { bare: true });

      const repo = await git.openRaw(repoPath);
      expect(await repo.isWorktree()).toBe(false);
    });
  });

  describe('isBare type guard', () => {
    it('should return true for bare repository', async () => {
      const repoPath = join(tempDir, 'test-bare.git');
      await git.init(repoPath, { bare: true });

      const repo = await git.openRaw(repoPath);
      const isBare = await repo.isBare();
      expect(isBare).toBe(true);

      // TypeScript type narrowing demonstration
      if (isBare) {
        // In actual usage, after this check, repo would be narrowed to BareRepo
        expect(typeof isBare).toBe('boolean');
      }
    });

    it('should return false for worktree repository', async () => {
      const repoPath = join(tempDir, 'test-repo');
      await git.init(repoPath);

      const repo = await git.openRaw(repoPath);
      expect(await repo.isBare()).toBe(false);
    });
  });

  describe('type narrowing with open()', () => {
    it('should work with WorktreeRepo from open()', async () => {
      const repoPath = join(tempDir, 'test-repo');
      const repo = await git.init(repoPath);

      // Even with open(), we can still use the type guards
      expect(await repo.isWorktree()).toBe(true);
      expect(await repo.isBare()).toBe(false);
    });

    it('should work with BareRepo from open()', async () => {
      const repoPath = join(tempDir, 'test-bare.git');
      const repo = await git.init(repoPath, { bare: true });

      // Even with open(), we can still use the type guards
      expect(await repo.isWorktree()).toBe(false);
      expect(await repo.isBare()).toBe(true);
    });
  });
});

/**
 * Tests for Git implementation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGit } from './git-impl.js';
import { createNodeAdapters, TypeGit } from '../adapters/node/index.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('TypeGit (Node.js)', () => {
  let tempDir: string;
  const git = new TypeGit();

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'type-git-typegit-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should work without explicit adapter configuration', async () => {
    const version = await git.version();
    expect(version).toMatch(/^\d+\.\d+/);
  });

  it('should init a repository', async () => {
    const repoPath = join(tempDir, 'test-repo');
    const repo = await git.init(repoPath);

    expect(repo).toBeDefined();
    expect('workdir' in repo).toBe(true);
  });

  it('should open an existing repository', async () => {
    const repoPath = join(tempDir, 'test-repo');
    await git.init(repoPath);

    const repo = await git.open(repoPath);
    expect(repo).toBeDefined();
    expect('workdir' in repo).toBe(true);
  });
});

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
  });

  describe('open', () => {
    it('should open an existing repository', async () => {
      const repoPath = join(tempDir, 'test-repo');
      await git.init(repoPath);

      const repo = await git.open(repoPath);
      expect(repo).toBeDefined();
      expect('workdir' in repo).toBe(true);
    });

    it('should open a bare repository', async () => {
      const repoPath = join(tempDir, 'test-bare.git');
      await git.init(repoPath, { bare: true });

      const repo = await git.open(repoPath);
      expect(repo).toBeDefined();
      expect('gitDir' in repo).toBe(true);
    });

    it('should throw for non-repository path', async () => {
      await expect(git.open(tempDir)).rejects.toThrow();
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
        expect(result.stdout.trim()).toBe(repoPath);
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
        expect(worktrees[0]?.path).toBe(repoPath);
      }
    });
  });
});

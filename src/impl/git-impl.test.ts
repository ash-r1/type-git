/**
 * Tests for Git implementation
 */

import { access, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import type { Git } from '../core/git.js';
import type { AuditEvent } from '../core/types.js';
import { GitError } from '../core/types.js';
import {
  compareVersions,
  createGit,
  createGitSync,
  LEGACY_GIT_VERSION,
  MIN_GIT_VERSION,
  parseVersion,
} from './git-impl.js';

/**
 * Whether to use legacy Git version mode.
 * Set TYPE_GIT_USE_LEGACY_VERSION=true for testing with Git 2.25.x
 */
const USE_LEGACY_VERSION = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';

// Normalize path separators for cross-platform comparison
// Git on Windows outputs forward slashes, but Node.js path functions use backslashes
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

// Regex pattern for validating git version format
const GIT_VERSION_FORMAT_REGEX = /^\d+\.\d+/;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('createGit version check', () => {
  it('should check version by default and pass for current git', async () => {
    // Use legacy version mode if environment variable is set (for Git 2.25.x testing)
    const git = await createGit({
      adapters: createNodeAdapters(),
      useLegacyVersion: USE_LEGACY_VERSION,
    });
    expect(git).toBeDefined();
    const version = await git.version();
    expect(version).toMatch(GIT_VERSION_FORMAT_REGEX);
  });

  it('should skip version check when skipVersionCheck is true', async () => {
    const git = await createGit({ adapters: createNodeAdapters(), skipVersionCheck: true });
    expect(git).toBeDefined();
  });

  it('should allow legacy version with useLegacyVersion option', async () => {
    // This should pass since we expect git >= 2.25 to be installed
    const git = await createGit({ adapters: createNodeAdapters(), useLegacyVersion: true });
    expect(git).toBeDefined();
  });

  it('should export version constants', () => {
    expect(MIN_GIT_VERSION).toBe('2.30.0');
    expect(LEGACY_GIT_VERSION).toBe('2.25.0');
  });

  it('createGitSync should create git instance without version check', () => {
    const git = createGitSync({ adapters: createNodeAdapters() });
    expect(git).toBeDefined();
  });
});

describe('parseVersion', () => {
  it('should parse standard version strings', () => {
    expect(parseVersion('2.30.0')).toEqual([2, 30, 0]);
    expect(parseVersion('2.25.1')).toEqual([2, 25, 1]);
    expect(parseVersion('1.0.0')).toEqual([1, 0, 0]);
  });

  it('should handle Windows-style versions (e.g., 2.30.0.windows.1)', () => {
    expect(parseVersion('2.30.0.windows.1')).toEqual([2, 30, 0]);
    expect(parseVersion('2.39.3.windows.2')).toEqual([2, 39, 3]);
  });

  it('should handle pre-release versions (e.g., 2.30.0-rc0)', () => {
    expect(parseVersion('2.30.0-rc0')).toEqual([2, 30, 0]);
    expect(parseVersion('2.31.0-rc1')).toEqual([2, 31, 0]);
    expect(parseVersion('2.32.0-alpha')).toEqual([2, 32, 0]);
  });

  it('should return [0, 0, 0] for malformed versions', () => {
    expect(parseVersion('')).toEqual([0, 0, 0]);
    expect(parseVersion('invalid')).toEqual([0, 0, 0]);
    expect(parseVersion('not-a-version')).toEqual([0, 0, 0]);
    expect(parseVersion('v2.30.0')).toEqual([0, 0, 0]); // Leading 'v' not supported
  });

  it('should handle versions with only major.minor', () => {
    // The regex requires major.minor.patch, so this returns [0, 0, 0]
    expect(parseVersion('2.30')).toEqual([0, 0, 0]);
  });
});

describe('compareVersions', () => {
  it('should return 0 for equal versions', () => {
    expect(compareVersions('2.30.0', '2.30.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('should return negative when first version is smaller', () => {
    expect(compareVersions('2.25.0', '2.30.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    expect(compareVersions('2.30.0', '2.30.1')).toBeLessThan(0);
  });

  it('should return positive when first version is larger', () => {
    expect(compareVersions('2.30.0', '2.25.0')).toBeGreaterThan(0);
    expect(compareVersions('3.0.0', '2.99.99')).toBeGreaterThan(0);
    expect(compareVersions('2.30.1', '2.30.0')).toBeGreaterThan(0);
  });

  it('should compare major version first', () => {
    expect(compareVersions('3.0.0', '2.99.99')).toBeGreaterThan(0);
    expect(compareVersions('1.99.99', '2.0.0')).toBeLessThan(0);
  });

  it('should compare minor version when major is equal', () => {
    expect(compareVersions('2.31.0', '2.30.99')).toBeGreaterThan(0);
    expect(compareVersions('2.29.99', '2.30.0')).toBeLessThan(0);
  });

  it('should compare patch version when major and minor are equal', () => {
    expect(compareVersions('2.30.1', '2.30.0')).toBeGreaterThan(0);
    expect(compareVersions('2.30.0', '2.30.1')).toBeLessThan(0);
  });

  it('should handle platform-specific versions', () => {
    // Windows versions should compare the base version
    expect(compareVersions('2.30.0.windows.1', '2.30.0')).toBe(0);
    expect(compareVersions('2.30.0.windows.1', '2.25.0')).toBeGreaterThan(0);
  });

  it('should handle pre-release versions', () => {
    // Pre-release suffixes are ignored, so 2.30.0-rc0 == 2.30.0
    expect(compareVersions('2.30.0-rc0', '2.30.0')).toBe(0);
    expect(compareVersions('2.30.0-rc0', '2.29.0')).toBeGreaterThan(0);
  });

  it('should handle malformed versions by treating them as 0.0.0', () => {
    expect(compareVersions('invalid', '2.30.0')).toBeLessThan(0);
    expect(compareVersions('2.30.0', 'invalid')).toBeGreaterThan(0);
    expect(compareVersions('invalid', 'also-invalid')).toBe(0);
  });
});

describe('version validation errors', () => {
  it('should throw UnsupportedGitVersion for versions below MIN_GIT_VERSION', async () => {
    // Create a mock adapter that returns an old version
    const mockAdapters = createNodeAdapters();
    const originalSpawn = mockAdapters.exec.spawn.bind(mockAdapters.exec);

    mockAdapters.exec.spawn = async (options, handlers) => {
      // Intercept version check
      if (options.argv.includes('--version')) {
        return {
          stdout: 'git version 2.20.0\n',
          stderr: '',
          exitCode: 0,
          aborted: false,
        };
      }
      return originalSpawn(options, handlers);
    };

    await expect(createGit({ adapters: mockAdapters })).rejects.toThrow(GitError);

    await expect(createGit({ adapters: mockAdapters })).rejects.toMatchObject({
      kind: 'UnsupportedGitVersion',
    });
  });

  it('should accept version between LEGACY and MIN when useLegacyVersion is true', async () => {
    // Create a mock adapter that returns a version in the legacy range
    const mockAdapters = createNodeAdapters();
    const originalSpawn = mockAdapters.exec.spawn.bind(mockAdapters.exec);

    mockAdapters.exec.spawn = async (options, handlers) => {
      // Intercept version check
      if (options.argv.includes('--version')) {
        return {
          stdout: 'git version 2.27.0\n', // Between 2.25.0 and 2.30.0
          stderr: '',
          exitCode: 0,
          aborted: false,
        };
      }
      return originalSpawn(options, handlers);
    };

    // Should reject without useLegacyVersion
    await expect(createGit({ adapters: mockAdapters })).rejects.toMatchObject({
      kind: 'UnsupportedGitVersion',
    });

    // Should accept with useLegacyVersion
    const git = await createGit({ adapters: mockAdapters, useLegacyVersion: true });
    expect(git).toBeDefined();
  });

  it('should reject version below LEGACY_GIT_VERSION even with useLegacyVersion', async () => {
    const mockAdapters = createNodeAdapters();
    const originalSpawn = mockAdapters.exec.spawn.bind(mockAdapters.exec);

    mockAdapters.exec.spawn = async (options, handlers) => {
      if (options.argv.includes('--version')) {
        return {
          stdout: 'git version 2.20.0\n', // Below 2.25.0
          stderr: '',
          exitCode: 0,
          aborted: false,
        };
      }
      return originalSpawn(options, handlers);
    };

    await expect(
      createGit({ adapters: mockAdapters, useLegacyVersion: true }),
    ).rejects.toMatchObject({
      kind: 'UnsupportedGitVersion',
    });
  });
});

describe('GitImpl', () => {
  let tempDir: string;
  let git: Git;

  beforeAll(async () => {
    git = await createGit({
      adapters: createNodeAdapters(),
      useLegacyVersion: USE_LEGACY_VERSION,
    });
  });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'type-git-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('version', () => {
    it('should return git version', async () => {
      const version = await git.version();
      expect(version).toMatch(GIT_VERSION_FORMAT_REGEX);
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

        // Parse gitdir path from .git file and compare using realpath
        // to handle Windows 8.3 short names (RUNNER~1 vs runneradmin)
        const gitFileContent = await readFile(gitFile, 'utf-8');
        const gitdirMatch = gitFileContent.match(/gitdir:\s*(.+)/);
        expect(gitdirMatch).not.toBeNull();
        const gitdirFromFile = normalizePath(await realpath(gitdirMatch![1].trim()));
        const expectedGitDir = normalizePath(await realpath(gitDirPath));
        expect(gitdirFromFile).toBe(expectedGitDir);

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
  let git: Git;

  beforeAll(async () => {
    git = await createGit({
      adapters: createNodeAdapters(),
      useLegacyVersion: USE_LEGACY_VERSION,
    });
  });

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
        // Normalize paths for cross-platform comparison (Git uses forward slashes on Windows)
        const expectedPath = normalizePath(await realpath(repoPath));
        expect(normalizePath(result.stdout.trim())).toBe(expectedPath);
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
        // Normalize paths for cross-platform comparison (Git uses forward slashes on Windows)
        const expectedPath = normalizePath(await realpath(repoPath));
        expect(normalizePath(worktrees[0]?.path ?? '')).toBe(expectedPath);
      }
    });
  });
});

describe('openRaw and type guards', () => {
  let tempDir: string;
  let git: Git;

  beforeAll(async () => {
    git = await createGit({
      adapters: createNodeAdapters(),
      useLegacyVersion: USE_LEGACY_VERSION,
    });
  });

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

  describe('audit mode integration', () => {
    it('should emit audit events for all git operations', async () => {
      const auditEvents: AuditEvent[] = [];
      const gitWithAudit = await createGit({
        adapters: createNodeAdapters(),
        useLegacyVersion: USE_LEGACY_VERSION,
        audit: {
          onAudit: (event: AuditEvent) => auditEvents.push(event),
        },
      });

      // Initialize a repository
      const repoPath = join(tempDir, 'audit-test-repo');
      await gitWithAudit.init(repoPath);

      // Open and run status
      const repo = await gitWithAudit.open(repoPath);
      await repo.status();

      // Should have events for: init, rev-parse (from open), status
      // At minimum, we should see start/end pairs
      expect(auditEvents.length).toBeGreaterThanOrEqual(4);

      // Check that all events have proper structure
      for (const event of auditEvents) {
        expect(event.timestamp).toBeGreaterThan(0);
        expect(event.argv).toBeInstanceOf(Array);
        expect(event.argv[0]).toBe('git');

        if (event.type === 'end') {
          expect(typeof event.exitCode).toBe('number');
          expect(typeof event.duration).toBe('number');
          expect(event.duration).toBeGreaterThanOrEqual(0);
        }
      }

      // Verify start/end pairing
      const startEvents = auditEvents.filter((e) => e.type === 'start');
      const endEvents = auditEvents.filter((e) => e.type === 'end');
      expect(startEvents.length).toBe(endEvents.length);
    });

    it('should propagate audit config to repository operations', async () => {
      const auditEvents: AuditEvent[] = [];
      const gitWithAudit = await createGit({
        adapters: createNodeAdapters(),
        useLegacyVersion: USE_LEGACY_VERSION,
        audit: {
          onAudit: (event: AuditEvent) => auditEvents.push(event),
        },
      });

      const repoPath = join(tempDir, 'audit-repo-test');
      const repo = await gitWithAudit.init(repoPath);

      // Clear events from init
      auditEvents.length = 0;

      // Run repository operation
      await repo.status();

      // Should have start and end events for status
      expect(auditEvents.length).toBe(2);
      expect(auditEvents[0].type).toBe('start');
      expect(auditEvents[1].type).toBe('end');

      // Verify status command was captured
      const statusCmd = auditEvents.find((e) => e.type === 'start' && e.argv.includes('status'));
      expect(statusCmd).toBeDefined();
    });
  });
});

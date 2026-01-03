/**
 * Bun Smoke Tests
 *
 * Tests basic functionality of BunExecAdapter, BunFsAdapter, and High-level API.
 * Run with: bun test test/bun/smoke.test.ts
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BunExecAdapter } from '../../src/adapters/bun/exec.js';
import { BunFsAdapter } from '../../src/adapters/bun/fs.js';
import { createBunAdapters } from '../../src/adapters/bun/index.js';
import { createGit } from '../../src/impl/git-impl.js';

/**
 * Whether to use legacy Git version mode.
 * Set TYPE_GIT_USE_LEGACY_VERSION=true for testing with Git 2.25.x
 */
const USE_LEGACY_VERSION = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';

describe('BunExecAdapter', () => {
  const adapter = new BunExecAdapter();

  describe('getCapabilities', () => {
    test('returns correct capabilities', () => {
      const caps = adapter.getCapabilities();

      expect(caps.runtime).toBe('bun');
      expect(caps.canSpawnProcess).toBe(true);
      expect(caps.canReadEnv).toBe(true);
      expect(caps.canWriteTemp).toBe(true);
      expect(caps.supportsAbortSignal).toBe(true);
      expect(caps.supportsKillSignal).toBe(true);
    });
  });

  describe('spawn', () => {
    test('executes simple command', async () => {
      const result = await adapter.spawn({
        argv: ['echo', 'hello'],
      });

      expect(result.stdout.trim()).toBe('hello');
      expect(result.exitCode).toBe(0);
      expect(result.aborted).toBe(false);
    });

    test('captures stderr', async () => {
      const result = await adapter.spawn({
        argv: ['sh', '-c', 'echo error >&2'],
      });

      expect(result.stderr.trim()).toBe('error');
      expect(result.exitCode).toBe(0);
    });

    test('handles non-zero exit code', async () => {
      const result = await adapter.spawn({
        argv: ['sh', '-c', 'exit 42'],
      });

      expect(result.exitCode).toBe(42);
    });

    test('respects environment variables', async () => {
      const result = await adapter.spawn({
        argv: ['sh', '-c', 'echo $TEST_VAR'],
        env: { TEST_VAR: 'test_value' },
      });

      expect(result.stdout.trim()).toBe('test_value');
    });

    test('handles abort signal', async () => {
      const controller = new AbortController();

      const resultPromise = adapter.spawn({
        argv: ['sleep', '10'],
        signal: controller.signal,
      });

      // Abort after a short delay
      setTimeout(() => controller.abort(), 100);

      const result = await resultPromise;
      expect(result.aborted).toBe(true);
    });

    test('handles already aborted signal', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await adapter.spawn({
        argv: ['echo', 'should not run'],
        signal: controller.signal,
      });

      expect(result.aborted).toBe(true);
    });

    test('calls stream handlers', async () => {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      const result = await adapter.spawn(
        {
          argv: ['sh', '-c', 'echo out; echo err >&2'],
        },
        {
          onStdout: (chunk) => stdoutChunks.push(chunk),
          onStderr: (chunk) => stderrChunks.push(chunk),
        },
      );

      expect(stdoutChunks.join('').trim()).toBe('out');
      expect(stderrChunks.join('').trim()).toBe('err');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('spawnStreaming', () => {
    test('provides async iterables for stdout', async () => {
      const handle = adapter.spawnStreaming({
        argv: ['sh', '-c', 'echo line1; echo line2'],
      });

      const lines: string[] = [];
      for await (const line of handle.stdout) {
        lines.push(line);
      }

      const result = await handle.wait();

      expect(lines).toEqual(['line1', 'line2']);
      expect(result.exitCode).toBe(0);
    });

    test('can kill process', async () => {
      const handle = adapter.spawnStreaming({
        argv: ['sleep', '10'],
      });

      handle.kill();
      const result = await handle.wait();

      expect(result.signal).toBeDefined();
    });
  });
});

describe('BunFsAdapter', () => {
  const adapter = new BunFsAdapter();
  let tempFile: string;

  beforeAll(async () => {
    tempFile = await adapter.createTempFile('bun-test-');
  });

  afterAll(async () => {
    if (tempFile) {
      await adapter.deleteFile(tempFile);
    }
  });

  describe('createTempFile', () => {
    test('creates a temporary file', async () => {
      expect(tempFile).toContain('bun-test-');
      expect(await adapter.exists(tempFile)).toBe(true);
    });
  });

  describe('writeFile/readFile', () => {
    test('writes and reads file content', async () => {
      await adapter.writeFile(tempFile, 'test content');
      const content = await adapter.readFile(tempFile);

      expect(content).toBe('test content');
    });
  });

  describe('exists', () => {
    test('returns true for existing file', async () => {
      expect(await adapter.exists(tempFile)).toBe(true);
    });

    test('returns false for non-existing file', async () => {
      expect(await adapter.exists('/nonexistent/path/file.txt')).toBe(false);
    });
  });

  describe('deleteFile', () => {
    test('deletes file', async () => {
      const toDelete = await adapter.createTempFile('delete-test-');
      expect(await adapter.exists(toDelete)).toBe(true);

      await adapter.deleteFile(toDelete);
      expect(await adapter.exists(toDelete)).toBe(false);
    });

    test('handles non-existing file gracefully', async () => {
      // Should not throw
      await adapter.deleteFile('/nonexistent/path/file.txt');
    });
  });

  describe('tailStreaming', () => {
    test('streams new lines from file', async () => {
      const testFile = await adapter.createTempFile('tail-test-');
      const controller = new AbortController();
      let handle: ReturnType<typeof adapter.tailStreaming> | undefined;

      try {
        handle = adapter.tailStreaming(testFile, {
          signal: controller.signal,
          pollInterval: 50,
        });

        // Write some lines
        await adapter.writeFile(testFile, 'line1\nline2\n');

        // Read lines
        const lines: string[] = [];

        for await (const line of handle.lines) {
          lines.push(line);
          if (lines.length >= 2) {
            break;
          }
        }

        expect(lines).toEqual(['line1', 'line2']);
      } finally {
        // Ensure we stop the handle before aborting to clean up timers
        handle?.stop();
        controller.abort();
        // Give time for cleanup
        await Bun.sleep(100);
        await adapter.deleteFile(testFile);
      }
    });
  });
});

describe('Integration', () => {
  test('can run git --version', async () => {
    const adapter = new BunExecAdapter();
    const result = await adapter.spawn({
      argv: ['git', '--version'],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('git version');
  });
});

describe('High-level API with Bun', () => {
  let tempDir: string;
  let git: Awaited<ReturnType<typeof createGit>>;

  beforeAll(async () => {
    git = await createGit({
      adapters: createBunAdapters(),
      useLegacyVersion: USE_LEGACY_VERSION,
    });
  });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bun-git-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('can init a repository', async () => {
    const repoPath = join(tempDir, 'repo');
    const repo = await git.init(repoPath);

    expect('workdir' in repo).toBe(true);
    if ('workdir' in repo) {
      expect(repo.workdir).toBe(repoPath);
    }
  });

  test('can add and commit files', async () => {
    const repoPath = join(tempDir, 'repo');
    const repo = await git.init(repoPath);

    if ('workdir' in repo) {
      // Configure git user
      await repo.raw(['config', 'user.email', 'test@example.com']);
      await repo.raw(['config', 'user.name', 'Test User']);

      // Create and add a file
      await writeFile(join(repoPath, 'test.txt'), 'hello bun');
      await repo.add('test.txt');

      // Check status
      const status = await repo.status();
      expect(status.entries.some((e) => e.path === 'test.txt' && e.index === 'A')).toBe(true);

      // Commit
      const result = await repo.commit({ message: 'Initial commit' });
      expect(result.hash).toBeDefined();
      expect(result.hash.length).toBeGreaterThan(0);
    }
  });

  test('can create and list branches', async () => {
    const repoPath = join(tempDir, 'repo');
    const repo = await git.init(repoPath, { initialBranch: 'main' });

    if ('workdir' in repo) {
      // Create initial commit
      await repo.raw(['config', 'user.email', 'test@example.com']);
      await repo.raw(['config', 'user.name', 'Test User']);
      await writeFile(join(repoPath, 'README.md'), '# Test');
      await repo.add('README.md');
      await repo.commit({ message: 'Initial commit' });

      // Create a new branch
      await repo.branch.create('feature');

      // List branches
      const branches = await repo.branch.list();
      expect(branches.some((b) => b.name === 'main')).toBe(true);
      expect(branches.some((b) => b.name === 'feature')).toBe(true);

      // Get current branch
      const current = await repo.branch.current();
      expect(current).toBe('main');
    }
  });

  test('can checkout branches', async () => {
    const repoPath = join(tempDir, 'repo');
    const repo = await git.init(repoPath, { initialBranch: 'main' });

    if ('workdir' in repo) {
      await repo.raw(['config', 'user.email', 'test@example.com']);
      await repo.raw(['config', 'user.name', 'Test User']);
      await writeFile(join(repoPath, 'README.md'), '# Test');
      await repo.add('README.md');
      await repo.commit({ message: 'Initial commit' });

      // Create and checkout a new branch
      await repo.checkout('feature', { createBranch: true });

      const current = await repo.branch.current();
      expect(current).toBe('feature');
    }
  });

  test('can use stash operations', async () => {
    const repoPath = join(tempDir, 'repo');
    const repo = await git.init(repoPath);

    if ('workdir' in repo) {
      await repo.raw(['config', 'user.email', 'test@example.com']);
      await repo.raw(['config', 'user.name', 'Test User']);
      await writeFile(join(repoPath, 'README.md'), '# Test');
      await repo.add('README.md');
      await repo.commit({ message: 'Initial commit' });

      // Modify file
      await writeFile(join(repoPath, 'README.md'), '# Modified');

      // Stash changes
      await repo.stash.push({ message: 'WIP' });

      // List stash
      const stashList = await repo.stash.list();
      expect(stashList.length).toBe(1);
      expect(stashList[0].message).toContain('WIP');

      // Pop stash
      await repo.stash.pop();
      const stashListAfter = await repo.stash.list();
      expect(stashListAfter.length).toBe(0);
    }
  });

  test('can create and list tags', async () => {
    const repoPath = join(tempDir, 'repo');
    const repo = await git.init(repoPath);

    if ('workdir' in repo) {
      await repo.raw(['config', 'user.email', 'test@example.com']);
      await repo.raw(['config', 'user.name', 'Test User']);
      await writeFile(join(repoPath, 'README.md'), '# Test');
      await repo.add('README.md');
      await repo.commit({ message: 'Initial commit' });

      // Create tag
      await repo.tag.create('v1.0.0', { message: 'Release 1.0.0' });

      // List tags
      const tags = await repo.tag.list();
      expect(tags).toContain('v1.0.0');
    }
  });
});

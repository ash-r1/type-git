/**
 * Deno Smoke Tests
 *
 * Tests basic functionality of DenoExecAdapter, DenoFsAdapter, and High-level API.
 * Run with: deno test --allow-run --allow-read --allow-write --allow-env test/deno/smoke.test.ts
 */

import {
  assertEquals,
  assertExists,
  assert,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'https://deno.land/std@0.224.0/testing/bdd.ts';
import { DenoExecAdapter } from '../../src/adapters/deno/exec.ts';
import { DenoFsAdapter } from '../../src/adapters/deno/fs.ts';
import { createDenoAdapters } from '../../src/adapters/deno/index.ts';
import { createGit } from '../../src/impl/git-impl.ts';

describe('DenoExecAdapter', () => {
  const adapter = new DenoExecAdapter();

  describe('getCapabilities', () => {
    it('returns correct capabilities', () => {
      const caps = adapter.getCapabilities();

      assertEquals(caps.runtime, 'deno');
      assertEquals(caps.canSpawnProcess, true);
      assertEquals(caps.canReadEnv, true);
      assertEquals(caps.canWriteTemp, true);
      assertEquals(caps.supportsAbortSignal, true);
      assertEquals(caps.supportsKillSignal, true);
    });
  });

  describe('spawn', () => {
    it('executes simple command', async () => {
      const result = await adapter.spawn({
        argv: ['echo', 'hello'],
      });

      assertEquals(result.stdout.trim(), 'hello');
      assertEquals(result.exitCode, 0);
      assertEquals(result.aborted, false);
    });

    it('captures stderr', async () => {
      const result = await adapter.spawn({
        argv: ['sh', '-c', 'echo error >&2'],
      });

      assertEquals(result.stderr.trim(), 'error');
      assertEquals(result.exitCode, 0);
    });

    it('handles non-zero exit code', async () => {
      const result = await adapter.spawn({
        argv: ['sh', '-c', 'exit 42'],
      });

      assertEquals(result.exitCode, 42);
    });

    it('respects environment variables', async () => {
      const result = await adapter.spawn({
        argv: ['sh', '-c', 'echo $TEST_VAR'],
        env: { TEST_VAR: 'test_value' },
      });

      assertEquals(result.stdout.trim(), 'test_value');
    });

    it('handles abort signal', async () => {
      const controller = new AbortController();

      const resultPromise = adapter.spawn({
        argv: ['sleep', '10'],
        signal: controller.signal,
      });

      // Abort after a short delay
      setTimeout(() => controller.abort(), 100);

      const result = await resultPromise;
      assertEquals(result.aborted, true);
    });

    it('handles already aborted signal', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await adapter.spawn({
        argv: ['echo', 'should not run'],
        signal: controller.signal,
      });

      assertEquals(result.aborted, true);
    });

    it('calls stream handlers', async () => {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      const result = await adapter.spawn(
        {
          argv: ['sh', '-c', 'echo out; echo err >&2'],
        },
        {
          onStdout: (chunk: string) => stdoutChunks.push(chunk),
          onStderr: (chunk: string) => stderrChunks.push(chunk),
        },
      );

      assertEquals(stdoutChunks.join('').trim(), 'out');
      assertEquals(stderrChunks.join('').trim(), 'err');
      assertEquals(result.exitCode, 0);
    });
  });

  describe('spawnStreaming', () => {
    it('provides async iterables for stdout', async () => {
      const handle = adapter.spawnStreaming({
        argv: ['sh', '-c', 'echo line1; echo line2'],
      });

      const lines: string[] = [];
      for await (const line of handle.stdout) {
        lines.push(line);
      }

      const result = await handle.wait();

      assertEquals(lines, ['line1', 'line2']);
      assertEquals(result.exitCode, 0);
    });

    it('can kill process', async () => {
      const handle = adapter.spawnStreaming({
        argv: ['sleep', '10'],
      });

      handle.kill();
      const result = await handle.wait();

      assertExists(result.signal);
    });
  });
});

describe('DenoFsAdapter', () => {
  const adapter = new DenoFsAdapter();
  let tempFile: string;

  beforeAll(async () => {
    tempFile = await adapter.createTempFile('deno-test-');
  });

  afterAll(async () => {
    if (tempFile) {
      await adapter.deleteFile(tempFile);
    }
  });

  describe('createTempFile', () => {
    it('creates a temporary file', async () => {
      assert(tempFile.includes('deno-test-'));
      assertEquals(await adapter.exists(tempFile), true);
    });
  });

  describe('writeFile/readFile', () => {
    it('writes and reads file content', async () => {
      await adapter.writeFile(tempFile, 'test content');
      const content = await adapter.readFile(tempFile);

      assertEquals(content, 'test content');
    });
  });

  describe('exists', () => {
    it('returns true for existing file', async () => {
      assertEquals(await adapter.exists(tempFile), true);
    });

    it('returns false for non-existing file', async () => {
      assertEquals(await adapter.exists('/nonexistent/path/file.txt'), false);
    });
  });

  describe('deleteFile', () => {
    it('deletes file', async () => {
      const toDelete = await adapter.createTempFile('delete-test-');
      assertEquals(await adapter.exists(toDelete), true);

      await adapter.deleteFile(toDelete);
      assertEquals(await adapter.exists(toDelete), false);
    });

    it('handles non-existing file gracefully', async () => {
      // Should not throw
      await adapter.deleteFile('/nonexistent/path/file.txt');
    });
  });

  describe('tailStreaming', () => {
    it('streams new lines from file', async () => {
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

        // Read lines with timeout
        const lines: string[] = [];

        for await (const line of handle.lines) {
          lines.push(line);
          if (lines.length >= 2) {
            break;
          }
        }

        assertEquals(lines, ['line1', 'line2']);
      } finally {
        // Ensure we stop the handle before aborting to clean up timers
        handle?.stop();
        controller.abort();
        // Give time for cleanup
        await new Promise((resolve) => setTimeout(resolve, 100));
        await adapter.deleteFile(testFile);
      }
    });
  });
});

describe('Integration', () => {
  it('can run git --version', async () => {
    const adapter = new DenoExecAdapter();
    const result = await adapter.spawn({
      argv: ['git', '--version'],
    });

    assertEquals(result.exitCode, 0);
    assert(result.stdout.includes('git version'));
  });
});

describe('High-level API with Deno', () => {
  let tempDir: string;
  let git: Awaited<ReturnType<typeof createGit>>;

  beforeAll(async () => {
    git = await createGit({ adapters: createDenoAdapters() });
  });

  beforeEach(async () => {
    tempDir = await Deno.makeTempDir({ prefix: 'deno-git-test-' });
  });

  afterEach(async () => {
    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch {
      // Ignore errors
    }
  });

  it('can init a repository', async () => {
    const repoPath = `${tempDir}/repo`;
    const repo = await git.init(repoPath);

    assertEquals('workdir' in repo, true);
    if ('workdir' in repo) {
      assertEquals(repo.workdir, repoPath);
    }
  });

  it('can add and commit files', async () => {
    const repoPath = `${tempDir}/repo`;
    const repo = await git.init(repoPath);

    if ('workdir' in repo) {
      // Configure git user
      await repo.raw(['config', 'user.email', 'test@example.com']);
      await repo.raw(['config', 'user.name', 'Test User']);

      // Create and add a file
      await Deno.writeTextFile(`${repoPath}/test.txt`, 'hello deno');
      await repo.add('test.txt');

      // Check status
      const status = await repo.status();
      assertEquals(
        status.entries.some((e) => e.path === 'test.txt' && e.index === 'A'),
        true,
      );

      // Commit
      const result = await repo.commit({ message: 'Initial commit' });
      assertExists(result.hash);
      assert(result.hash.length > 0);
    }
  });

  it('can create and list branches', async () => {
    const repoPath = `${tempDir}/repo`;
    const repo = await git.init(repoPath, { initialBranch: 'main' });

    if ('workdir' in repo) {
      // Create initial commit
      await repo.raw(['config', 'user.email', 'test@example.com']);
      await repo.raw(['config', 'user.name', 'Test User']);
      await Deno.writeTextFile(`${repoPath}/README.md`, '# Test');
      await repo.add('README.md');
      await repo.commit({ message: 'Initial commit' });

      // Create a new branch
      await repo.branch.create('feature');

      // List branches
      const branches = await repo.branch.list();
      assertEquals(
        branches.some((b) => b.name === 'main'),
        true,
      );
      assertEquals(
        branches.some((b) => b.name === 'feature'),
        true,
      );

      // Get current branch
      const current = await repo.branch.current();
      assertEquals(current, 'main');
    }
  });

  it('can checkout branches', async () => {
    const repoPath = `${tempDir}/repo`;
    const repo = await git.init(repoPath, { initialBranch: 'main' });

    if ('workdir' in repo) {
      await repo.raw(['config', 'user.email', 'test@example.com']);
      await repo.raw(['config', 'user.name', 'Test User']);
      await Deno.writeTextFile(`${repoPath}/README.md`, '# Test');
      await repo.add('README.md');
      await repo.commit({ message: 'Initial commit' });

      // Create and checkout a new branch
      await repo.checkout('feature', { createBranch: true });

      const current = await repo.branch.current();
      assertEquals(current, 'feature');
    }
  });

  it('can use stash operations', async () => {
    const repoPath = `${tempDir}/repo`;
    const repo = await git.init(repoPath);

    if ('workdir' in repo) {
      await repo.raw(['config', 'user.email', 'test@example.com']);
      await repo.raw(['config', 'user.name', 'Test User']);
      await Deno.writeTextFile(`${repoPath}/README.md`, '# Test');
      await repo.add('README.md');
      await repo.commit({ message: 'Initial commit' });

      // Modify file
      await Deno.writeTextFile(`${repoPath}/README.md`, '# Modified');

      // Stash changes
      await repo.stash.push({ message: 'WIP' });

      // List stash
      const stashList = await repo.stash.list();
      assertEquals(stashList.length, 1);
      assert(stashList[0].message.includes('WIP'));

      // Pop stash
      await repo.stash.pop();
      const stashListAfter = await repo.stash.list();
      assertEquals(stashListAfter.length, 0);
    }
  });

  it('can create and list tags', async () => {
    const repoPath = `${tempDir}/repo`;
    const repo = await git.init(repoPath);

    if ('workdir' in repo) {
      await repo.raw(['config', 'user.email', 'test@example.com']);
      await repo.raw(['config', 'user.name', 'Test User']);
      await Deno.writeTextFile(`${repoPath}/README.md`, '# Test');
      await repo.add('README.md');
      await repo.commit({ message: 'Initial commit' });

      // Create tag
      await repo.tag.create('v1.0.0', { message: 'Release 1.0.0' });

      // List tags
      const tags = await repo.tag.list();
      assert(tags.includes('v1.0.0'));
    }
  });
});

/**
 * Bun Smoke Tests
 *
 * Tests basic functionality of BunExecAdapter and BunFsAdapter.
 * Run with: bun test test/bun/smoke.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { BunExecAdapter } from '../../src/adapters/bun/exec.js';
import { BunFsAdapter } from '../../src/adapters/bun/fs.js';

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

      try {
        const handle = adapter.tailStreaming(testFile, {
          signal: controller.signal,
          pollInterval: 50,
        });

        // Write some lines
        await adapter.writeFile(testFile, 'line1\nline2\n');

        // Read lines with timeout
        const lines: string[] = [];
        const timeout = setTimeout(() => {
          handle.stop();
        }, 500);

        for await (const line of handle.lines) {
          lines.push(line);
          if (lines.length >= 2) {
            handle.stop();
            break;
          }
        }

        clearTimeout(timeout);
        expect(lines).toEqual(['line1', 'line2']);
      } finally {
        controller.abort();
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

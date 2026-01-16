/**
 * Node.js ExecAdapter smoke tests
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodeExecAdapter } from './exec.js';

// Normalize path separators for cross-platform comparison
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

describe('NodeExecAdapter', () => {
  const adapter = new NodeExecAdapter();

  describe('getCapabilities', () => {
    it('should return node runtime capabilities', () => {
      const caps = adapter.getCapabilities();

      expect(caps.runtime).toBe('node');
      expect(caps.canSpawnProcess).toBe(true);
      expect(caps.canReadEnv).toBe(true);
      expect(caps.canWriteTemp).toBe(true);
      expect(caps.supportsAbortSignal).toBe(true);
      expect(caps.supportsKillSignal).toBe(true);
    });
  });

  describe('spawn', () => {
    it('should execute a simple command', async () => {
      // Use git --version as a cross-platform command
      const result = await adapter.spawn({
        argv: ['git', '--version'],
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('git version');
      expect(result.aborted).toBe(false);
    });

    it('should capture stderr', async () => {
      // Use git with invalid option to produce stderr
      const result = await adapter.spawn({
        argv: ['git', 'status', '--invalid-option-for-testing'],
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.length).toBeGreaterThan(0);
    });

    it('should return non-zero exit code on failure', async () => {
      // Use git rev-parse in non-repo directory
      const testDir = await mkdtemp(join(tmpdir(), 'type-git-exec-test-'));
      try {
        const result = await adapter.spawn({
          argv: ['git', 'rev-parse', 'HEAD'],
          cwd: testDir,
        });

        expect(result.exitCode).not.toBe(0);
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it('should respect working directory', async () => {
      // Create a unique temp directory for this test
      const testDir = await mkdtemp(join(tmpdir(), 'type-git-exec-test-'));
      try {
        // Use node to print cwd, which works cross-platform
        const result = await adapter.spawn({
          argv: ['node', '-e', 'console.log(process.cwd())'],
          cwd: testDir,
        });

        expect(result.exitCode).toBe(0);
        // Verify the command ran in the correct directory
        // Normalize paths for cross-platform comparison
        expect(normalizePath(result.stdout.trim())).toContain(normalizePath(testDir));
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it('should pass environment variables', async () => {
      // Use node to echo the env var (cross-platform)
      const result = await adapter.spawn({
        argv: ['node', '-e', 'console.log(process.env.TEST_VAR)'],
        env: { TEST_VAR: 'test-value' },
      });

      expect(result.stdout.trim()).toBe('test-value');
    });

    it('should support AbortSignal', async () => {
      const controller = new AbortController();

      // Start a long-running process using node (cross-platform)
      const promise = adapter.spawn({
        argv: ['node', '-e', 'setTimeout(() => {}, 10000)'],
        signal: controller.signal,
      });

      // Abort after a short delay
      setTimeout(() => controller.abort(), 50);

      const result = await promise;

      expect(result.aborted).toBe(true);
    });

    it('should call stream handlers', async () => {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      // Use node to write to stdout and stderr (cross-platform)
      await adapter.spawn(
        {
          argv: ['node', '-e', 'console.log("out"); console.error("err")'],
        },
        {
          onStdout: (chunk: string): void => {
            stdoutChunks.push(chunk);
          },
          onStderr: (chunk: string): void => {
            stderrChunks.push(chunk);
          },
        },
      );

      expect(stdoutChunks.join('')).toContain('out');
      expect(stderrChunks.join('')).toContain('err');
    });
  });

  describe('spawnStreaming', () => {
    it('should provide async iterable stdout', async () => {
      // Use node to print multiple lines (cross-platform)
      const handle = adapter.spawnStreaming({
        argv: ['node', '-e', 'console.log("line1"); console.log("line2"); console.log("line3")'],
      });

      const lines: string[] = [];
      for await (const line of handle.stdout) {
        lines.push(line);
      }

      await handle.wait();

      expect(lines).toContain('line1');
      expect(lines).toContain('line2');
      expect(lines).toContain('line3');
    });

    it('should wait for completion', async () => {
      // Use git --version as a cross-platform command
      const handle = adapter.spawnStreaming({
        argv: ['git', '--version'],
      });

      const result = await handle.wait();

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('git version');
    });

    it('should support kill', async () => {
      // Use node for a long-running process (cross-platform)
      const handle = adapter.spawnStreaming({
        argv: ['node', '-e', 'setTimeout(() => {}, 10000)'],
      });

      // Kill after a short delay
      setTimeout(() => handle.kill(), 50);

      const result = await handle.wait();

      expect(result.signal).toBeDefined();
    });

    it('should support Symbol.asyncDispose', async () => {
      const handle = adapter.spawnStreaming({
        argv: ['git', '--version'],
      });

      // Verify Symbol.asyncDispose exists
      expect(typeof handle[Symbol.asyncDispose]).toBe('function');

      // Call dispose and verify it cleans up properly
      await handle[Symbol.asyncDispose]();
    });

    it('should work with await using syntax', async () => {
      // Test that await using syntax compiles and executes without error
      // The disposal is implicit - we verify the process completes cleanly
      await (async () => {
        await using handle = adapter.spawnStreaming({
          argv: ['git', '--version'],
        });

        // Use the handle
        for await (const line of handle.stdout) {
          expect(line).toContain('git');
          break; // Just read one line
        }
        // Handle will be disposed when scope exits
      })();

      // If we reach here without hanging, disposal worked
    });

    it('should dispose properly on early exit', async () => {
      // Test that disposal happens even when exception is thrown
      const startTime = Date.now();

      try {
        await using _handle = adapter.spawnStreaming({
          argv: ['node', '-e', 'setTimeout(() => {}, 10000)'],
        });

        // Throw to simulate early exit
        throw new Error('Early exit');
      } catch {
        // Expected error
      }

      // If disposal didn't kill the process, this would take 10 seconds
      // Instead it should be nearly instant
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(5000);
      await Promise.resolve(); // Satisfy lint rule
    });
  });

  describe('resource management patterns', () => {
    describe('legacy pattern (try-finally)', () => {
      it('should cleanup with explicit kill() in finally block', async () => {
        const handle = adapter.spawnStreaming({
          argv: ['node', '-e', 'setTimeout(() => {}, 10000)'],
        });

        try {
          // Simulate some work
          const iterator = handle.stdout[Symbol.asyncIterator]();
          // Don't consume - just verify we can access it
          expect(iterator).toBeDefined();
        } finally {
          handle.kill();
        }

        const result = await handle.wait();
        expect(result.signal).toBeDefined();
      });

      it('should cleanup with explicit kill() on exception', async () => {
        const handle = adapter.spawnStreaming({
          argv: ['node', '-e', 'setTimeout(() => {}, 10000)'],
        });

        try {
          throw new Error('Simulated error');
        } catch {
          // Expected
        } finally {
          handle.kill();
        }

        const result = await handle.wait();
        expect(result.signal).toBeDefined();
      });
    });

    describe('modern pattern (await using)', () => {
      it('should auto-cleanup when scope exits normally', async () => {
        const startTime = Date.now();

        await (async () => {
          await using handle = adapter.spawnStreaming({
            argv: ['node', '-e', 'setTimeout(() => {}, 10000)'],
          });

          // Simulate some work
          const iterator = handle.stdout[Symbol.asyncIterator]();
          expect(iterator).toBeDefined();
          // Scope exits - dispose is called automatically
        })();

        // Should complete quickly (process killed by dispose)
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(5000);
      });

      it('should auto-cleanup when exception is thrown', async () => {
        const startTime = Date.now();

        try {
          await using _handle = adapter.spawnStreaming({
            argv: ['node', '-e', 'setTimeout(() => {}, 10000)'],
          });

          throw new Error('Simulated error');
        } catch {
          // Expected
        }

        // Should complete quickly (process killed by dispose)
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(5000);
        await Promise.resolve(); // Satisfy lint rule
      });
    });

    describe('pattern comparison', () => {
      it('both patterns should produce equivalent results', async () => {
        // Legacy pattern
        const legacyHandle = adapter.spawnStreaming({
          argv: ['git', '--version'],
        });
        let legacyOutput = '';
        try {
          for await (const line of legacyHandle.stdout) {
            legacyOutput += line;
          }
        } finally {
          // kill() is optional here since process completed naturally
        }
        const legacyResult = await legacyHandle.wait();

        // Modern pattern
        let modernOutput = '';
        let modernResult: Awaited<ReturnType<typeof legacyHandle.wait>> | undefined;
        await (async () => {
          await using handle = adapter.spawnStreaming({
            argv: ['git', '--version'],
          });
          for await (const line of handle.stdout) {
            modernOutput += line;
          }
          modernResult = await handle.wait();
        })();

        // Both should produce same results
        expect(legacyOutput).toBe(modernOutput);
        expect(legacyResult.exitCode).toBe(modernResult?.exitCode);
        expect(legacyResult.stdout).toBe(modernResult?.stdout);
      });
    });
  });
});

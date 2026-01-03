/**
 * Node.js ExecAdapter smoke tests
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeExecAdapter } from './exec.js';

describe('NodeExecAdapter', () => {
  const adapter = new NodeExecAdapter();
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'type-git-exec-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

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
      const result = await adapter.spawn({
        argv: ['git', 'rev-parse', 'HEAD'],
        cwd: testDir,
      });

      expect(result.exitCode).toBe(128);
    });

    it('should respect working directory', async () => {
      const result = await adapter.spawn({
        argv: ['git', 'rev-parse', '--show-toplevel'],
        cwd: testDir,
      });

      // Will fail with exit code 128 since testDir is not a repo,
      // but stderr should contain the path we're in
      expect(result.exitCode).toBe(128);
      expect(result.stderr).toContain('not a git repository');
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
  });
});

/**
 * Node.js ExecAdapter smoke tests
 */

import { realpath } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { NodeExecAdapter } from './exec.js';

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
      const result = await adapter.spawn({
        argv: ['echo', 'hello'],
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello');
      expect(result.aborted).toBe(false);
    });

    it('should capture stderr', async () => {
      const result = await adapter.spawn({
        argv: ['sh', '-c', 'echo error >&2'],
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr.trim()).toBe('error');
    });

    it('should return non-zero exit code on failure', async () => {
      const result = await adapter.spawn({
        argv: ['sh', '-c', 'exit 42'],
      });

      expect(result.exitCode).toBe(42);
    });

    it('should respect working directory', async () => {
      // Use realpath to handle macOS symlinks (/tmp -> /private/tmp)
      const expectedPath = await realpath('/tmp');
      const result = await adapter.spawn({
        argv: ['pwd'],
        cwd: '/tmp',
      });

      expect(result.stdout.trim()).toBe(expectedPath);
    });

    it('should pass environment variables', async () => {
      const result = await adapter.spawn({
        argv: ['sh', '-c', 'echo $TEST_VAR'],
        env: { TEST_VAR: 'test-value' },
      });

      expect(result.stdout.trim()).toBe('test-value');
    });

    it('should support AbortSignal', async () => {
      const controller = new AbortController();

      // Start a long-running process
      const promise = adapter.spawn({
        argv: ['sleep', '10'],
        signal: controller.signal,
      });

      // Abort after a short delay
      setTimeout(() => controller.abort(), 50);

      const result = await promise;

      expect(result.aborted).toBe(true);
    });

    it('should call stream handlers', async () => {
      const stdoutChunks: Array<string> = [];
      const stderrChunks: Array<string> = [];

      await adapter.spawn(
        {
          argv: ['sh', '-c', 'echo out && echo err >&2'],
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
      const handle = adapter.spawnStreaming({
        argv: ['sh', '-c', 'echo line1 && echo line2 && echo line3'],
      });

      const lines: Array<string> = [];
      for await (const line of handle.stdout) {
        lines.push(line);
      }

      await handle.wait();

      expect(lines).toContain('line1');
      expect(lines).toContain('line2');
      expect(lines).toContain('line3');
    });

    it('should wait for completion', async () => {
      const handle = adapter.spawnStreaming({
        argv: ['echo', 'done'],
      });

      const result = await handle.wait();

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('done');
    });

    it('should support kill', async () => {
      const handle = adapter.spawnStreaming({
        argv: ['sleep', '10'],
      });

      // Kill after a short delay
      setTimeout(() => handle.kill(), 50);

      const result = await handle.wait();

      expect(result.signal).toBeDefined();
    });
  });
});

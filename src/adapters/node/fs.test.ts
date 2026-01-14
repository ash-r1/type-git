/**
 * Node.js FsAdapter smoke tests
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeFsAdapter } from './fs.js';

describe('NodeFsAdapter', () => {
  const adapter = new NodeFsAdapter();
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `type-git-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('createTempFile', () => {
    it('should create a temp file path', async () => {
      const path = await adapter.createTempFile();

      expect(path).toContain('type-git-');
      expect(path).toContain('temp');
    });

    it('should accept custom prefix', async () => {
      const path = await adapter.createTempFile('custom-');

      expect(path).toContain('custom-');
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const filePath = join(testDir, 'exists.txt');
      await writeFile(filePath, 'test');

      const result = await adapter.exists(filePath);

      expect(result).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const filePath = join(testDir, 'not-exists.txt');

      const result = await adapter.exists(filePath);

      expect(result).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read file contents', async () => {
      const filePath = join(testDir, 'read.txt');
      await writeFile(filePath, 'file contents');

      const result = await adapter.readFile(filePath);

      expect(result).toBe('file contents');
    });
  });

  describe('writeFile', () => {
    it('should write file contents', async () => {
      const filePath = join(testDir, 'write.txt');

      await adapter.writeFile(filePath, 'written content');
      const result = await adapter.readFile(filePath);

      expect(result).toBe('written content');
    });
  });

  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      const filePath = join(testDir, 'delete.txt');
      await writeFile(filePath, 'to be deleted');

      await adapter.deleteFile(filePath);
      const exists = await adapter.exists(filePath);

      expect(exists).toBe(false);
    });

    it('should not throw for non-existing file', async () => {
      const filePath = join(testDir, 'not-exists.txt');

      await expect(adapter.deleteFile(filePath)).resolves.not.toThrow();
    });
  });

  describe('tail', () => {
    it('should tail file and call onLine', async () => {
      const filePath = join(testDir, 'tail.txt');
      await writeFile(filePath, 'line1\nline2\n');

      const controller = new AbortController();
      const lines: string[] = [];

      // Start tailing
      const tailPromise = adapter.tail({
        filePath,
        signal: controller.signal,
        onLine: (line: string): void => {
          lines.push(line);
          if (lines.length >= 2) {
            controller.abort();
          }
        },
      });

      await tailPromise;

      expect(lines).toContain('line1');
      expect(lines).toContain('line2');
    });
  });

  describe('tailStreaming', () => {
    it('should provide async iterable lines', async () => {
      const filePath = join(testDir, 'tail-stream.txt');
      await writeFile(filePath, 'stream-line1\nstream-line2\n');

      const handle = adapter.tailStreaming(filePath);
      const lines: string[] = [];

      // Read a few lines then stop
      for await (const line of handle.lines) {
        lines.push(line);
        if (lines.length >= 2) {
          handle.stop();
          break;
        }
      }

      expect(lines).toContain('stream-line1');
      expect(lines).toContain('stream-line2');
    });

    it('should support Symbol.asyncDispose', async () => {
      const filePath = join(testDir, 'tail-dispose.txt');
      await writeFile(filePath, 'dispose-line\n');

      const handle = adapter.tailStreaming(filePath);

      // Verify Symbol.asyncDispose exists
      expect(typeof handle[Symbol.asyncDispose]).toBe('function');

      // Call dispose and verify it cleans up properly
      await handle[Symbol.asyncDispose]();
    });

    it('should work with await using syntax', async () => {
      const filePath = join(testDir, 'tail-using.txt');
      await writeFile(filePath, 'using-line1\nusing-line2\n');

      // Test that await using syntax compiles and executes without error
      await (async () => {
        await using handle = adapter.tailStreaming(filePath);

        // Read one line then exit scope
        for await (const line of handle.lines) {
          expect(line).toBe('using-line1');
          break;
        }
        // Handle will be disposed when scope exits
      })();

      // If we reach here without hanging, disposal worked
    });
  });

  describe('resource management patterns', () => {
    describe('legacy pattern (try-finally)', () => {
      it('should cleanup with explicit stop() in finally block', async () => {
        const filePath = join(testDir, 'legacy-finally.txt');
        await writeFile(filePath, 'line1\nline2\n');

        const handle = adapter.tailStreaming(filePath);
        const lines: string[] = [];

        try {
          for await (const line of handle.lines) {
            lines.push(line);
            if (lines.length >= 2) {
              break;
            }
          }
        } finally {
          handle.stop();
        }

        expect(lines).toContain('line1');
        expect(lines).toContain('line2');
      });

      it('should cleanup with explicit stop() on exception', async () => {
        const filePath = join(testDir, 'legacy-exception.txt');
        await writeFile(filePath, 'line1\n');

        const handle = adapter.tailStreaming(filePath);

        try {
          for await (const line of handle.lines) {
            expect(line).toBe('line1');
            throw new Error('Simulated error');
          }
        } catch {
          // Expected
        } finally {
          handle.stop();
        }

        // If we reach here, stop() worked
      });
    });

    describe('modern pattern (await using)', () => {
      it('should auto-cleanup when scope exits normally', async () => {
        const filePath = join(testDir, 'modern-normal.txt');
        await writeFile(filePath, 'line1\nline2\n');

        const lines: string[] = [];

        await (async () => {
          await using handle = adapter.tailStreaming(filePath);

          for await (const line of handle.lines) {
            lines.push(line);
            if (lines.length >= 2) {
              break;
            }
          }
          // Scope exits - dispose is called automatically
        })();

        expect(lines).toContain('line1');
        expect(lines).toContain('line2');
      });

      it('should auto-cleanup when exception is thrown', async () => {
        const filePath = join(testDir, 'modern-exception.txt');
        await writeFile(filePath, 'line1\n');

        try {
          await using handle = adapter.tailStreaming(filePath);

          for await (const line of handle.lines) {
            expect(line).toBe('line1');
            throw new Error('Simulated error');
          }
        } catch {
          // Expected
        }

        // If we reach here without hanging, dispose worked
      });
    });

    describe('pattern comparison', () => {
      it('both patterns should produce equivalent results', async () => {
        const filePath = join(testDir, 'pattern-compare.txt');
        await writeFile(filePath, 'compare-line1\ncompare-line2\n');

        // Legacy pattern
        const legacyHandle = adapter.tailStreaming(filePath);
        const legacyLines: string[] = [];
        try {
          for await (const line of legacyHandle.lines) {
            legacyLines.push(line);
            if (legacyLines.length >= 2) {
              break;
            }
          }
        } finally {
          legacyHandle.stop();
        }

        // Rewrite file for modern pattern test
        await writeFile(filePath, 'compare-line1\ncompare-line2\n');

        // Modern pattern
        const modernLines: string[] = [];
        await (async () => {
          await using handle = adapter.tailStreaming(filePath);

          for await (const line of handle.lines) {
            modernLines.push(line);
            if (modernLines.length >= 2) {
              break;
            }
          }
        })();

        // Both should produce same results
        expect(legacyLines).toEqual(modernLines);
      });
    });
  });
});

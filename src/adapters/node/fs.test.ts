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
      const lines: Array<string> = [];

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
      const lines: Array<string> = [];

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
  });
});

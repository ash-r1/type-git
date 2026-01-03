/**
 * Deno FsAdapter implementation
 *
 * Uses Deno's native filesystem APIs.
 * Requires --allow-read and --allow-write permissions.
 */

import type { FsAdapter, TailHandle, TailOptions } from '../../core/adapters.js';
import {
  createTailPolling,
  type FilePollingAdapter,
  runTailPolling,
} from '../../internal/file-polling.js';

// Deno global type declarations
declare const Deno: {
  makeTempDir(options?: { prefix?: string }): Promise<string>;
  remove(path: string, options?: { recursive?: boolean }): Promise<void>;
  stat(path: string): Promise<{ isFile: boolean; size: number }>;
  open(
    path: string,
    options?: { read?: boolean; write?: boolean; create?: boolean },
  ): Promise<{
    read(buffer: Uint8Array): Promise<number | null>;
    seek(offset: number, whence: number): Promise<number>;
    close(): void;
  }>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, data: string): Promise<void>;
  SeekMode: {
    Start: number;
    Current: number;
    End: number;
  };
};

/**
 * Delay helper for Deno
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DenoFsAdapter implements FsAdapter {
  public async createTempFile(prefix: string = 'type-git-'): Promise<string> {
    const dir = await Deno.makeTempDir({ prefix });
    const filePath = `${dir}/temp`;
    // Create empty file
    await Deno.writeTextFile(filePath, '');
    return filePath;
  }

  public async tail(options: TailOptions): Promise<void> {
    const { filePath, signal, onLine, pollInterval = 100 } = options;
    const decoder = new TextDecoder();

    const adapter: FilePollingAdapter = {
      readChunk: async (position: number) => {
        try {
          const stat = await Deno.stat(filePath);
          const size = stat.size;
          if (size <= position) {
            return null;
          }
          const file = await Deno.open(filePath, { read: true });
          try {
            await file.seek(position, Deno.SeekMode.Start);
            const chunk = new Uint8Array(size - position);
            await file.read(chunk);
            return {
              data: decoder.decode(chunk, { stream: true }),
              newPosition: size,
            };
          } finally {
            file.close();
          }
        } catch {
          return null;
        }
      },
      sleep: (ms: number) => delay(ms),
    };

    await runTailPolling({ adapter, signal, pollInterval, onLine });
  }

  public async deleteFile(filePath: string): Promise<void> {
    try {
      await Deno.remove(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      const err = error as Error & { code?: string };
      if (err.name !== 'NotFound' && err.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  public async deleteDirectory(dirPath: string): Promise<void> {
    try {
      await Deno.remove(dirPath, { recursive: true });
    } catch (error) {
      // Ignore if directory doesn't exist
      const err = error as Error & { code?: string };
      if (err.name !== 'NotFound' && err.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  public async exists(filePath: string): Promise<boolean> {
    try {
      await Deno.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  public async readFile(filePath: string): Promise<string> {
    return await Deno.readTextFile(filePath);
  }

  public async writeFile(filePath: string, contents: string): Promise<void> {
    await Deno.writeTextFile(filePath, contents);
  }

  public tailStreaming(
    filePath: string,
    options?: { signal?: AbortSignal; pollInterval?: number },
  ): TailHandle {
    const { signal, pollInterval = 100 } = options ?? {};
    const decoder = new TextDecoder();

    const adapter: FilePollingAdapter = {
      readChunk: async (position: number) => {
        try {
          const stat = await Deno.stat(filePath);
          const size = stat.size;
          if (size <= position) {
            return null;
          }
          const file = await Deno.open(filePath, { read: true });
          try {
            await file.seek(position, Deno.SeekMode.Start);
            const chunk = new Uint8Array(size - position);
            await file.read(chunk);
            return {
              data: decoder.decode(chunk, { stream: true }),
              newPosition: size,
            };
          } finally {
            file.close();
          }
        } catch {
          return null;
        }
      },
      sleep: (ms: number) => delay(ms),
    };

    return createTailPolling({ adapter, signal, pollInterval });
  }
}

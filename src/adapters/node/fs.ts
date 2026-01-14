/**
 * Node.js FsAdapter implementation
 */

import type { FileHandle } from 'node:fs/promises';
import { access, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FsAdapter, TailHandle, TailOptions } from '../../core/adapters.js';
import {
  createTailPolling,
  type FilePollingAdapter,
  runTailPolling,
} from '../../internal/file-polling.js';

export class NodeFsAdapter implements FsAdapter {
  public async createTempFile(prefix: string = 'type-git-'): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), prefix));
    return join(dir, 'temp');
  }

  public async tail(options: TailOptions): Promise<void> {
    const { filePath, signal, onLine, pollInterval = 100 } = options;

    const state: { file: FileHandle | null } = { file: null };
    const decoder = new TextDecoder();

    const adapter: FilePollingAdapter = {
      readChunk: async (position: number) => {
        try {
          if (!state.file) {
            state.file = await open(filePath, 'r');
          }
          const { bytesRead, buffer: chunk } = await state.file.read({
            buffer: Buffer.alloc(4096),
            position,
          });
          return {
            data: decoder.decode(chunk.subarray(0, bytesRead), { stream: true }),
            newPosition: position + bytesRead,
          };
        } catch {
          return null;
        }
      },
      sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    };

    try {
      await runTailPolling({ adapter, signal, pollInterval, onLine });
    } finally {
      if (state.file) {
        await state.file.close();
      }
    }
  }

  public async deleteFile(filePath: string): Promise<void> {
    await rm(filePath, { force: true });
  }

  public async deleteDirectory(dirPath: string): Promise<void> {
    await rm(dirPath, { force: true, recursive: true });
  }

  public async exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  public async readFile(filePath: string): Promise<string> {
    return await readFile(filePath, 'utf8');
  }

  public async writeFile(filePath: string, contents: string): Promise<void> {
    await writeFile(filePath, contents, 'utf8');
  }

  public tailStreaming(
    filePath: string,
    options?: { signal?: AbortSignal; pollInterval?: number },
  ): TailHandle {
    const { signal, pollInterval = 100 } = options ?? {};

    const state: { file: FileHandle | null } = { file: null };
    const decoder = new TextDecoder();

    const adapter: FilePollingAdapter = {
      readChunk: async (position: number) => {
        try {
          if (!state.file) {
            state.file = await open(filePath, 'r');
          }
          const { bytesRead, buffer: chunk } = await state.file.read({
            buffer: Buffer.alloc(4096),
            position,
          });
          return {
            data: decoder.decode(chunk.subarray(0, bytesRead), { stream: true }),
            newPosition: position + bytesRead,
          };
        } catch {
          return null;
        }
      },
      sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    };

    const polling = createTailPolling({ adapter, signal, pollInterval });

    // Helper to close file handle (used by both stop and dispose)
    const closeFileHandle = async (): Promise<void> => {
      if (state.file) {
        await state.file.close().catch(() => {
          // Intentionally ignored - cleanup
        });
        state.file = null;
      }
    };

    // Wrap stop to close file handle
    const originalStop = polling.stop;
    const enhancedStop = (): void => {
      originalStop();
      // Fire-and-forget close for sync stop()
      void closeFileHandle();
    };

    return {
      lines: polling.lines,
      stop: enhancedStop,
      [Symbol.asyncDispose]: async (): Promise<void> => {
        await polling[Symbol.asyncDispose]();
        await closeFileHandle();
      },
    };
  }
}

/**
 * Bun FsAdapter implementation
 *
 * Uses Bun's native file APIs for optimal performance.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FsAdapter, TailHandle, TailOptions } from '../../core/adapters.js';
import {
  createTailPolling,
  type FilePollingAdapter,
  runTailPolling,
} from '../../internal/file-polling.js';

export class BunFsAdapter implements FsAdapter {
  public async createTempFile(prefix: string = 'type-git-'): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), prefix));
    const filePath = join(dir, 'temp');
    // Create empty file
    await Bun.write(filePath, '');
    return filePath;
  }

  public async tail(options: TailOptions): Promise<void> {
    const { filePath, signal, onLine, pollInterval = 100 } = options;

    const adapter: FilePollingAdapter = {
      readChunk: async (position: number) => {
        try {
          const file = Bun.file(filePath);
          const size = file.size;
          if (size <= position) {
            return null;
          }
          const slice = file.slice(position, size);
          const text = await slice.text();
          return { data: text, newPosition: size };
        } catch {
          return null;
        }
      },
      sleep: (ms: number) => Bun.sleep(ms),
    };

    await runTailPolling({ adapter, signal, pollInterval, onLine });
  }

  public async deleteFile(filePath: string): Promise<void> {
    await rm(filePath, { force: true });
  }

  public async deleteDirectory(dirPath: string): Promise<void> {
    await rm(dirPath, { force: true, recursive: true });
  }

  public async exists(filePath: string): Promise<boolean> {
    const file = Bun.file(filePath);
    return await file.exists();
  }

  public async readFile(filePath: string): Promise<string> {
    const file = Bun.file(filePath);
    return await file.text();
  }

  public async writeFile(filePath: string, contents: string): Promise<void> {
    await Bun.write(filePath, contents);
  }

  public tailStreaming(
    filePath: string,
    options?: { signal?: AbortSignal; pollInterval?: number },
  ): TailHandle {
    const { signal, pollInterval = 100 } = options ?? {};

    const adapter: FilePollingAdapter = {
      readChunk: async (position: number) => {
        try {
          const file = Bun.file(filePath);
          const size = file.size;
          if (size <= position) {
            return null;
          }
          const slice = file.slice(position, size);
          const text = await slice.text();
          return { data: text, newPosition: size };
        } catch {
          return null;
        }
      },
      sleep: (ms: number) => Bun.sleep(ms),
    };

    return createTailPolling({ adapter, signal, pollInterval });
  }
}

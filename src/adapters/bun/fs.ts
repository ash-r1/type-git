/**
 * Bun FsAdapter implementation
 *
 * Uses Bun's native file APIs for optimal performance.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FsAdapter, TailHandle, TailOptions } from '../../core/adapters.js';

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

    let position = 0;
    let buffer = '';

    const poll = async (): Promise<void> => {
      if (signal?.aborted) {
        return;
      }

      try {
        const file = Bun.file(filePath);
        const size = file.size;

        if (size > position) {
          const slice = file.slice(position, size);
          const text = await slice.text();
          position = size;

          buffer += text;
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line) {
              onLine(line);
            }
          }
        }
      } catch (error) {
        // File may not exist yet, ignore and retry
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      if (!signal?.aborted) {
        await Bun.sleep(pollInterval);
        await poll();
      }
    };

    await poll();
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

    type ResolverFn = (value: IteratorResult<string, undefined>) => void;
    type TailState = {
      stopped: boolean;
      resolveNext: ResolverFn | null;
      lineQueue: string[];
    };
    const state: TailState = {
      stopped: false,
      resolveNext: null,
      lineQueue: [],
    };

    const stop = (): void => {
      state.stopped = true;
      if (state.resolveNext) {
        state.resolveNext({ done: true, value: undefined });
        state.resolveNext = null;
      }
    };

    // Start polling in the background
    const startPolling = async (): Promise<void> => {
      let position = 0;
      let buffer = '';

      while (!(state.stopped || signal?.aborted)) {
        try {
          const file = Bun.file(filePath);
          const size = file.size;

          if (size > position) {
            const slice = file.slice(position, size);
            const text = await slice.text();
            position = size;

            buffer += text;
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (line) {
                if (state.resolveNext) {
                  const resolver = state.resolveNext;
                  state.resolveNext = null;
                  resolver({ done: false, value: line });
                } else {
                  state.lineQueue.push(line);
                }
              }
            }
          }
        } catch {
          // Ignore errors, file may not exist yet
        }

        await Bun.sleep(pollInterval);
      }

      stop();
    };

    startPolling().catch(() => {
      // Intentionally ignored - startPolling handles its own cleanup
    });

    const lines: AsyncIterable<string> = {
      [Symbol.asyncIterator](): AsyncIterator<string> {
        return {
          next(): Promise<IteratorResult<string>> {
            if (state.stopped) {
              return Promise.resolve({ done: true, value: undefined });
            }

            if (state.lineQueue.length > 0) {
              const value = state.lineQueue.shift();
              if (value !== undefined) {
                return Promise.resolve({ done: false, value });
              }
            }

            return new Promise((resolve) => {
              state.resolveNext = resolve;
            });
          },
        };
      },
    };

    return { lines, stop };
  }
}

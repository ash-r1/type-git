/**
 * Bun FsAdapter implementation
 *
 * Uses Bun's native file APIs for optimal performance.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FsAdapter, TailOptions, TailHandle } from '../../core/adapters.js';

export class BunFsAdapter implements FsAdapter {
  async createTempFile(prefix = 'type-git-'): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), prefix));
    const filePath = join(dir, 'temp');
    // Create empty file
    await Bun.write(filePath, '');
    return filePath;
  }

  async tail(options: TailOptions): Promise<void> {
    const { filePath, signal, onLine, pollInterval = 100 } = options;

    let position = 0;
    let buffer = '';

    const poll = async () => {
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
          buffer = lines.pop() || '';

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

  async deleteFile(filePath: string): Promise<void> {
    await rm(filePath, { force: true, recursive: true });
  }

  async exists(filePath: string): Promise<boolean> {
    const file = Bun.file(filePath);
    return file.exists();
  }

  async readFile(filePath: string): Promise<string> {
    const file = Bun.file(filePath);
    return file.text();
  }

  async writeFile(filePath: string, contents: string): Promise<void> {
    await Bun.write(filePath, contents);
  }

  tailStreaming(
    filePath: string,
    options?: { signal?: AbortSignal; pollInterval?: number },
  ): TailHandle {
    const { signal, pollInterval = 100 } = options ?? {};

    type ResolverFn = (value: IteratorResult<string, undefined>) => void;
    const state = {
      stopped: false,
      resolveNext: null as ResolverFn | null,
      lineQueue: [] as string[],
    };

    const stop = () => {
      state.stopped = true;
      if (state.resolveNext) {
        state.resolveNext({ done: true, value: undefined });
        state.resolveNext = null;
      }
    };

    // Start polling in the background
    (async () => {
      let position = 0;
      let buffer = '';

      while (!state.stopped && !signal?.aborted) {
        try {
          const file = Bun.file(filePath);
          const size = file.size;

          if (size > position) {
            const slice = file.slice(position, size);
            const text = await slice.text();
            position = size;

            buffer += text;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

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
    })();

    const lines: AsyncIterable<string> = {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<string>> {
            if (state.stopped) {
              return Promise.resolve({ done: true, value: undefined });
            }

            if (state.lineQueue.length > 0) {
              return Promise.resolve({ done: false, value: state.lineQueue.shift()! });
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

/**
 * Deno FsAdapter implementation
 *
 * Uses Deno's native filesystem APIs.
 * Requires --allow-read and --allow-write permissions.
 */

import type { FsAdapter, TailHandle, TailOptions } from '../../core/adapters.js';

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

    let position = 0;
    const decoder = new TextDecoder();
    let buffer = '';

    const poll = async (): Promise<void> => {
      if (signal?.aborted) {
        return;
      }

      try {
        const stat = await Deno.stat(filePath);
        const size = stat.size;

        if (size > position) {
          const file = await Deno.open(filePath, { read: true });
          try {
            await file.seek(position, Deno.SeekMode.Start);
            const chunk = new Uint8Array(size - position);
            await file.read(chunk);
            position = size;

            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (line) {
                onLine(line);
              }
            }
          } finally {
            file.close();
          }
        }
      } catch (error) {
        // File may not exist yet, ignore ENOENT
        const err = error as Error & { code?: string };
        if (err.name !== 'NotFound' && err.code !== 'ENOENT') {
          throw error;
        }
      }

      if (!signal?.aborted) {
        await delay(pollInterval);
        await poll();
      }
    };

    await poll();
  }

  public async deleteFile(filePath: string): Promise<void> {
    try {
      await Deno.remove(filePath, { recursive: true });
    } catch (error) {
      // Ignore if file doesn't exist
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

    type ResolverFn = (value: IteratorResult<string, undefined>) => void;
    const state = {
      stopped: false,
      resolveNext: null as ResolverFn | null,
      lineQueue: [] as Array<string>,
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
      const decoder = new TextDecoder();
      let buffer = '';

      while (!(state.stopped || signal?.aborted)) {
        try {
          const stat = await Deno.stat(filePath);
          const size = stat.size;

          if (size > position) {
            const file = await Deno.open(filePath, { read: true });
            try {
              await file.seek(position, Deno.SeekMode.Start);
              const chunk = new Uint8Array(size - position);
              await file.read(chunk);
              position = size;

              buffer += decoder.decode(chunk, { stream: true });
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
            } finally {
              file.close();
            }
          }
        } catch {
          // Ignore errors, file may not exist yet
        }

        await delay(pollInterval);
      }

      stop();
    };

    void startPolling();

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

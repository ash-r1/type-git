/**
 * Node.js FsAdapter implementation
 */

import type { FileHandle } from 'node:fs/promises';
import { access, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FsAdapter, TailHandle, TailOptions } from '../../core/adapters.js';

export class NodeFsAdapter implements FsAdapter {
  public async createTempFile(prefix: string = 'type-git-'): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), prefix));
    return join(dir, 'temp');
  }

  public async tail(options: TailOptions): Promise<void> {
    const { filePath, signal, onLine } = options;

    const file = await open(filePath, 'r');
    let position = 0;
    const decoder = new TextDecoder();
    let buffer = '';

    const poll = async (): Promise<void> => {
      if (signal?.aborted) {
        await file.close();
        return;
      }

      try {
        const { bytesRead, buffer: chunk } = await file.read({
          buffer: Buffer.alloc(4096),
          position,
        });

        if (bytesRead > 0) {
          position += bytesRead;
          buffer += decoder.decode(chunk.subarray(0, bytesRead), { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line) {
              onLine(line);
            }
          }
        }
      } catch (error) {
        await file.close();
        throw error;
      }

      if (!signal?.aborted) {
        setTimeout(() => {
          poll().catch(() => {
            // Intentionally ignored - poll handles its own errors
          });
        }, 100);
      } else {
        await file.close();
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
      let file: FileHandle;
      try {
        file = await open(filePath, 'r');
      } catch {
        stop();
        return;
      }

      let position = 0;
      const decoder = new TextDecoder();
      let buffer = '';

      while (!(state.stopped || signal?.aborted)) {
        try {
          const { bytesRead, buffer: chunk } = await file.read({
            buffer: Buffer.alloc(4096),
            position,
          });

          if (bytesRead > 0) {
            position += bytesRead;
            buffer += decoder.decode(chunk.subarray(0, bytesRead), { stream: true });

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
          break;
        }

        await new Promise<void>((resolve) => setTimeout(resolve, pollInterval));
      }

      await file.close();
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

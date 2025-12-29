/**
 * Node.js FsAdapter implementation
 */

import { mkdtemp, rm, access, readFile, writeFile, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FsAdapter, TailOptions, TailHandle } from '../../core/adapters.js';

export class NodeFsAdapter implements FsAdapter {
  async createTempFile(prefix = 'type-git-'): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), prefix));
    return join(dir, 'temp');
  }

  async tail(options: TailOptions): Promise<void> {
    const { filePath, signal, onLine } = options;

    const file = await open(filePath, 'r');
    let position = 0;
    const decoder = new TextDecoder();
    let buffer = '';

    const poll = async () => {
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
          buffer = lines.pop() || '';

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
        setTimeout(poll, 100);
      } else {
        await file.close();
      }
    };

    await poll();
  }

  async deleteFile(filePath: string): Promise<void> {
    await rm(filePath, { force: true, recursive: true });
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    return readFile(filePath, 'utf8');
  }

  async writeFile(filePath: string, contents: string): Promise<void> {
    await writeFile(filePath, contents, 'utf8');
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
      let file;
      try {
        file = await open(filePath, 'r');
      } catch {
        stop();
        return;
      }

      let position = 0;
      const decoder = new TextDecoder();
      let buffer = '';

      while (!state.stopped && !signal?.aborted) {
        try {
          const { bytesRead, buffer: chunk } = await file.read({
            buffer: Buffer.alloc(4096),
            position,
          });

          if (bytesRead > 0) {
            position += bytesRead;
            buffer += decoder.decode(chunk.subarray(0, bytesRead), { stream: true });

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
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      await file.close();
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

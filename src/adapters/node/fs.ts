/**
 * Node.js FsAdapter implementation
 */

import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { open } from 'node:fs/promises';
import type { FsAdapter, TailOptions } from '../../core/adapters.js';

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
}

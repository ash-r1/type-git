/**
 * Deno ExecAdapter implementation
 *
 * Uses Deno.Command API for process execution.
 * Requires --allow-run permission.
 */

import type {
  ExecAdapter,
  SpawnOptions,
  SpawnResult,
  SpawnHandle,
  StreamHandler,
} from '../../core/adapters.js';
import type { Capabilities } from '../../core/types.js';

// Deno global type declarations
declare const Deno: {
  Command: new (
    cmd: string,
    options?: {
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      stdin?: 'piped' | 'inherit' | 'null';
      stdout?: 'piped' | 'inherit' | 'null';
      stderr?: 'piped' | 'inherit' | 'null';
      signal?: AbortSignal;
    },
  ) => {
    spawn(): {
      pid: number;
      stdin: WritableStream<Uint8Array> | null;
      stdout: ReadableStream<Uint8Array> | null;
      stderr: ReadableStream<Uint8Array> | null;
      status: Promise<{ success: boolean; code: number; signal: string | null }>;
      kill(signal?: string): void;
      ref(): void;
      unref(): void;
    };
    output(): Promise<{
      success: boolean;
      code: number;
      signal: string | null;
      stdout: Uint8Array;
      stderr: Uint8Array;
    }>;
  };
  env: {
    toObject(): Record<string, string>;
  };
};

/**
 * Create an async iterable from a ReadableStream
 */
async function* streamToAsyncIterable(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        yield line;
      }
    }

    // Yield remaining buffer if any
    if (buffer) {
      yield buffer;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Read all data from a ReadableStream as a string
 */
async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode(); // Flush remaining
  } finally {
    reader.releaseLock();
  }

  return result;
}

export class DenoExecAdapter implements ExecAdapter {
  getCapabilities(): Capabilities {
    return {
      canSpawnProcess: true,
      canReadEnv: true,
      canWriteTemp: true,
      supportsAbortSignal: true,
      supportsKillSignal: true,
      runtime: 'deno',
    };
  }

  async spawn(options: SpawnOptions, handlers?: StreamHandler): Promise<SpawnResult> {
    const { argv, env, cwd, signal } = options;

    if (argv.length === 0) {
      throw new Error('argv must not be empty');
    }

    const [command, ...args] = argv;
    let aborted = false;

    // Check if already aborted
    if (signal?.aborted) {
      return {
        stdout: '',
        stderr: '',
        exitCode: -1,
        signal: 'SIGTERM',
        aborted: true,
      };
    }

    const cmd = new Deno.Command(command!, {
      args,
      cwd,
      env: env ? { ...Deno.env.toObject(), ...env } : undefined,
      stdin: 'null',
      stdout: 'piped',
      stderr: 'piped',
    });

    const child = cmd.spawn();

    // Handle abort signal
    const abortHandler = () => {
      aborted = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // Process may have already exited
      }
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      let stdout = '';
      let stderr = '';

      if (handlers?.onStdout || handlers?.onStderr) {
        // Stream processing mode
        const stdoutPromise = (async () => {
          if (!child.stdout) return '';
          const reader = child.stdout.getReader();
          const decoder = new TextDecoder();
          let result = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = decoder.decode(value, { stream: true });
              result += text;
              handlers?.onStdout?.(text);
            }
            result += decoder.decode();
          } finally {
            reader.releaseLock();
          }
          return result;
        })();

        const stderrPromise = (async () => {
          if (!child.stderr) return '';
          const reader = child.stderr.getReader();
          const decoder = new TextDecoder();
          let result = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = decoder.decode(value, { stream: true });
              result += text;
              handlers?.onStderr?.(text);
            }
            result += decoder.decode();
          } finally {
            reader.releaseLock();
          }
          return result;
        })();

        [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
      } else {
        // Simple mode - read all at once
        [stdout, stderr] = await Promise.all([
          child.stdout ? readStream(child.stdout) : Promise.resolve(''),
          child.stderr ? readStream(child.stderr) : Promise.resolve(''),
        ]);
      }

      const status = await child.status;

      return {
        stdout,
        stderr,
        exitCode: status.code,
        signal: status.signal ?? undefined,
        aborted,
      };
    } finally {
      signal?.removeEventListener('abort', abortHandler);
    }
  }

  spawnStreaming(options: SpawnOptions): SpawnHandle {
    const { argv, env, cwd, signal } = options;

    if (argv.length === 0) {
      throw new Error('argv must not be empty');
    }

    const [command, ...args] = argv;
    let aborted = false;

    const cmd = new Deno.Command(command!, {
      args,
      cwd,
      env: env ? { ...Deno.env.toObject(), ...env } : undefined,
      stdin: 'null',
      stdout: 'piped',
      stderr: 'piped',
    });

    const child = cmd.spawn();

    const abortHandler = () => {
      aborted = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // Process may have already exited
      }
    };

    if (signal) {
      if (signal.aborted) {
        try {
          child.kill('SIGTERM');
        } catch {
          // Ignore
        }
        aborted = true;
      } else {
        signal.addEventListener('abort', abortHandler, { once: true });
      }
    }

    // Clone streams for both iteration and collection
    const [stdout1, stdout2] = child.stdout!.tee();
    const [stderr1, stderr2] = child.stderr!.tee();

    const waitPromise = (async (): Promise<SpawnResult> => {
      try {
        const [stdout, stderr, status] = await Promise.all([
          readStream(stdout2),
          readStream(stderr2),
          child.status,
        ]);

        return {
          stdout,
          stderr,
          exitCode: status.code,
          signal: status.signal ?? undefined,
          aborted,
        };
      } finally {
        signal?.removeEventListener('abort', abortHandler);
      }
    })();

    return {
      stdout: streamToAsyncIterable(stdout1),
      stderr: streamToAsyncIterable(stderr1),
      wait: () => waitPromise,
      kill: (sig?: 'SIGTERM' | 'SIGKILL') => {
        try {
          child.kill(sig ?? 'SIGTERM');
        } catch {
          // Process may have already exited
        }
      },
    };
  }
}

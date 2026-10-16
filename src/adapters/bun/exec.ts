import { readBytes } from '../../internal/bytes.js';
/**
 * Bun ExecAdapter implementation
 *
 * Uses Bun.spawn() for process execution with full streaming support.
 */

import type {
  ExecAdapter,
  SpawnHandle,
  SpawnOptions,
  SpawnResult,
  StreamHandler,
} from '../../core/adapters.js';
import type { Capabilities } from '../../core/types.js';

/**
 * Resolve the environment passed to the child process.
 *
 * When `inheritEnv` is `false`, only the explicitly provided `env` is used so the parent
 * process environment is not implicitly forwarded (environment variable traversal
 * prevention). Otherwise the parent environment is merged underneath `env`.
 */
function resolveChildEnv(
  env: Record<string, string> | undefined,
  inheritEnv: boolean | undefined,
): Record<string, string | undefined> {
  if (inheritEnv === false) {
    return env ?? {};
  }
  return env ? { ...Bun.env, ...env } : Bun.env;
}

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
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

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
async function readStream(
  stream: ReadableStream<Uint8Array>,
  onChunk?: (text: string) => void,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const text = decoder.decode(value, { stream: true });
      result += text;
      onChunk?.(text);
    }
    const tail = decoder.decode();
    result += tail;
    if (tail) {
      onChunk?.(tail);
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}

export class BunExecAdapter implements ExecAdapter {
  public getCapabilities(): Capabilities {
    return {
      canSpawnProcess: true,
      canReadEnv: true,
      canWriteTemp: true,
      supportsAbortSignal: true,
      supportsKillSignal: true,
      runtime: 'bun',
    };
  }

  public async spawn(options: SpawnOptions, handlers?: StreamHandler): Promise<SpawnResult> {
    return (await this.spawnResult(options, handlers, false)) as SpawnResult;
  }

  public async spawnBytes(
    options: SpawnOptions,
    handlers?: Pick<StreamHandler, 'onStderr'>,
  ): Promise<SpawnResult<Uint8Array>> {
    return (await this.spawnResult(options, handlers, true)) as SpawnResult<Uint8Array>;
  }

  private async spawnResult(
    options: SpawnOptions,
    handlers: StreamHandler | undefined,
    binary: boolean,
  ): Promise<SpawnResult<string | Uint8Array>> {
    const { argv, env, inheritEnv, cwd, signal } = options;

    const command = argv[0];
    if (command === undefined) {
      throw new Error('argv must not be empty');
    }
    const args = argv.slice(1);
    let aborted = false;

    // Check if already aborted
    if (signal?.aborted) {
      return {
        stdout: binary ? new Uint8Array(0) : '',
        stderr: '',
        exitCode: -1,
        aborted: true,
      };
    }

    const proc = Bun.spawn([command, ...args], {
      cwd,
      env: resolveChildEnv(env, inheritEnv),
      stdout: 'pipe',
      stderr: 'pipe',
      stdin:
        options.stdin === undefined
          ? 'ignore'
          : new Blob([
              typeof options.stdin === 'string' ? options.stdin : new Uint8Array(options.stdin),
            ]),
    });

    // Handle abort signal
    const abortHandler = (): void => {
      aborted = true;
      proc.kill('SIGTERM');
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      // Read streams with handlers if provided
      let stdout: string | Uint8Array = '';
      let stderr = '';

      if (binary) {
        [stdout, stderr] = await Promise.all([
          proc.stdout ? readBytes(proc.stdout) : Promise.resolve(new Uint8Array(0)),
          proc.stderr ? readStream(proc.stderr, handlers?.onStderr) : Promise.resolve(''),
        ]);
      } else if (handlers?.onStdout || handlers?.onStderr) {
        // Stream processing mode
        const stdoutPromise = (async (): Promise<string> => {
          if (!proc.stdout) {
            return '';
          }
          const reader = proc.stdout.getReader();
          const decoder = new TextDecoder();
          let result = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
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

        const stderrPromise = (async (): Promise<string> => {
          if (!proc.stderr) {
            return '';
          }
          const reader = proc.stderr.getReader();
          const decoder = new TextDecoder();
          let result = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
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
          proc.stdout ? readStream(proc.stdout) : Promise.resolve(''),
          proc.stderr ? readStream(proc.stderr) : Promise.resolve(''),
        ]);
      }

      const exitCode = await proc.exited;

      return {
        stdout,
        stderr,
        exitCode,
        signal: proc.signalCode ?? undefined,
        aborted,
      };
    } finally {
      signal?.removeEventListener('abort', abortHandler);
    }
  }

  public spawnStreaming(options: SpawnOptions): SpawnHandle {
    const { argv, env, inheritEnv, cwd, signal } = options;

    const command = argv[0];
    if (command === undefined) {
      throw new Error('argv must not be empty');
    }
    const args = argv.slice(1);
    let aborted = false;

    const proc = Bun.spawn([command, ...args], {
      cwd,
      env: resolveChildEnv(env, inheritEnv),
      stdout: 'pipe',
      stderr: 'pipe',
      stdin:
        options.stdin === undefined
          ? 'ignore'
          : new Blob([
              typeof options.stdin === 'string' ? options.stdin : new Uint8Array(options.stdin),
            ]),
    });

    const abortHandler = (): void => {
      aborted = true;
      proc.kill('SIGTERM');
    };

    if (signal) {
      if (signal.aborted) {
        proc.kill('SIGTERM');
        aborted = true;
      } else {
        signal.addEventListener('abort', abortHandler, { once: true });
      }
    }

    // Clone streams for both iteration and collection
    const stdoutTee = proc.stdout?.tee();
    const stderrTee = proc.stderr?.tee();

    if (!(stdoutTee && stderrTee)) {
      throw new Error('Failed to create stdio streams');
    }

    const [stdout1, stdout2] = stdoutTee;
    const [stderr1, stderr2] = stderrTee;

    const waitPromise = (async (): Promise<SpawnResult> => {
      try {
        const [stdout, stderr, exitCode] = await Promise.all([
          readStream(stdout2),
          readStream(stderr2),
          proc.exited,
        ]);

        return {
          stdout,
          stderr,
          exitCode,
          signal: proc.signalCode ?? undefined,
          aborted,
        };
      } finally {
        signal?.removeEventListener('abort', abortHandler);
      }
    })();

    return {
      stdout: streamToAsyncIterable(stdout1),
      stderr: streamToAsyncIterable(stderr1),
      wait: (): Promise<SpawnResult> => waitPromise,
      kill: (sig?: 'SIGTERM' | 'SIGKILL'): void => {
        proc.kill(sig ?? 'SIGTERM');
      },
      [Symbol.asyncDispose]: async (): Promise<void> => {
        if (proc.exitCode === null) {
          proc.kill('SIGTERM');
        }
        await waitPromise.catch(() => {
          // Ignore errors during cleanup
        });
      },
    };
  }
}

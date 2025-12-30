/**
 * Bun ExecAdapter implementation
 *
 * Uses Bun.spawn() for process execution with full streaming support.
 */

import type {
  ExecAdapter,
  SpawnOptions,
  SpawnResult,
  SpawnHandle,
  StreamHandler,
} from '../../core/adapters.js';
import type { Capabilities } from '../../core/types.js';

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

export class BunExecAdapter implements ExecAdapter {
  getCapabilities(): Capabilities {
    return {
      canSpawnProcess: true,
      canReadEnv: true,
      canWriteTemp: true,
      supportsAbortSignal: true,
      supportsKillSignal: true,
      runtime: 'bun',
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

    const proc = Bun.spawn([command!, ...args], {
      cwd,
      env: env ? { ...Bun.env, ...env } : Bun.env,
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'ignore',
    });

    // Handle abort signal
    const abortHandler = () => {
      aborted = true;
      proc.kill('SIGTERM');
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      // Read streams with handlers if provided
      let stdout = '';
      let stderr = '';

      if (handlers?.onStdout || handlers?.onStderr) {
        // Stream processing mode
        const stdoutPromise = (async () => {
          if (!proc.stdout) return '';
          const reader = proc.stdout.getReader();
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
          if (!proc.stderr) return '';
          const reader = proc.stderr.getReader();
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

  spawnStreaming(options: SpawnOptions): SpawnHandle {
    const { argv, env, cwd, signal } = options;

    if (argv.length === 0) {
      throw new Error('argv must not be empty');
    }

    const [command, ...args] = argv;
    let aborted = false;

    const proc = Bun.spawn([command!, ...args], {
      cwd,
      env: env ? { ...Bun.env, ...env } : Bun.env,
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'ignore',
    });

    const abortHandler = () => {
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
    const [stdout1, stdout2] = proc.stdout!.tee();
    const [stderr1, stderr2] = proc.stderr!.tee();

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
      wait: () => waitPromise,
      kill: (sig?: 'SIGTERM' | 'SIGKILL') => {
        proc.kill(sig ?? 'SIGTERM');
      },
    };
  }
}

/**
 * Node.js ExecAdapter implementation
 */

import { spawn } from 'node:child_process';
import type {
  ExecAdapter,
  SpawnOptions,
  SpawnResult,
  SpawnHandle,
  StreamHandler,
} from '../../core/adapters.js';
import type { Capabilities } from '../../core/types.js';

/**
 * Create an async iterable from a readable stream
 */
async function* streamToAsyncIterable(
  stream: NodeJS.ReadableStream,
): AsyncGenerator<string, void, unknown> {
  let buffer = '';

  for await (const chunk of stream) {
    buffer += chunk.toString('utf8');
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
}

export class NodeExecAdapter implements ExecAdapter {
  getCapabilities(): Capabilities {
    return {
      canSpawnProcess: true,
      canReadEnv: true,
      canWriteTemp: true,
      supportsAbortSignal: true,
      supportsKillSignal: true,
      runtime: 'node',
    };
  }

  async spawn(options: SpawnOptions, handlers?: StreamHandler): Promise<SpawnResult> {
    const { argv, env, cwd, signal } = options;

    if (argv.length === 0) {
      throw new Error('argv must not be empty');
    }

    const [command, ...args] = argv;

    return new Promise((resolve, reject) => {
      const child = spawn(command!, args, {
        cwd,
        env: env ? { ...process.env, ...env } : process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let aborted = false;
      let exitSignal: string | undefined;

      const abortHandler = () => {
        aborted = true;
        child.kill('SIGTERM');
      };

      if (signal) {
        if (signal.aborted) {
          child.kill('SIGTERM');
          aborted = true;
        } else {
          signal.addEventListener('abort', abortHandler, { once: true });
        }
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        stdout += text;
        handlers?.onStdout?.(text);
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        stderr += text;
        handlers?.onStderr?.(text);
      });

      child.on('error', (error) => {
        signal?.removeEventListener('abort', abortHandler);
        reject(error);
      });

      child.on('close', (code, signal) => {
        if (signal) {
          exitSignal = signal;
        }
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
          signal: exitSignal,
          aborted,
        });
      });
    });
  }

  spawnStreaming(options: SpawnOptions): SpawnHandle {
    const { argv, env, cwd, signal } = options;

    if (argv.length === 0) {
      throw new Error('argv must not be empty');
    }

    const [command, ...args] = argv;

    const child = spawn(command!, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let aborted = false;
    let exitSignal: string | undefined;

    const abortHandler = () => {
      aborted = true;
      child.kill('SIGTERM');
    };

    if (signal) {
      if (signal.aborted) {
        child.kill('SIGTERM');
        aborted = true;
      } else {
        signal.addEventListener('abort', abortHandler, { once: true });
      }
    }

    const waitPromise = new Promise<SpawnResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });

      child.on('error', (error) => {
        signal?.removeEventListener('abort', abortHandler);
        reject(error);
      });

      child.on('close', (code, sig) => {
        signal?.removeEventListener('abort', abortHandler);
        if (sig) {
          exitSignal = sig;
        }
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
          signal: exitSignal,
          aborted,
        });
      });
    });

    return {
      stdout: streamToAsyncIterable(child.stdout!),
      stderr: streamToAsyncIterable(child.stderr!),
      wait: () => waitPromise,
      kill: (sig?: 'SIGTERM' | 'SIGKILL') => {
        child.kill(sig ?? 'SIGTERM');
      },
    };
  }
}

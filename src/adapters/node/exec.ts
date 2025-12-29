/**
 * Node.js ExecAdapter implementation
 */

import { spawn } from 'node:child_process';
import type {
  ExecAdapter,
  SpawnOptions,
  SpawnResult,
  StreamHandler,
} from '../../core/adapters.js';
import type { Capabilities } from '../../core/types.js';

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
}

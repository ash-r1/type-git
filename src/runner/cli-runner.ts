/**
 * CLI Runner - Core execution engine for Git commands
 *
 * This module provides:
 * - CliRunner: Executes Git commands with progress tracking and abort support
 * - Progress collection from stderr and LFS progress file
 * - Error mapping from Git exit codes
 */

import type { ExecAdapter, FsAdapter, RuntimeAdapters } from '../core/adapters.js';
import type {
  ExecOpts,
  RawResult,
  Progress,
  GitProgress,
  LfsProgress,
  ExecutionContext,
  GitErrorKind,
} from '../core/types.js';
import { GitError } from '../core/types.js';
import { parseGitProgress, parseLfsProgress } from '../parsers/index.js';

/**
 * Options for CliRunner
 */
export type CliRunnerOptions = {
  /** Git binary path (default: 'git') */
  gitBinary?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
};

/**
 * CLI Runner for executing Git commands
 *
 * Handles:
 * - Command construction based on execution context
 * - Progress tracking from stderr
 * - LFS progress tracking via GIT_LFS_PROGRESS
 * - Abort signal handling
 * - Error mapping
 */
export class CliRunner {
  private readonly exec: ExecAdapter;
  private readonly fs: FsAdapter;
  private readonly gitBinary: string;
  private readonly baseEnv: Record<string, string>;

  constructor(adapters: RuntimeAdapters, options?: CliRunnerOptions) {
    this.exec = adapters.exec;
    this.fs = adapters.fs;
    this.gitBinary = options?.gitBinary ?? 'git';
    this.baseEnv = options?.env ?? {};
  }

  /**
   * Build command argv based on execution context
   */
  private buildArgv(context: ExecutionContext, args: string[]): string[] {
    const argv = [this.gitBinary];

    switch (context.type) {
      case 'global':
        // No additional flags
        break;
      case 'worktree':
        argv.push('-C', context.workdir);
        break;
      case 'bare':
        argv.push('--git-dir', context.gitDir);
        break;
    }

    argv.push(...args);
    return argv;
  }

  /**
   * Run a Git command
   */
  async run(
    context: ExecutionContext,
    args: string[],
    opts?: ExecOpts,
  ): Promise<RawResult> {
    const argv = this.buildArgv(context, args);
    const { signal, onProgress } = opts ?? {};

    // Set up LFS progress tracking if callback provided
    let lfsProgressFile: string | undefined;
    let lfsAbortController: AbortController | undefined;
    const env = { ...this.baseEnv };

    if (onProgress) {
      try {
        lfsProgressFile = await this.fs.createTempFile('type-git-lfs-');
        await this.fs.writeFile!(lfsProgressFile, '');
        env.GIT_LFS_PROGRESS = lfsProgressFile;
        lfsAbortController = new AbortController();

        // Start tailing LFS progress file in background
        this.tailLfsProgress(lfsProgressFile, lfsAbortController.signal, onProgress).catch(
          () => {
            // Ignore errors from tailing
          },
        );
      } catch {
        // If we can't create temp file, continue without LFS progress
      }
    }

    try {
      const result = await this.exec.spawn(
        {
          argv,
          env,
          cwd: context.type === 'worktree' ? context.workdir : undefined,
          signal,
        },
        onProgress
          ? {
              onStderr: (chunk) => {
                this.parseStderrProgress(chunk, onProgress);
              },
            }
          : undefined,
      );

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        aborted: result.aborted,
      };
    } finally {
      // Clean up LFS progress tracking
      if (lfsAbortController) {
        lfsAbortController.abort();
      }
      if (lfsProgressFile) {
        await this.fs.deleteFile(lfsProgressFile).catch(() => {
          // Ignore cleanup errors
        });
      }
    }
  }

  /**
   * Parse Git progress from stderr chunk
   */
  private parseStderrProgress(
    chunk: string,
    onProgress: (progress: Progress) => void,
  ): void {
    // Git progress often uses \r for in-place updates
    const lines = chunk.split(/[\r\n]+/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const progress = parseGitProgress(trimmed);
      if (progress) {
        const gitProgress: GitProgress = {
          kind: 'git',
          phase: progress.phase,
          current: progress.current,
          total: progress.total,
          percent: progress.percent,
          message: trimmed,
        };
        onProgress(gitProgress);
      }
    }
  }

  /**
   * Tail LFS progress file
   */
  private async tailLfsProgress(
    filePath: string,
    signal: AbortSignal,
    onProgress: (progress: Progress) => void,
  ): Promise<void> {
    await this.fs.tail({
      filePath,
      signal,
      onLine: (line) => {
        const progress = parseLfsProgress(line);
        if (progress) {
          const lfsProgress: LfsProgress = {
            kind: 'lfs',
            direction: progress.direction,
            oid: progress.oid,
            bytesTransferred: progress.bytesTransferred,
            bytesSoFar: progress.bytesSoFar,
            bytesTotal: progress.bytesTotal,
          };
          onProgress(lfsProgress);
        }
      },
    });
  }

  /**
   * Map Git result to GitError if needed
   */
  mapError(
    result: RawResult,
    context: ExecutionContext,
    argv: string[],
  ): GitError | null {
    if (result.aborted) {
      return new GitError('Aborted', 'Command was aborted', {
        argv,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        ...(context.type === 'worktree' && { workdir: context.workdir }),
        ...(context.type === 'bare' && { gitDir: context.gitDir }),
      });
    }

    if (result.exitCode !== 0) {
      const kind = this.classifyError(result);
      const message = this.extractErrorMessage(result);

      return new GitError(kind, message, {
        argv,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        ...(context.type === 'worktree' && { workdir: context.workdir }),
        ...(context.type === 'bare' && { gitDir: context.gitDir }),
      });
    }

    return null;
  }

  /**
   * Classify error type based on stderr content
   */
  private classifyError(result: RawResult): GitErrorKind {
    const stderr = result.stderr.toLowerCase();

    // Spawn failures (usually exit code -1 or specific patterns)
    if (result.exitCode === -1 || stderr.includes('command not found')) {
      return 'SpawnFailed';
    }

    // All other non-zero exits
    return 'NonZeroExit';
  }

  /**
   * Extract user-friendly error message from stderr
   */
  private extractErrorMessage(result: RawResult): string {
    const stderr = result.stderr.trim();

    // Look for "fatal:" or "error:" prefixed messages
    const fatalMatch = stderr.match(/fatal:\s*(.+)/i);
    if (fatalMatch) {
      return fatalMatch[1]!;
    }

    const errorMatch = stderr.match(/error:\s*(.+)/i);
    if (errorMatch) {
      return errorMatch[1]!;
    }

    // Return first line or generic message
    const firstLine = stderr.split('\n')[0];
    return firstLine || `Git exited with code ${result.exitCode}`;
  }

  /**
   * Run a command and throw on error
   */
  async runOrThrow(
    context: ExecutionContext,
    args: string[],
    opts?: ExecOpts,
  ): Promise<RawResult> {
    const result = await this.run(context, args, opts);
    const error = this.mapError(result, context, this.buildArgv(context, args));

    if (error) {
      throw error;
    }

    return result;
  }
}

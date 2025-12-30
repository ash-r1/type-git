/**
 * CLI Runner - Core execution engine for Git commands
 *
 * This module provides:
 * - CliRunner: Executes Git commands with progress tracking and abort support
 * - Progress collection from stderr and LFS progress file
 * - Error mapping from Git exit codes
 */

import process from 'node:process';
import type { ExecAdapter, FsAdapter, RuntimeAdapters } from '../core/adapters.js';
import type {
  ExecOpts,
  ExecutionContext,
  GitErrorKind,
  GitProgress,
  LfsProgress,
  Progress,
  RawResult,
} from '../core/types.js';
import { GitError } from '../core/types.js';
import { detectErrorCategory, parseGitProgress, parseLfsProgress } from '../parsers/index.js';

/**
 * Regex patterns for error message extraction
 */
const FATAL_ERROR_PATTERN = /fatal:\s*(.+)/i;
const ERROR_PATTERN = /error:\s*(.+)/i;

/**
 * Credential helper configuration
 */
export type CredentialHelperConfig = {
  /** Helper name (e.g., 'store', 'cache', 'manager-core', or custom name) */
  helper?: string;
  /** Path to custom helper binary */
  helperPath?: string;
};

/**
 * Options for CliRunner
 */
export type CliRunnerOptions = {
  /** Git binary path (default: 'git') */
  gitBinary?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Directories to prepend to PATH */
  pathPrefix?: Array<string>;
  /** Custom HOME directory for git config isolation */
  home?: string;
  /** Credential helper configuration */
  credential?: CredentialHelperConfig;
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
  private readonly pathPrefix: Array<string>;
  private readonly home: string | undefined;
  private readonly credential: CredentialHelperConfig | undefined;

  public constructor(adapters: RuntimeAdapters, options?: CliRunnerOptions) {
    this.exec = adapters.exec;
    this.fs = adapters.fs;
    this.gitBinary = options?.gitBinary ?? 'git';
    this.baseEnv = options?.env ?? {};
    this.pathPrefix = options?.pathPrefix ?? [];
    this.home = options?.home;
    this.credential = options?.credential;
  }

  /**
   * Create a new CliRunner with additional options merged
   *
   * Used to create a runner for a specific repository with custom environment
   */
  public withOptions(options: CliRunnerOptions): CliRunner {
    const mergedEnv = { ...this.baseEnv, ...options.env };
    const mergedPathPrefix = [...this.pathPrefix, ...(options.pathPrefix ?? [])];
    const home = options.home ?? this.home;
    const credential = options.credential ?? this.credential;

    return new CliRunner(
      { exec: this.exec, fs: this.fs },
      {
        gitBinary: options.gitBinary ?? this.gitBinary,
        env: mergedEnv,
        pathPrefix: mergedPathPrefix,
        home,
        credential,
      },
    );
  }

  /**
   * Build command argv based on execution context
   */
  private buildArgv(context: ExecutionContext, args: Array<string>): Array<string> {
    const argv = [this.gitBinary];

    // Add credential helper configuration before context flags
    if (this.credential?.helper) {
      argv.push('-c', `credential.helper=${this.credential.helper}`);
    }

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
   * Build the effective environment for command execution
   *
   * Applies home directory and PATH prefix overrides
   */
  private buildEnv(): Record<string, string> {
    const env: Record<string, string> = { ...this.baseEnv };

    // Apply home directory override
    if (this.home) {
      env.HOME = this.home;
      // Also set USERPROFILE for Windows compatibility
      env.USERPROFILE = this.home;
    }

    // Collect all PATH prefixes
    const allPathPrefixes = [...this.pathPrefix];

    // Add credential helper path directory if specified
    if (this.credential?.helperPath) {
      const helperDir = this.extractDirectory(this.credential.helperPath);
      if (helperDir) {
        allPathPrefixes.unshift(helperDir);
      }
    }

    // Apply PATH prefix
    if (allPathPrefixes.length > 0) {
      const separator = process.platform === 'win32' ? ';' : ':';
      const currentPath = process.env.PATH ?? '';
      env.PATH = [...allPathPrefixes, currentPath].join(separator);
    }

    return env;
  }

  /**
   * Extract directory from a file path
   */
  private extractDirectory(filePath: string): string | undefined {
    const separator = filePath.includes('/') ? '/' : '\\';
    const lastIndex = filePath.lastIndexOf(separator);
    if (lastIndex > 0) {
      return filePath.substring(0, lastIndex);
    }
    return undefined;
  }

  /**
   * Run a Git command
   */
  public async run(
    context: ExecutionContext,
    args: Array<string>,
    opts?: ExecOpts,
  ): Promise<RawResult> {
    const argv = this.buildArgv(context, args);
    const { signal, onProgress } = opts ?? {};

    // Set up LFS progress tracking if callback provided
    let lfsProgressFile: string | undefined;
    let lfsAbortController: AbortController | undefined;
    const env = this.buildEnv();

    if (onProgress) {
      try {
        lfsProgressFile = await this.fs.createTempFile('type-git-lfs-');
        await this.fs.writeFile?.(lfsProgressFile, '');
        env.GIT_LFS_PROGRESS = lfsProgressFile;
        lfsAbortController = new AbortController();

        // Start tailing LFS progress file in background
        this.tailLfsProgress(lfsProgressFile, lfsAbortController.signal, onProgress).catch(() => {
          // Ignore errors from tailing
        });
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
  private parseStderrProgress(chunk: string, onProgress: (progress: Progress) => void): void {
    // Git progress often uses \r for in-place updates
    const lines = chunk.split(/[\r\n]+/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

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
  public mapError(
    result: RawResult,
    context: ExecutionContext,
    argv: Array<string>,
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
      const category = detectErrorCategory(result.stderr);

      return new GitError(
        kind,
        message,
        {
          argv,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          ...(context.type === 'worktree' && { workdir: context.workdir }),
          ...(context.type === 'bare' && { gitDir: context.gitDir }),
        },
        category,
      );
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
    const fatalMatch = stderr.match(FATAL_ERROR_PATTERN);
    const fatalMessage = fatalMatch?.[1];
    if (fatalMessage) {
      return fatalMessage;
    }

    const errorMatch = stderr.match(ERROR_PATTERN);
    const errorMessage = errorMatch?.[1];
    if (errorMessage) {
      return errorMessage;
    }

    // Return first line or generic message
    const firstLine = stderr.split('\n')[0];
    return firstLine || `Git exited with code ${result.exitCode}`;
  }

  /**
   * Run a command and throw on error
   */
  public async runOrThrow(
    context: ExecutionContext,
    args: Array<string>,
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

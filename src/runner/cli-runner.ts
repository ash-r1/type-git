/**
 * CLI Runner - Core execution engine for Git commands
 *
 * This module provides:
 * - CliRunner: Executes Git commands with progress tracking and abort support
 * - Progress collection from stderr (Git and LFS)
 * - Error mapping from Git exit codes
 */

import process from 'node:process';
import type { ExecAdapter, RuntimeAdapters } from '../core/adapters.js';
import type {
  AuditConfig,
  ExecOpts,
  ExecutionContext,
  GitErrorKind,
  GitProgress,
  LfsProgress,
  RawResult,
} from '../core/types.js';
import { GitError } from '../core/types.js';
import { detectErrorCategory, parseGitProgress, parseLfsStderrProgress } from '../parsers/index.js';

/**
 * Regex patterns for error message extraction
 */
const FATAL_ERROR_PATTERN = /fatal:\s*(.+)/i;
const ERROR_PATTERN = /error:\s*(.+)/i;

/**
 * Regex pattern for splitting lines by carriage return or newline
 */
const LINE_SEPARATOR_PATTERN = /\r|\n/;

/**
 * Regex pattern for GIT_TRACE output lines
 * Format: "HH:MM:SS.microseconds trace: ..." or "HH:MM:SS.microseconds git.c:..."
 * Must match the trace: prefix or a source file pattern (e.g., git.c:, run-command.c:)
 */
const GIT_TRACE_PATTERN = /^\d{2}:\d{2}:\d{2}\.\d+\s+(?:trace:|[A-Za-z0-9_.-]+\.c:)/;

/**
 * Convert parsed LFS stderr progress to LfsProgress type
 */
function toLfsProgress(info: ReturnType<typeof parseLfsStderrProgress>): LfsProgress | null {
  if (!info) {
    return null;
  }
  return {
    direction: info.direction,
    bytesSoFar: info.bytesSoFar,
    bytesTotal: info.bytesTotal,
    bitrate: info.bitrate ?? undefined,
    filesCompleted: info.filesCompleted,
    filesTotal: info.filesTotal,
    percent: info.percent,
  };
}

/**
 * Convert parsed Git progress to GitProgress type
 */
function toGitProgress(
  info: ReturnType<typeof parseGitProgress>,
  message: string,
): GitProgress | null {
  if (!info) {
    return null;
  }
  return {
    phase: info.phase,
    current: info.current,
    total: info.total,
    percent: info.percent,
    message,
  };
}

/**
 * Process a single line for progress callbacks
 */
function processProgressLine(
  line: string,
  onProgress: ((progress: GitProgress) => void) | undefined,
  onLfsProgress: ((progress: LfsProgress) => void) | undefined,
): void {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  // Try to parse as LFS progress first (more specific patterns)
  if (onLfsProgress) {
    const lfsProgress = toLfsProgress(parseLfsStderrProgress(trimmed));
    if (lfsProgress) {
      onLfsProgress(lfsProgress);
      return;
    }
  }

  // Try to parse as Git progress
  if (onProgress) {
    const gitProgress = toGitProgress(parseGitProgress(trimmed), trimmed);
    if (gitProgress) {
      onProgress(gitProgress);
    }
  }
}

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
  pathPrefix?: string[];
  /** Custom HOME directory for git config isolation */
  home?: string;
  /** Credential helper configuration */
  credential?: CredentialHelperConfig;
  /** Audit configuration for command tracking and tracing */
  audit?: AuditConfig;
};

/**
 * CLI Runner for executing Git commands
 *
 * Handles:
 * - Command construction based on execution context
 * - Progress tracking from stderr (Git and LFS)
 * - Abort signal handling
 * - Error mapping
 */
export class CliRunner {
  private readonly exec: ExecAdapter;
  private readonly gitBinary: string;
  private readonly baseEnv: Record<string, string>;
  private readonly pathPrefix: string[];
  private readonly home: string | undefined;
  private readonly credential: CredentialHelperConfig | undefined;
  private readonly audit: AuditConfig | undefined;

  public constructor(adapters: RuntimeAdapters, options?: CliRunnerOptions) {
    this.exec = adapters.exec;
    this.gitBinary = options?.gitBinary ?? 'git';
    this.baseEnv = options?.env ?? {};
    this.pathPrefix = options?.pathPrefix ?? [];
    this.home = options?.home;
    this.credential = options?.credential;
    this.audit = options?.audit;
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
    const audit = options.audit ?? this.audit;

    return new CliRunner(
      {
        exec: this.exec,
        fs: {
          createTempFile: async (): Promise<string> => '',
          deleteFile: async (): Promise<void> => undefined,
          deleteDirectory: async (): Promise<void> => undefined,
          tail: async (): Promise<void> => undefined,
          exists: async (): Promise<boolean> => false,
        },
      },
      {
        gitBinary: options.gitBinary ?? this.gitBinary,
        env: mergedEnv,
        pathPrefix: mergedPathPrefix,
        home,
        credential,
        audit,
      },
    );
  }

  /**
   * Build command argv based on execution context
   */
  private buildArgv(context: ExecutionContext, args: string[]): string[] {
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

    // Enable GIT_TRACE when trace callback is provided (only if not already set)
    if (this.audit?.onTrace) {
      if (env.GIT_TRACE === undefined) {
        env.GIT_TRACE = '1';
      } else if (!env.GIT_TRACE || env.GIT_TRACE === '0') {
        // Warn if user explicitly disabled GIT_TRACE but provided onTrace callback
        console.warn(
          'type-git: onTrace callback provided but GIT_TRACE is disabled. ' +
            'Trace events will not be emitted.',
        );
      }
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
  public async run(context: ExecutionContext, args: string[], opts?: ExecOpts): Promise<RawResult> {
    const argv = this.buildArgv(context, args);
    const { signal, onProgress, onLfsProgress } = opts ?? {};

    const env = this.buildEnv();

    // Enable LFS progress output to stderr when LFS progress callback is provided
    if (onLfsProgress) {
      env.GIT_LFS_FORCE_PROGRESS = '1';
    }

    // Capture start timestamp for duration calculation
    const startTimestamp = Date.now();

    // Emit audit start event
    if (this.audit?.onAudit) {
      this.audit.onAudit({
        type: 'start',
        timestamp: startTimestamp,
        argv,
        context,
      });
    }

    // Buffer for handling carriage return lines (LFS uses \r for in-place updates)
    let stderrBuffer = '';

    // Determine if we need stderr streaming
    const needsStderrStreaming = onProgress || onLfsProgress || this.audit?.onTrace;

    let result: Awaited<ReturnType<ExecAdapter['spawn']>>;
    try {
      result = await this.exec.spawn(
        {
          argv,
          env,
          cwd: context.type === 'worktree' ? context.workdir : undefined,
          signal,
        },
        needsStderrStreaming
          ? {
              onStderr: (chunk: string) => {
                // Accumulate chunk into buffer
                stderrBuffer += chunk;

                // Process complete lines (split by \r or \n)
                // Keep incomplete line in buffer
                const lines = stderrBuffer.split(LINE_SEPARATOR_PATTERN);
                stderrBuffer = lines.pop() ?? '';

                for (const line of lines) {
                  this.processStderrLine(line, onProgress, onLfsProgress);
                }
              },
            }
          : undefined,
      );

      // Process any remaining content in buffer
      if (stderrBuffer.trim() && needsStderrStreaming) {
        this.processStderrLine(stderrBuffer, onProgress, onLfsProgress);
      }
    } catch (error) {
      // Emit audit end event for spawn failures
      if (this.audit?.onAudit) {
        const endTimestamp = Date.now();
        this.audit.onAudit({
          type: 'end',
          timestamp: endTimestamp,
          argv,
          context,
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
          exitCode: -1,
          aborted: signal?.aborted ?? false,
          duration: endTimestamp - startTimestamp,
        });
      }
      throw error;
    }

    // Emit audit end event
    if (this.audit?.onAudit) {
      const endTimestamp = Date.now();
      this.audit.onAudit({
        type: 'end',
        timestamp: endTimestamp,
        argv,
        context,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        aborted: result.aborted,
        duration: endTimestamp - startTimestamp,
      });
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      aborted: result.aborted,
    };
  }

  /**
   * Process a single line from stderr for progress and trace callbacks
   */
  private processStderrLine(
    line: string,
    onProgress: ((progress: GitProgress) => void) | undefined,
    onLfsProgress: ((progress: LfsProgress) => void) | undefined,
  ): void {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    // Check for trace output (GIT_TRACE lines start with specific patterns)
    if (this.audit?.onTrace && GIT_TRACE_PATTERN.test(trimmed)) {
      this.audit.onTrace({
        timestamp: Date.now(),
        line: trimmed,
      });
      return;
    }

    // Process progress lines
    processProgressLine(line, onProgress, onLfsProgress);
  }

  /**
   * Map Git result to GitError if needed
   */
  public mapError(result: RawResult, context: ExecutionContext, argv: string[]): GitError | null {
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

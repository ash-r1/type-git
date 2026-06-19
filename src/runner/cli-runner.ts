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
import { type EnvInheritance, resolveInheritedEnv } from '../core/env.js';
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
  /**
   * Controls how the parent process environment is inherited by spawned Git commands.
   *
   * By default, only a curated allowlist of variables that Git needs to operate is
   * inherited (environment variable traversal prevention); the full parent environment is
   * NOT forwarded. See {@link EnvInheritance} for all options.
   *
   * @default undefined (inherit the default allowlist)
   */
  inheritEnv?: EnvInheritance;
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
 * Per-call options for {@link CliRunner.run} / {@link CliRunner.runOrThrow}.
 *
 * Extends {@link ExecOpts} with an `env` overlay so callers (e.g. the repository
 * implementations) can inject command-specific environment variables — such as
 * `GIT_LFS_SKIP_SMUDGE` for an LFS skip-smudge mode. This keeps `env` out of the
 * public `ExecOpts` / repository operation option types, scoping it to the
 * runner's own `run` / `runOrThrow` entry points.
 */
export type RunOptions = ExecOpts & {
  /**
   * Extra environment variables merged on top of the resolved environment for
   * this single command. Values here take precedence over the configured
   * environment but do not persist across calls.
   */
  env?: Record<string, string>;
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
  private readonly inheritEnv: EnvInheritance | undefined;
  private readonly pathPrefix: string[];
  private readonly home: string | undefined;
  private readonly credential: CredentialHelperConfig | undefined;
  private readonly audit: AuditConfig | undefined;

  public constructor(adapters: RuntimeAdapters, options?: CliRunnerOptions) {
    this.exec = adapters.exec;
    this.gitBinary = options?.gitBinary ?? 'git';
    this.baseEnv = options?.env ?? {};
    this.inheritEnv = options?.inheritEnv;
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
    const inheritEnv = options.inheritEnv ?? this.inheritEnv;
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
        inheritEnv,
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
   * Seeds the environment from the inherited (allowlisted) parent variables, then layers
   * the configured `env`, home directory, and PATH prefix overrides on top. The parent
   * process environment is never forwarded wholesale unless `inheritEnv: true` is set
   * (environment variable traversal prevention).
   */
  private buildEnv(): Record<string, string> {
    const env: Record<string, string> = {
      ...resolveInheritedEnv(process.env, this.inheritEnv, process.platform),
      ...this.baseEnv,
    };

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
      const isWindows = process.platform === 'win32';
      const separator = isWindows ? ';' : ':';
      // On Windows, env var names are case-insensitive and PATH is commonly stored as
      // `Path`; reuse whatever case variant exists so the prefix is applied to the
      // inherited value instead of orphaning it under a duplicate `PATH` key. On other
      // platforms names are case-sensitive, so always use the canonical `PATH`.
      const pathKey = isWindows
        ? (Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH')
        : 'PATH';
      // Prepend to the already-resolved PATH (which respects the inheritEnv allowlist)
      const currentPath = env[pathKey] ?? '';
      env[pathKey] = [...allPathPrefixes, currentPath].join(separator);
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
  public async run(
    context: ExecutionContext,
    args: string[],
    opts?: RunOptions,
  ): Promise<RawResult> {
    const argv = this.buildArgv(context, args);
    const { signal, onProgress, onLfsProgress, env: envOverride } = opts ?? {};

    const env = this.buildEnv();

    // Apply per-call environment overrides (e.g. GIT_LFS_SKIP_SMUDGE) on top of
    // the resolved environment.
    if (envOverride) {
      Object.assign(env, envOverride);
    }

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
          // The env above is already fully resolved (including any inherited variables),
          // so the adapter must not merge the parent environment on top of it.
          inheritEnv: false,
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
    opts?: RunOptions,
  ): Promise<RawResult> {
    const result = await this.run(context, args, opts);
    const error = this.mapError(result, context, this.buildArgv(context, args));

    if (error) {
      throw error;
    }

    return result;
  }
}

import { validInitialDepth } from '../constraints/git-scalars.js';
import {
  OBJECT_FILTER_CHAR_PROBE,
  OBJECT_FILTER_EMPTY_PROBE,
  objectFilterCombineEmptyComponents,
  objectFilterUnsignedChar,
  objectFilterUsesEmptyComponent,
} from '../constraints/object-filter.js';
import { validateOptions as checkOptions } from '../core/option-rules.js';
/**
 * CLI Runner - Core execution engine for Git commands
 *
 * This module provides:
 * - CliRunner: Executes Git commands with progress tracking and abort support
 * - Progress collection from stderr (Git and LFS)
 * - Error mapping from Git exit codes
 */

import process from 'node:process';
import type {
  ExecAdapter,
  FsAdapter,
  RuntimeAdapters,
  SpawnOptions,
  SpawnResult,
  StreamHandler,
} from '../core/adapters.js';
import { type EnvInheritance, resolveInheritedEnv } from '../core/env.js';
import type {
  AuditConfig,
  CompanionExecutable,
  ExecOpts,
  ExecutionContext,
  GitErrorKind,
  GitOutputMode,
  GitProgress,
  LfsProgress,
  RawResult,
} from '../core/types.js';
import { GitArgumentError, GitError } from '../core/types.js';
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

/** Variables that make Git (or curl) write diagnostics into stderr alongside its own messages. */
const TRACE_ENV_PATTERN = /^(?:GIT_TRACE\w*|GIT_CURL_VERBOSE)$/i;

/** Remove tracing variables (GIT_TRACE, GIT_TRACE2*, GIT_TRACE_*, GIT_CURL_VERBOSE) in place. */
function stripTraceEnv(env: Record<string, string>): void {
  for (const key of Object.keys(env)) {
    if (TRACE_ENV_PATTERN.test(key)) {
      delete env[key];
    }
  }
}

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
  /** Paths for upstream standalone programs; gitweb defaults to gitweb.cgi on PATH. */
  companionBinaries?: Partial<Record<CompanionExecutable, string>>;
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
  /** UTF-8 text to write to standard input, then close it. */
  stdin?: string | Uint8Array;
  /**
   * Extra environment variables merged on top of the resolved environment for
   * this single command. Values here take precedence over the configured
   * environment but do not persist across calls.
   */
  env?: Record<string, string>;
};

/** Run options accepted by grammar-checked command execution. */
export type CommandRunOptions = RunOptions & { stdout?: GitOutputMode };

/** Reject per-call environment entries that a process environment cannot represent. */
function validateEnv(env: unknown): void {
  if (env === undefined) {
    return;
  }
  if (env === null || typeof env !== 'object' || Array.isArray(env)) {
    throw new GitArgumentError('env must be an object of string values');
  }
  for (const [name, value] of Object.entries(env)) {
    // `__proto__` cannot be copied onto the resolved environment as an own variable.
    if (name === '' || name === '__proto__' || name.includes('=') || name.includes('\0')) {
      throw new GitArgumentError(
        `env name must be non-empty, not __proto__, and contain neither '=' nor NUL: ${JSON.stringify(name)}`,
      );
    }
    if (typeof value !== 'string' || value.includes('\0')) {
      throw new GitArgumentError(`env value for ${name} must be a string without NUL`);
    }
  }
}

/**
 * Apply per-call variables on top of the resolved environment. Windows treats names
 * case-insensitively and passes only one of several same-named keys to the child, so an
 * existing key that differs only in case is removed before the per-call value is set.
 */
function applyEnvOverride(env: Record<string, string>, override: Record<string, string>): void {
  const isWindows = process.platform === 'win32';
  for (const [name, value] of Object.entries(override)) {
    if (isWindows) {
      const lower = name.toLowerCase();
      for (const key of Object.keys(env)) {
        if (key !== name && key.toLowerCase() === lower) {
          delete env[key];
        }
      }
    }
    env[name] = value;
  }
}

/** Validate per-call stdin and env before any process starts. */
export function validateIO(opts: CommandRunOptions | undefined): void {
  validateEnv(opts?.env);
  if (opts?.stdout !== undefined && opts.stdout !== 'text' && opts.stdout !== 'bytes') {
    throw new GitArgumentError('stdout must be text or bytes');
  }
  const input = opts?.stdin;
  if (
    input !== undefined &&
    typeof input !== 'string' &&
    !(ArrayBuffer.isView(input) && Object.prototype.toString.call(input) === '[object Uint8Array]')
  ) {
    throw new GitArgumentError('stdin must be a string or Uint8Array');
  }
}

/**
 * Execution hooks shared with the grammar-checked command runner in `type-git/strict`.
 *
 * Not part of the public API: the strict entry point reaches the runner's adapters and
 * internal probe paths through this accessor instead of public members.
 */
export type CliRunnerInternals = {
  readonly exec: ExecAdapter;
  readonly fs: FsAdapter;
  run(context: ExecutionContext, args: string[], opts?: RunOptions): Promise<RawResult>;
  runBytes(
    context: ExecutionContext,
    args: string[],
    opts?: RunOptions,
  ): Promise<RawResult<Uint8Array>>;
  runCompanion(
    context: ExecutionContext,
    executable: CompanionExecutable,
    args: string[],
    opts?: RunOptions,
  ): Promise<RawResult>;
  runCompanionBytes(
    context: ExecutionContext,
    executable: CompanionExecutable,
    args: string[],
    opts?: RunOptions,
  ): Promise<RawResult<Uint8Array>>;
  probe(context: ExecutionContext, args: string[], opts?: RunOptions): Promise<RawResult>;
  runRepositoryProbe(
    context: ExecutionContext,
    args: string[],
    opts: RunOptions,
  ): Promise<RawResult>;
  observeDepthAtoi(
    context: ExecutionContext,
    opts?: RunOptions,
  ): Promise<{ bits: 32 | 64 | undefined; result: RawResult | undefined }>;
};

let internalsOf: ((runner: CliRunner) => CliRunnerInternals) | undefined;

/** Reach the runner's internal execution hooks (strict entry point only). */
export function cliRunnerInternals(runner: CliRunner): CliRunnerInternals {
  // biome-ignore lint/style/noNonNullAssertion: assigned by CliRunner's static block at load.
  return internalsOf!(runner);
}

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
  static {
    internalsOf = (runner) => ({
      exec: runner.exec,
      fs: runner.fs,
      run: runner.run.bind(runner),
      runBytes: runner.runBytes.bind(runner),
      runCompanion: runner.runCompanion.bind(runner),
      runCompanionBytes: runner.runCompanionBytes.bind(runner),
      probe: runner.probe.bind(runner),
      runRepositoryProbe: runner.runRepositoryProbe.bind(runner),
      observeDepthAtoi: runner.observeDepthAtoi.bind(runner),
    });
  }

  private readonly exec: ExecAdapter;
  private readonly fs: FsAdapter;
  private readonly gitBinary: string;
  private readonly companionBinaries: Record<CompanionExecutable, string>;
  private readonly baseEnv: Record<string, string>;
  private readonly inheritEnv: EnvInheritance | undefined;
  private readonly pathPrefix: string[];
  private readonly home: string | undefined;
  private readonly credential: CredentialHelperConfig | undefined;
  private readonly audit: AuditConfig | undefined;

  public constructor(adapters: RuntimeAdapters, options?: CliRunnerOptions) {
    this.exec = adapters.exec;
    this.fs = adapters.fs;
    this.gitBinary = options?.gitBinary ?? 'git';
    this.companionBinaries = {
      scalar: options?.companionBinaries?.scalar ?? 'scalar',
      gitk: options?.companionBinaries?.gitk ?? 'gitk',
      gitweb: options?.companionBinaries?.gitweb ?? 'gitweb.cgi',
    };
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
        fs: this.fs,
      },
      {
        gitBinary: options.gitBinary ?? this.gitBinary,
        companionBinaries: {
          scalar: options.companionBinaries?.scalar ?? this.companionBinaries.scalar,
          gitk: options.companionBinaries?.gitk ?? this.companionBinaries.gitk,
          gitweb: options.companionBinaries?.gitweb ?? this.companionBinaries.gitweb,
        },
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
  private buildEnv(executable?: CompanionExecutable, internal = false): Record<string, string> {
    let inheritEnv = this.inheritEnv;
    if (
      executable === 'gitk' &&
      inheritEnv !== true &&
      inheritEnv !== false &&
      typeof inheritEnv !== 'function'
    ) {
      const displayVariables = ['DISPLAY', 'XAUTHORITY'];
      inheritEnv = Array.isArray(inheritEnv)
        ? [...inheritEnv, ...displayVariables]
        : { ...inheritEnv, add: [...(inheritEnv?.add ?? []), ...displayVariables] };
    }
    const env: Record<string, string> = {
      ...resolveInheritedEnv(process.env, inheritEnv, process.platform),
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
    if (this.audit?.onTrace && !internal) {
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
  /** Resolve environment-dependent filter constraints before convenience execution. */
  public async validateFilterOptions(
    context: ExecutionContext,
    name: 'clone' | 'submoduleUpdate',
    options: object | undefined,
    opts?: RunOptions,
  ): Promise<void> {
    await this.validateNativeOptions(context, name, options, opts);
  }

  /** Resolve mainline narrowing against the executable used by the convenience call. */
  public async validateMainlineOptions(
    context: ExecutionContext,
    name: 'cherryPick' | 'revert',
    options: object | undefined,
    opts?: RunOptions,
  ): Promise<void> {
    await this.validateNativeOptions(context, name, options, opts);
  }

  /**
   * Run a probe of a builtin that requires a repository (RUN_SETUP).
   *
   * Global contexts carry no repository, so such probes would otherwise discover one from the
   * process working directory: outside a repository Git dies before parsing options, and inside
   * an unrelated one its configuration leaks in. Run them against a throwaway empty repository.
   */
  private async runRepositoryProbe(
    context: ExecutionContext,
    args: string[],
    opts: RunOptions,
  ): Promise<RawResult> {
    if (context.type !== 'global') {
      return await this.probe(context, args, opts);
    }
    if (opts.signal?.aborted) {
      return { stdout: '', stderr: '', exitCode: -1, aborted: true };
    }
    const directory = this.fs.createTempDirectory
      ? await this.fs.createTempDirectory('type-git-probe-')
      : undefined;
    const file = directory === undefined ? await this.fs.createTempFile('type-git-probe-') : '';
    const gitDir = directory ?? `${file}-repo`;
    try {
      const init = await this.probe(context, ['init', '--bare', '--quiet', gitDir], opts);
      if (init.aborted || init.exitCode !== 0) {
        return init;
      }
      return await this.probe({ type: 'bare', gitDir }, args, opts);
    } finally {
      await this.fs.deleteDirectory(gitDir);
      if (directory === undefined) {
        await this.fs.deleteFile(file);
      }
    }
  }

  /** Observe atoi using an existing file so clone stops before transport or destination creation. */
  private async observeDepthAtoi(context: ExecutionContext, opts?: RunOptions) {
    if (!this.fs.writeFile) {
      return { bits: undefined, result: undefined };
    }
    const destination = await this.fs.createTempFile('type-git-depth-profile-');
    try {
      await this.fs.writeFile(destination, '');
      const result = await this.probe(
        context,
        ['clone', '--depth=2147483648', 'type-git-depth-profile:invalid', destination],
        {
          ...(opts?.env ? { env: opts.env } : {}),
          ...(opts?.signal ? { signal: opts.signal } : {}),
        },
      );
      let bits: 32 | 64 | undefined;
      if (!result.aborted && result.exitCode === 128) {
        if (result.stderr.trim() === 'fatal: depth 2147483648 is not a positive number') {
          bits = 64;
        } else if (
          result.stderr.trim() ===
          `fatal: destination path '${destination}' already exists and is not an empty directory.`
        ) {
          bits = 32;
        }
      }
      return { bits, result };
    } finally {
      await this.fs.deleteFile(destination);
    }
  }

  /** Resolve depth and other native constraints for a convenience fetch call. */
  public async validateFetchOptions(
    context: ExecutionContext,
    options: object | undefined,
    opts?: RunOptions,
  ): Promise<void> {
    await this.validateNativeOptions(context, 'fetch', options, opts);
  }

  /** Check universally invalid input first, then only the native dimensions that affect validity. */
  private async validateNativeOptions(
    context: ExecutionContext,
    name: 'clone' | 'submoduleUpdate' | 'cherryPick' | 'revert' | 'fetch',
    options: object | undefined,
    opts?: RunOptions,
  ): Promise<void> {
    validateIO(opts);
    const depth =
      name === 'clone' || name === 'fetch'
        ? (options as { depth?: unknown } | undefined)?.depth
        : undefined;
    const depthValid = ([32, 64] as const).filter(
      (bits) => depth === undefined || validInitialDepth(depth, bits),
    );
    let depthAtoiBits: 32 | 64 = depthValid[0] ?? 64;
    const valid: {
      longBits: 32 | 64;
      negativeMagnitudes: boolean;
      unsignedChar: boolean;
      depthAtoiBits: 32 | 64;
    }[] = [];
    let firstError: GitArgumentError | undefined;
    for (const longBits of [32, 64] as const) {
      for (const negativeMagnitudes of [false, true]) {
        for (const unsignedChar of [false, true]) {
          try {
            checkOptions(name, options, {
              longBits,
              negativeMagnitudes,
              unsignedChar,
              depthAtoiBits,
            });
            valid.push({ longBits, negativeMagnitudes, unsignedChar, depthAtoiBits });
          } catch (error) {
            if (!(error instanceof GitArgumentError)) {
              throw error;
            }
            firstError ??= error;
          }
        }
      }
    }
    if (valid.length === 0) {
      throw firstError;
    }
    if (depth !== undefined && depthValid.length === 1) {
      const observed = await this.observeDepthAtoi(context, opts);
      if (observed.result?.aborted) {
        throw this.mapError(observed.result, context, this.buildArgv(context, ['clone']));
      }
      if (observed.bits !== undefined) {
        depthAtoiBits = observed.bits;
        // Reject native-invalid depth while retaining all relational option checks.
        checkOptions(name, options, { ...valid[0]!, depthAtoiBits });
      }
    }
    const probeOptions = {
      ...(opts?.env ? { env: opts.env } : {}),
      ...(opts?.signal ? { signal: opts.signal } : {}),
    };
    const filter = (options as { filter?: unknown } | undefined)?.filter;
    if (typeof filter === 'string' && objectFilterUsesEmptyComponent(filter)) {
      const args = [...OBJECT_FILTER_EMPTY_PROBE];
      const probe = await this.probe(context, args, probeOptions);
      if (probe.aborted) {
        throw this.mapError(probe, context, this.buildArgv(context, args));
      }
      if (objectFilterCombineEmptyComponents(probe) === false) {
        // Older Git rejects every empty component independently of ABI dimensions.
        checkOptions(name, options, { ...valid[0]!, depthAtoiBits, combineEmptyComponents: false });
      }
    }
    if (valid.length === 8) {
      return;
    }
    let unsignedChar = true;
    const charDependent = [32, 64].some((candidateLongBits) =>
      [false, true].some(
        (negative) =>
          valid.some(
            (e) =>
              e.longBits === candidateLongBits &&
              e.negativeMagnitudes === negative &&
              e.unsignedChar === false,
          ) !==
          valid.some(
            (e) =>
              e.longBits === candidateLongBits &&
              e.negativeMagnitudes === negative &&
              e.unsignedChar === true,
          ),
      ),
    );
    if (charDependent) {
      const args = [...OBJECT_FILTER_CHAR_PROBE];
      const probe = await this.probe(context, args, probeOptions);
      if (probe.aborted) {
        throw this.mapError(probe, context, this.buildArgv(context, args));
      }
      const observed = objectFilterUnsignedChar(probe);
      if (observed === undefined) {
        return;
      }
      unsignedChar = observed;
    }
    const charValid = valid.filter((e) => e.unsignedChar === unsignedChar);
    let negativeMagnitudes = false;
    const signDependent = [32, 64].some(
      (candidateLongBits) =>
        charValid.some(
          (e) => e.longBits === candidateLongBits && e.negativeMagnitudes === false,
        ) !==
        charValid.some((e) => e.longBits === candidateLongBits && e.negativeMagnitudes === true),
    );
    if (signDependent) {
      const args = ['pack-objects', '--max-pack-size=-0', '-h'];
      const sign = await this.runRepositoryProbe(context, args, probeOptions);
      if (sign.aborted) {
        throw this.mapError(sign, context, this.buildArgv(context, args));
      }
      if (sign.exitCode === 129 && /expects .*non-negative|not in range/.test(sign.stderr)) {
        negativeMagnitudes = false;
      } else if (
        sign.exitCode === 129 &&
        (sign.stdout + sign.stderr).includes('usage:') &&
        !/error:|fatal:/.test(sign.stderr)
      ) {
        negativeMagnitudes = true;
      } else {
        return;
      }
    }
    const selected = charValid.filter((e) => e.negativeMagnitudes === negativeMagnitudes);
    if (selected.length === 0) {
      checkOptions(name, options, {
        longBits: 64,
        negativeMagnitudes,
        unsignedChar,
        depthAtoiBits,
      });
      throw firstError;
    }
    let longBits = selected[0]!.longBits;
    if (selected.length !== 2) {
      const args = ['version', '--build-options'];
      const widths = await this.probe(context, args, probeOptions);
      if (widths.aborted) {
        throw this.mapError(widths, context, this.buildArgv(context, args));
      }
      const bytes = /^sizeof-long: ([48])\r?$/m.exec(widths.stdout)?.[1];
      if (widths.exitCode !== 0 || !bytes) {
        if (name === 'cherryPick' || name === 'revert') {
          return;
        }
        throw new GitArgumentError(
          'Cannot determine integer widths of the selected Git executable',
        );
      }
      longBits = bytes === '4' ? 32 : 64;
    }
    checkOptions(name, options, { longBits, negativeMagnitudes, unsignedChar, depthAtoiBits });
  }

  /** Text execution remains independent of extra command output-mode options. */
  public async run(
    context: ExecutionContext,
    args: string[],
    opts?: RunOptions,
  ): Promise<RawResult> {
    return (await this.execute(context, args, opts, false)) as RawResult;
  }

  /**
   * Run an internal capability probe.
   *
   * Probes classify Git's own diagnostics, so tracing is stripped from their environment
   * (including GIT_TRACE* variables configured by the caller) and they never reach the
   * user's audit or trace callbacks.
   */
  private async probe(
    context: ExecutionContext,
    args: string[],
    opts?: RunOptions,
  ): Promise<RawResult> {
    return (await this.execute(context, args, opts, false, undefined, true)) as RawResult;
  }

  public async runBytes(
    context: ExecutionContext,
    args: string[],
    opts?: RunOptions,
  ): Promise<RawResult<Uint8Array>> {
    return (await this.execute(context, args, opts, true)) as RawResult<Uint8Array>;
  }

  /** Run a standalone upstream program through the shared text execution path. */
  public async runCompanion(
    context: ExecutionContext,
    executable: CompanionExecutable,
    args: string[],
    opts?: RunOptions,
  ): Promise<RawResult> {
    return (await this.execute(context, args, opts, false, executable)) as RawResult;
  }

  /** Capture standalone program output without text decoding. */
  public async runCompanionBytes(
    context: ExecutionContext,
    executable: CompanionExecutable,
    args: string[],
    opts?: RunOptions,
  ): Promise<RawResult<Uint8Array>> {
    return (await this.execute(context, args, opts, true, executable)) as RawResult<Uint8Array>;
  }

  /** Validate per-call options, then spawn one Git or companion process and collect its result. */
  private async execute(
    context: ExecutionContext,
    args: string[],
    opts: RunOptions | undefined,
    binary: boolean,
    executable?: CompanionExecutable,
    internal = false,
  ): Promise<RawResult<string | Uint8Array>> {
    validateIO({ stdin: opts?.stdin, env: opts?.env });
    const argv = executable
      ? [this.companionBinaries[executable], ...args]
      : this.buildArgv(context, args);
    const { signal, onProgress, onLfsProgress, env: envOverride } = opts ?? {};

    if (signal?.aborted) {
      return {
        stdout: binary ? new Uint8Array(0) : '',
        stderr: '',
        exitCode: -1,
        aborted: true,
      } as RawResult<string | Uint8Array>;
    }

    const env = this.buildEnv(executable, internal);

    // Apply per-call environment overrides (e.g. GIT_LFS_SKIP_SMUDGE) on top of
    // the resolved environment.
    if (envOverride) {
      applyEnvOverride(env, envOverride);
    }

    // Internal probes match diagnostics exactly; trace output would corrupt them.
    if (internal) {
      stripTraceEnv(env);
    }
    const audit = internal ? undefined : this.audit;

    if (executable && this.credential?.helper) {
      // Companion programs spawn Git themselves; pass the same config override through its environment protocol.
      const quote = (value: string): string => `'${value.replace(/['!]/g, "'\\$&'")}'`;
      const parameter = quote(`credential.helper=${this.credential.helper}`);
      env.GIT_CONFIG_PARAMETERS = env.GIT_CONFIG_PARAMETERS
        ? `${env.GIT_CONFIG_PARAMETERS} ${parameter}`
        : parameter;
    }

    // Enable LFS progress output to stderr when LFS progress callback is provided
    if (onLfsProgress) {
      env.GIT_LFS_FORCE_PROGRESS = '1';
    }

    // Capture start timestamp for duration calculation
    const startTimestamp = Date.now();

    // Emit audit start event
    if (audit?.onAudit) {
      audit.onAudit({
        type: 'start',
        timestamp: startTimestamp,
        argv,
        context,
      });
    }

    // Buffer for handling carriage return lines (LFS uses \r for in-place updates)
    let stderrBuffer = '';

    // Determine if we need stderr streaming
    const needsStderrStreaming = onProgress || onLfsProgress || audit?.onTrace;

    let result: Omit<Awaited<ReturnType<ExecAdapter['spawn']>>, 'stdout'> & {
      stdout: string | Uint8Array;
    };
    try {
      const spawnProcess:
        | ((
            options: SpawnOptions,
            handlers?: StreamHandler,
          ) => Promise<SpawnResult<string | Uint8Array>>)
        | undefined = binary ? this.exec.spawnBytes : this.exec.spawn;
      if (!spawnProcess) {
        throw new GitError(
          'CapabilityMissing',
          'The selected execution adapter does not support binary stdout',
        );
      }
      result = await spawnProcess.call(
        this.exec,
        {
          argv,
          stdin: opts?.stdin,
          env,
          // The env above is already fully resolved (including any inherited variables),
          // so the adapter must not merge the parent environment on top of it.
          inheritEnv: false,
          cwd:
            context.type === 'worktree'
              ? context.workdir
              : executable && context.type === 'bare'
                ? context.gitDir
                : undefined,
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
                  this.processStderrLine(line, onProgress, onLfsProgress, audit?.onTrace);
                }
              },
            }
          : undefined,
      );

      // Process any remaining content in buffer
      if (stderrBuffer.trim() && needsStderrStreaming) {
        this.processStderrLine(stderrBuffer, onProgress, onLfsProgress, audit?.onTrace);
      }
    } catch (error) {
      // Emit audit end event for spawn failures
      if (audit?.onAudit) {
        const endTimestamp = Date.now();
        audit.onAudit({
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
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError(
        signal?.aborted ? 'Aborted' : 'SpawnFailed',
        error instanceof Error ? error.message : String(error),
        {
          argv,
          ...(context.type === 'worktree'
            ? { workdir: context.workdir }
            : context.type === 'bare'
              ? { gitDir: context.gitDir }
              : {}),
        },
      );
    }

    // Emit audit end event
    if (audit?.onAudit) {
      const endTimestamp = Date.now();
      audit.onAudit({
        type: 'end',
        timestamp: endTimestamp,
        argv,
        context,
        stdout: typeof result.stdout === 'string' ? result.stdout : '',
        ...(typeof result.stdout === 'string'
          ? {}
          : { stdoutBytes: new Uint8Array(result.stdout) }),
        stderr: result.stderr,
        exitCode: result.exitCode,
        ...(result.signal ? { signal: result.signal } : {}),
        aborted: result.aborted,
        duration: endTimestamp - startTimestamp,
      });
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      ...(result.signal ? { signal: result.signal } : {}),
      aborted: result.aborted,
    } as RawResult<string | Uint8Array>;
  }

  /**
   * Process a single line from stderr for progress and trace callbacks
   */
  private processStderrLine(
    line: string,
    onProgress: ((progress: GitProgress) => void) | undefined,
    onLfsProgress: ((progress: LfsProgress) => void) | undefined,
    onTrace: AuditConfig['onTrace'],
  ): void {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    // Check for trace output (GIT_TRACE lines start with specific patterns)
    if (onTrace && GIT_TRACE_PATTERN.test(trimmed)) {
      onTrace({
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
        ...(result.signal ? { signal: result.signal } : {}),
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
          ...(result.signal ? { signal: result.signal } : {}),
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
    if (result.signal) {
      return 'NonZeroExit';
    }

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
  public checkResult(context: ExecutionContext, args: string[], result: RawResult): void {
    const error = this.mapError(result, context, this.buildArgv(context, args));
    if (error) {
      throw error;
    }
  }

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

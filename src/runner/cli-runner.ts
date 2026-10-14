import { validateOptions as checkOptions } from '../core/option-rules.js';
import type { GitIntegerProfile } from '../constraints/git-integer.js';
/**
 * CLI Runner - Core execution engine for Git commands
 *
 * This module provides:
 * - CliRunner: Executes Git commands with progress tracking and abort support
 * - Progress collection from stderr (Git and LFS)
 * - Error mapping from Git exit codes
 */

import process from 'node:process';
import {
  commandArguments,
  commandUsesNativeABI,
  commandUsesIntegerProfile,
  commandUsesNegativeMagnitude,
  commandUsesObjectFilterBinary,
} from '../commands/build.js';
import { COMMAND_SPECS } from '../commands/generated.js';
import {
  type GuiGrammar,
  guiGrammarFromSource,
  guiLaunchFromSource,
} from '../commands/gui-syntax.js';
import type { CommandSpec, CompanionExecutable } from '../commands/spec.js';
import type { GitCommandName } from '../commands/types.js';
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
  ExecOpts,
  ExecutionContext,
  GitErrorKind,
  GitProgress,
  LfsProgress,
  RawResult,
  GitOutputMode,
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

type CommandRunOptions = RunOptions & { stdout?: GitOutputMode };

function validateIO(opts: CommandRunOptions | undefined): void {
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
  private buildEnv(executable?: CompanionExecutable): Record<string, string> {
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
  /** Resolve environment-dependent filter constraints before convenience execution. */
  public async validateFilterOptions(
    context: ExecutionContext,
    name: 'clone' | 'submoduleUpdate',
    options: object | undefined,
    opts?: RunOptions,
  ): Promise<void> {
    validateIO(opts);
    const valid: { longBits: 32 | 64; negativeMagnitudes: boolean }[] = [];
    let firstError: GitArgumentError | undefined;
    for (const longBits of [32, 64] as const) {
      for (const negativeMagnitudes of [false, true]) {
        try {
          checkOptions(name, options, { longBits, negativeMagnitudes });
          valid.push({ longBits, negativeMagnitudes });
        } catch (error) {
          if (!(error instanceof GitArgumentError)) {
            throw error;
          }
          firstError ??= error;
        }
      }
    }
    if (valid.length === 0) {
      throw firstError;
    }
    if (valid.length === 4) {
      return;
    }
    const probeOptions = {
      ...(opts?.env ? { env: opts.env } : {}),
      ...(opts?.signal ? { signal: opts.signal } : {}),
    };
    let negativeMagnitudes = false;
    const signDependent = [32, 64].some(
      (candidateLongBits) =>
        valid.some((e) => e.longBits === candidateLongBits && e.negativeMagnitudes === false) !==
        valid.some((e) => e.longBits === candidateLongBits && e.negativeMagnitudes === true),
    );
    if (signDependent) {
      const args = ['pack-objects', '--max-pack-size=-0', '-h'];
      const sign = await this.run(context, args, probeOptions);
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
      } // Unrecognized frontends retain native validation.
    }
    const selected = valid.filter((e) => e.negativeMagnitudes === negativeMagnitudes);
    if (selected.length === 0) {
      checkOptions(name, options, { longBits: 64, negativeMagnitudes });
      return;
    }
    let longBits: 32 | 64 = selected[0]!.longBits;
    if (selected.length !== 2) {
      const args = ['version', '--build-options'];
      const widths = await this.run(context, args, probeOptions);
      if (widths.aborted) {
        throw this.mapError(widths, context, this.buildArgv(context, args));
      }
      const bytes = /^sizeof-long: ([48])\r?$/m.exec(widths.stdout)?.[1];
      if (widths.exitCode !== 0 || !bytes) {
        throw new GitArgumentError(
          'Cannot determine integer widths of the selected Git executable',
        );
      }
      longBits = bytes === '4' ? 32 : 64;
    }
    checkOptions(name, options, { longBits, negativeMagnitudes });
  }

  public runCommand(
    context: ExecutionContext,
    command: GitCommandName,
    args: readonly unknown[],
    inRepository: boolean | undefined,
    opts: RunOptions & { stdout: 'bytes' },
  ): Promise<RawResult<Uint8Array>>;
  public runCommand(
    context: ExecutionContext,
    command: GitCommandName,
    args: readonly unknown[],
    inRepository: boolean | undefined,
    opts?: RunOptions & { stdout?: 'text' },
  ): Promise<RawResult>;
  public runCommand(
    context: ExecutionContext,
    command: GitCommandName,
    args: readonly unknown[],
    inRepository: boolean | undefined,
    opts: CommandRunOptions | undefined,
  ): Promise<RawResult<string | Uint8Array>>;
  public async runCommand(
    context: ExecutionContext,
    command: GitCommandName,
    args: readonly unknown[],
    inRepository: boolean | undefined,
    opts?: CommandRunOptions,
  ): Promise<RawResult<string | Uint8Array>> {
    validateIO(opts);
    const binary = opts?.stdout === 'bytes';
    const spec: CommandSpec = COMMAND_SPECS[command];
    const execute = (argv: string[]): Promise<RawResult<string | Uint8Array>> => {
      if (spec.executable) {
        return binary
          ? this.runCompanionBytes(context, spec.executable, argv.slice(1), opts)
          : this.runCompanion(context, spec.executable, argv.slice(1), opts);
      }
      return binary ? this.runBytes(context, argv, opts) : this.run(context, argv, opts);
    };
    if (spec.guiScript) {
      const argv = commandArguments(command, args, inRepository);
      if ((binary && !this.exec.spawnBytes) || !this.fs.readFile || argv[1] === '--help') {
        return await execute(argv);
      }
      const probeOptions = {
        ...(opts?.env ? { env: opts.env } : {}),
        ...(opts?.signal ? { signal: opts.signal } : {}),
      };
      const path = await this.run(context, ['--exec-path'], probeOptions);
      if (path.aborted) {
        return { ...path, stdout: binary ? new Uint8Array(0) : path.stdout };
      }
      if (path.exitCode !== 0) {
        return await execute(argv);
      }
      let source: string;
      try {
        source = await this.fs.readFile(`${path.stdout.replace(/\r?\n$/, '')}/git-${argv[0]}`);
      } catch {
        return await execute(argv);
      }
      const launch = guiLaunchFromSource(source);
      if (launch === 'direct-tcl') {
        // Windows invokes Tcl directly: querying --version can open a modal GUI.
        const tclPath = `${path.stdout.replace(/\r?\n$/, '')}/git-gui.tcl`;
        let grammar: GuiGrammar | undefined;
        try {
          grammar = guiGrammarFromSource(await this.fs.readFile(tclPath));
        } catch {
          /* Unknown source keeps native validation. */
        }
        return await execute(
          commandArguments(command, args, inRepository, undefined, grammar, launch),
        );
      }
      const grammar = guiGrammarFromSource(source);
      if (!grammar) {
        return await execute(argv);
      }
      const version = await this.run(context, [argv[0]!, '--version'], probeOptions);
      if (version.aborted) {
        return { ...version, stdout: binary ? new Uint8Array(0) : version.stdout };
      }
      const reported = /^\s*echo '([^']+)'/m.exec(source)?.[1];
      if (version.exitCode !== 0 || version.stdout.replace(/\r?\n$/, '') !== reported) {
        return await execute(argv);
      }
      return await execute(
        commandArguments(command, args, inRepository, undefined, grammar, launch),
      );
    }
    type NativeAbi = {
      longBits: 32 | 64;
      sizeTBits: 32 | 64;
      binaryIntegers?: boolean;
      integerProfile?: GitIntegerProfile;
      negativeMagnitudes?: boolean;
    };
    let abi: NativeAbi | undefined;
    if (commandUsesNativeABI(command, args)) {
      const profiles: GitIntegerProfile[] = commandUsesIntegerProfile(command, args)
        ? ['bounded', 'decimal-cast']
        : ['bounded'];
      const signs = commandUsesNegativeMagnitude(command, args) ? [false, true] : [false];
      const valid: { profile: GitIntegerProfile; abi: NativeAbi; argv: string[] }[] = [];
      let firstError: GitArgumentError | undefined;
      for (const integerProfile of profiles) {
        for (const negativeMagnitudes of signs) {
          for (const longBits of [32, 64] as const) {
            for (const sizeTBits of [32, 64] as const) {
              const candidateAbi = { longBits, sizeTBits, integerProfile, negativeMagnitudes };
              try {
                valid.push({
                  profile: integerProfile,
                  abi: candidateAbi,
                  argv: commandArguments(command, args, inRepository, candidateAbi),
                });
              } catch (error) {
                if (!(error instanceof GitArgumentError)) {
                  throw error;
                }
                firstError ??= error;
              }
            }
          }
        }
      }
      if (valid.length === 0) {
        throw firstError;
      }
      const needsBinaryProfile = commandUsesObjectFilterBinary(command, args);
      if (
        (valid.length === profiles.length * signs.length * 4 && !needsBinaryProfile) ||
        (binary && !this.exec.spawnBytes)
      ) {
        return await execute(valid[0]!.argv);
      }
      const probeOptions = {
        ...(opts?.env ? { env: opts.env } : {}),
        ...(opts?.signal ? { signal: opts.signal } : {}),
      };
      let selected: GitIntegerProfile = 'bounded';
      const familyDependent =
        profiles.length > 1 &&
        signs.some((candidateSign) =>
          [32, 64].some((longBits) =>
            [32, 64].some(
              (sizeTBits) =>
                valid.some(
                  (e) =>
                    e.profile === 'bounded' &&
                    e.abi.negativeMagnitudes === candidateSign &&
                    e.abi.longBits === longBits &&
                    e.abi.sizeTBits === sizeTBits,
                ) !==
                valid.some(
                  (e) =>
                    e.profile === 'decimal-cast' &&
                    e.abi.negativeMagnitudes === candidateSign &&
                    e.abi.longBits === longBits &&
                    e.abi.sizeTBits === sizeTBits,
                ),
            ),
          ),
        );
      if (familyDependent) {
        // Both branches read help only: no input, repository mutation or network.
        const family = await this.run(
          context,
          ['column', '--width=2147483648', '-h'],
          probeOptions,
        );
        if (family.aborted) {
          return { ...family, stdout: binary ? new Uint8Array(0) : family.stdout };
        }
        const usage = (family.stdout + family.stderr).includes('usage:');
        if (family.exitCode === 129 && /not in range/.test(family.stderr)) {
          selected = 'bounded';
        } else if (
          (family.exitCode === 0 || family.exitCode === 129) &&
          usage &&
          !/error:|fatal:/.test(family.stderr)
        ) {
          selected = 'decimal-cast';
        } else {
          return await execute(valid[0]!.argv);
        }
      }
      let negativeMagnitudes = false;
      const signDependent =
        signs.length > 1 &&
        [32, 64].some((longBits) =>
          [32, 64].some(
            (sizeTBits) =>
              valid.some(
                (e) =>
                  e.profile === selected &&
                  e.abi.negativeMagnitudes === false &&
                  e.abi.longBits === longBits &&
                  e.abi.sizeTBits === sizeTBits,
              ) !==
              valid.some(
                (e) =>
                  e.profile === selected &&
                  e.abi.negativeMagnitudes === true &&
                  e.abi.longBits === longBits &&
                  e.abi.sizeTBits === sizeTBits,
              ),
          ),
        );
      if (signDependent) {
        const sign = await this.run(
          context,
          ['pack-objects', '--max-pack-size=-0', '-h'],
          probeOptions,
        );
        if (sign.aborted) {
          return { ...sign, stdout: binary ? new Uint8Array(0) : sign.stdout };
        }
        const diagnostic = sign.stdout + sign.stderr;
        if (sign.exitCode === 129 && /expects .*non-negative|not in range/.test(sign.stderr)) {
          negativeMagnitudes = false;
        } else if (
          sign.exitCode === 129 &&
          diagnostic.includes('usage:') &&
          !/error:|fatal:/.test(sign.stderr)
        ) {
          negativeMagnitudes = true;
        } else {
          return await execute(valid[0]!.argv);
        }
      }
      const selectedValid = valid.filter(
        (entry) =>
          entry.profile === selected && entry.abi.negativeMagnitudes === negativeMagnitudes,
      );
      if (selectedValid.length === 0) {
        commandArguments(command, args, inRepository, {
          longBits: 64,
          sizeTBits: 64,
          integerProfile: selected,
          negativeMagnitudes,
        });
        throw firstError;
      }
      abi = selectedValid[0]!.abi;
      if (selectedValid.length !== 4) {
        const probe = await this.run(context, ['version', '--build-options'], probeOptions);
        if (probe.aborted) {
          return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
        }
        const longBytes = /^sizeof-long: ([48])\r?$/m.exec(probe.stdout)?.[1];
        const sizeBytes = /^sizeof-size_t: ([48])\r?$/m.exec(probe.stdout)?.[1];
        if (probe.exitCode !== 0 || !(longBytes && sizeBytes)) {
          throw new GitArgumentError(
            'Cannot determine integer widths of the selected Git executable',
          );
        }
        abi = {
          longBits: longBytes === '4' ? 32 : 64,
          sizeTBits: sizeBytes === '4' ? 32 : 64,
          integerProfile: selected,
          negativeMagnitudes,
        };
      }
      if (needsBinaryProfile) {
        // Clone's callback runs before -h. No URL is supplied or contacted.
        const profile = await this.run(context, ['clone', '--filter=blob:limit=0b1', '-h'], {
          ...(opts?.env ? { env: opts.env } : {}),
          ...(opts?.signal ? { signal: opts.signal } : {}),
        });
        if (profile.aborted) {
          return { ...profile, stdout: binary ? new Uint8Array(0) : profile.stdout };
        }
        const diagnostic = profile.stdout + profile.stderr;
        const supported = profile.exitCode === 129 && diagnostic.includes('usage:');
        const unsupported = profile.exitCode === 128 && diagnostic.includes('invalid filter-spec');
        if (!supported && !unsupported) {
          // Unrecognized/localized frontends keep their own native validation.
          return await execute(commandArguments(command, args, inRepository, abi));
        }
        abi = { ...(abi ?? { longBits: 32, sizeTBits: 32 }), binaryIntegers: supported };
      }
    }
    return await execute(commandArguments(command, args, inRepository, abi));
  }

  /** Text execution remains independent of extra command output-mode options. */
  public async run(
    context: ExecutionContext,
    args: string[],
    opts?: RunOptions,
  ): Promise<RawResult> {
    return (await this.execute(context, args, opts, false)) as RawResult;
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

  private async execute(
    context: ExecutionContext,
    args: string[],
    opts: RunOptions | undefined,
    binary: boolean,
    executable?: CompanionExecutable,
  ): Promise<RawResult<string | Uint8Array>> {
    validateIO({ stdin: opts?.stdin });
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

    const env = this.buildEnv(executable);

    // Apply per-call environment overrides (e.g. GIT_LFS_SKIP_SMUDGE) on top of
    // the resolved environment.
    if (envOverride) {
      Object.assign(env, envOverride);
    }

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
    if (this.audit?.onAudit) {
      const endTimestamp = Date.now();
      this.audit.onAudit({
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
        aborted: result.aborted,
        duration: endTimestamp - startTimestamp,
      });
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
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

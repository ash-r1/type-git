/**
 * Core type definitions for the type-safe Git wrapper library
 *
 * This module defines:
 * - Progress events (Git and LFS)
 * - Execution options and results
 * - Error types and handling
 * - Runtime capabilities
 * - Output contracts for typed parsing
 * - Branded types for type safety
 */

// =============================================================================
// Branded Types for Type Safety
// =============================================================================

/**
 * Brand symbol for NonEmptyString
 * @internal
 */
declare const NonEmptyBrand: unique symbol;

/**
 * A string that is guaranteed to be non-empty at the type level.
 *
 * Use the `nonEmpty()` helper function to create NonEmptyString values,
 * or cast string literals directly: `'main' as NonEmptyString`
 *
 * @example
 * ```typescript
 * // Using helper function (recommended for variables)
 * const branch = nonEmpty(userInput);
 * await repo.branch.create(branch);
 *
 * // Casting literals (safe for known values)
 * await repo.checkout('main' as NonEmptyString);
 * ```
 */
export type NonEmptyString = string & { readonly [NonEmptyBrand]: never };

/**
 * Validates and converts a string to NonEmptyString.
 *
 * @param s - The string to validate
 * @returns The string as NonEmptyString
 * @throws GitArgumentError if the string is empty
 *
 * @example
 * ```typescript
 * const branchName = nonEmpty('feature-branch'); // OK
 * const invalid = nonEmpty(''); // throws GitArgumentError
 * ```
 */
export function nonEmpty(s: string): NonEmptyString {
  if (s === '') {
    throw new GitArgumentError('Empty string is not allowed');
  }
  return s as NonEmptyString;
}

/**
 * Type guard to check if a string is non-empty.
 *
 * @param s - The string to check
 * @returns true if the string is non-empty
 *
 * @example
 * ```typescript
 * const input = getUserInput();
 * if (isNonEmpty(input)) {
 *   await repo.branch.create(input); // input is NonEmptyString here
 * }
 * ```
 */
export function isNonEmpty(s: string): s is NonEmptyString {
  return s !== '';
}

// =============================================================================
// Progress Events (#12: Progress イベントスキーマ確定)
// =============================================================================

/**
 * Progress event for Git operations
 *
 * Parsed from git's stderr progress output like:
 * - "Counting objects: 100% (10/10), done."
 * - "Compressing objects: 100% (8/8), done."
 */
export type GitProgress = {
  /** The phase of the git operation */
  phase: string;
  /** Current progress value */
  current: number;
  /** Total value (null if unknown) */
  total: number | null;
  /** Percentage (null if unknown) */
  percent: number | null;
  /** Raw message from stderr */
  message?: string;
};

/**
 * Progress event for LFS operations (§7.3)
 *
 * Parsed from LFS stderr output when GIT_LFS_FORCE_PROGRESS=1:
 * "Downloading LFS objects:  50% (1/2), 1.2 MB | 500 KB/s"
 */
export type LfsProgress = {
  /** Direction of the transfer */
  direction: 'download' | 'upload' | 'checkout';
  /** Total bytes transferred so far */
  bytesSoFar: number;
  /** Total bytes to transfer */
  bytesTotal: number;
  /** Transfer rate in bytes per second */
  bitrate?: number;
  /** Number of files completed */
  filesCompleted: number;
  /** Total number of files */
  filesTotal: number;
  /** Progress percentage (0-100) */
  percent: number;
};

// =============================================================================
// Execution Options and Results
// =============================================================================

/**
 * Execution options common to all Git operations
 */
export type ExecOpts = {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Git progress callback (for operations like fetch, push, clone) */
  onProgress?: (progress: GitProgress) => void;
  /** LFS progress callback (for LFS transfer operations) */
  onLfsProgress?: (progress: LfsProgress) => void;
};

/**
 * Result from raw Git command execution
 */
export type RawResult = {
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code (0 = success) */
  exitCode: number;
  /** Whether the command was aborted via AbortSignal */
  aborted: boolean;
};

// =============================================================================
// Error Types (#13: Abort時の扱い確定)
// =============================================================================

/**
 * Git error kinds
 */
export type GitErrorKind =
  /** Failed to spawn the git process */
  | 'SpawnFailed'
  /** Git exited with non-zero exit code */
  | 'NonZeroExit'
  /** Failed to parse git output */
  | 'ParseError'
  /** Command was aborted via AbortSignal */
  | 'Aborted'
  /** Required capability is missing (e.g., Deno permissions) */
  | 'CapabilityMissing'
  /** Expected a worktree repository but found bare repository */
  | 'NotWorktreeRepo'
  /** Expected a bare repository but found worktree repository */
  | 'NotBareRepo'
  /** Git version is below minimum supported version */
  | 'UnsupportedGitVersion';

/**
 * Git error category for error handling (§13.2)
 *
 * Categorizes errors by their nature to enable appropriate handling strategies.
 */
export type GitErrorCategory =
  /** Authentication errors (401, credential related) */
  | 'auth'
  /** Network errors (timeout, DNS resolution failure, etc.) */
  | 'network'
  /** Merge/rebase conflicts */
  | 'conflict'
  /** LFS-specific errors (storage capacity, transfer failure, etc.) */
  | 'lfs'
  /** Permission errors (directory access, file lock) */
  | 'permission'
  /** Repository corruption */
  | 'corruption'
  /** Unclassifiable */
  | 'unknown';

/**
 * Git error with detailed context
 */
export class GitError extends Error {
  public constructor(
    public readonly kind: GitErrorKind,
    message: string,
    public readonly context: {
      argv?: string[];
      workdir?: string;
      gitDir?: string;
      exitCode?: number;
      stdout?: string;
      stderr?: string;
    } = {},
    public readonly category: GitErrorCategory = 'unknown',
  ) {
    super(message);
    this.name = 'GitError';
  }

  /**
   * Check if the error is retryable (§13.2)
   *
   * Network errors and some LFS errors are typically retryable.
   */
  public isRetryable(): boolean {
    return this.category === 'network' || (this.category === 'lfs' && this.kind === 'NonZeroExit');
  }

  /**
   * Check if authentication is needed (§13.2)
   */
  public needsAuthentication(): boolean {
    return this.category === 'auth';
  }
}

/**
 * Error thrown when an argument is invalid (e.g., empty string where non-empty is required)
 *
 * This error is thrown at the API boundary before the git command is executed,
 * providing early feedback for invalid arguments.
 *
 * @example
 * ```typescript
 * try {
 *   await repo.branch.create(nonEmpty('')); // throws GitArgumentError
 * } catch (e) {
 *   if (e instanceof GitArgumentError) {
 *     console.log('Invalid argument:', e.message);
 *   }
 * }
 * ```
 */
export class GitArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'GitArgumentError';
  }
}

// =============================================================================
// Runtime Capabilities (#14: Capabilities型定義)
// =============================================================================

/**
 * Runtime identifier
 */
export type Runtime = 'node' | 'deno' | 'bun';

/**
 * Runtime capabilities
 *
 * Used to determine what features are available in the current runtime.
 */
export type Capabilities = {
  /** Whether process spawning is available */
  canSpawnProcess: boolean;
  /** Whether environment variables can be read */
  canReadEnv: boolean;
  /** Whether temporary files can be written (for LFS progress) */
  canWriteTemp: boolean;
  /** Whether AbortSignal is supported */
  supportsAbortSignal: boolean;
  /** Whether kill signals can be sent to processes */
  supportsKillSignal: boolean;
  /** Runtime identifier */
  runtime: Runtime;
  /** Git version (if detected) */
  gitVersion?: string;
  /** Git LFS version (if detected) */
  lfsVersion?: string;
};

// =============================================================================
// LFS Configuration
// =============================================================================

/**
 * LFS mode configuration
 */
export type LfsMode =
  | 'enabled'
  | 'disabled'
  | {
      /** Skip smudge filter (don't download LFS files on checkout) */
      skipSmudge?: boolean;
      /** Skip download (keep pointer files) */
      skipDownload?: boolean;
    };

// =============================================================================
// Output Contract (#11: OutputContract方針確定)
// =============================================================================

/**
 * Output contract types for typed API
 *
 * Typed API only supports commands with predictable output formats.
 */
export type OutputContract =
  /** Raw output - no parsing */
  | { type: 'raw' }
  /** Porcelain format (v1 or v2) */
  | { type: 'porcelain'; version: 1 | 2 }
  /** JSON output */
  | { type: 'json' }
  /** Custom format with a specific delimiter */
  | { type: 'delimited'; delimiter: string; nullTerminated?: boolean }
  /** Custom pretty format for git log */
  | { type: 'pretty'; format: string };

/**
 * Command specification for typed API
 */
export type CommandSpec<TOptions, TResult> = {
  /** Command name (e.g., "status", "log") */
  name: string;
  /** Subcommands (e.g., ["lfs", "pull"]) */
  subcommands?: string[];
  /** Build argv from options */
  buildArgs: (options: TOptions) => string[];
  /** Output contract */
  outputContract: OutputContract;
  /** Parse stdout/stderr to result */
  parse: (stdout: string, stderr: string) => TResult;
};

// =============================================================================
// Execution Context (#10: 実行コンテキスト規約確定)
// =============================================================================

/**
 * Execution context for git commands
 *
 * Determines how git commands are executed:
 * - Worktree: `git -C <workdir> <command>`
 * - Bare: `git --git-dir=<gitDir> <command>`
 */
export type ExecutionContext =
  | { type: 'global' }
  | { type: 'worktree'; workdir: string }
  | { type: 'bare'; gitDir: string };

// =============================================================================
// Environment Isolation (§6.3: 宣言的環境隔離)
// =============================================================================

/**
 * Options for opening a repository with environment isolation (§6.3)
 *
 * Provides declarative environment configuration for Git operations.
 */
export type GitOpenOptions = {
  /** Custom HOME directory (~/.gitconfig source) */
  home?: string;
  /** Ignore system config (--config-env=GIT_CONFIG_GLOBAL=/dev/null equivalent) */
  ignoreSystemConfig?: boolean;
  /** Custom credential helper */
  credentialHelper?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Directories to prepend to PATH */
  pathPrefix?: string[];
  /** Credential configuration (§6.4) */
  credential?: CredentialConfig;
  /** LFS mode configuration */
  lfs?: LfsMode;
};

// =============================================================================
// Credential Configuration (§6.4)
// =============================================================================

/**
 * Credential request information
 */
export type CredentialRequest = {
  protocol: 'https' | 'ssh';
  host: string;
  path?: string;
};

/**
 * Credential response
 */
export type Credential = {
  username: string;
  password: string;
};

/**
 * Credential configuration for Git authentication (§6.4)
 *
 * Supports multiple authentication methods:
 * 1. Built-in helper (store, cache, manager-core)
 * 2. Custom helper binary
 * 3. Programmatic authentication (recommended)
 * 4. Static credentials (dev/test only)
 */
export type CredentialConfig = {
  /** Method 1: Built-in helper name */
  helper?: 'store' | 'cache' | 'manager-core' | string;

  /** Method 2: Custom helper binary path */
  helperPath?: string;

  /** Method 3: Programmatic authentication provider (recommended) */
  provider?: (request: CredentialRequest) => Promise<Credential>;

  /** Method 4: Static credentials (dev/test only) */
  username?: string;
  password?: string;
  token?: string;

  /** Fallback credential configuration */
  fallback?: CredentialConfig;

  /** Callback when authentication fails */
  onAuthFailure?: (error: Error, request: CredentialRequest) => void;
};

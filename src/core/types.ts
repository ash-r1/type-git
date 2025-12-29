/**
 * Core type definitions for the type-safe Git wrapper library
 *
 * This module defines:
 * - Progress events (Git and LFS)
 * - Execution options and results
 * - Error types and handling
 * - Runtime capabilities
 * - Output contracts for typed parsing
 */

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
  kind: 'git';
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
 * Progress event for LFS operations
 *
 * Parsed from GIT_LFS_PROGRESS file format:
 * <direction> <oid> <bytes_so_far>/<bytes_total> <bytes_transferred>
 */
export type LfsProgress = {
  kind: 'lfs';
  /** Direction of the transfer */
  direction: 'download' | 'upload';
  /** Object ID */
  oid: string;
  /** Bytes transferred in this chunk */
  bytesTransferred: number;
  /** Total bytes transferred so far */
  bytesSoFar: number;
  /** Total bytes to transfer */
  bytesTotal: number;
};

/**
 * Union type for all progress events
 */
export type Progress = GitProgress | LfsProgress;

// =============================================================================
// Execution Options and Results
// =============================================================================

/**
 * Execution options common to all Git operations
 */
export type ExecOpts = {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Progress callback */
  onProgress?: (progress: Progress) => void;
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
  | 'CapabilityMissing';

/**
 * Git error with detailed context
 */
export class GitError extends Error {
  constructor(
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
  ) {
    super(message);
    this.name = 'GitError';
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

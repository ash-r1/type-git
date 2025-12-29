/**
 * Core type definitions for the type-safe Git wrapper library
 */

/**
 * Progress event for Git operations
 */
export type GitProgress = {
  kind: 'git';
  phase: 'clone' | 'fetch' | 'push' | 'checkout' | 'counting' | 'compressing' | 'writing';
  message: string;
  percent?: number;
};

/**
 * Progress event for LFS operations
 */
export type LfsProgress = {
  kind: 'lfs';
  direction: 'download' | 'upload' | 'checkout';
  current: number;
  total: number;
  name?: string;
  bytes?: number;
};

/**
 * Union type for all progress events
 */
export type Progress = GitProgress | LfsProgress;

/**
 * Execution options common to all Git operations
 */
export type ExecOpts = {
  signal?: AbortSignal;
  onProgress?: (progress: Progress) => void;
};

/**
 * Result from raw Git command execution
 */
export type RawResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  aborted: boolean;
};

/**
 * Git error kinds
 */
export type GitErrorKind =
  | 'SpawnFailed'
  | 'NonZeroExit'
  | 'ParseError'
  | 'Aborted'
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

/**
 * Runtime capabilities
 */
export type Runtime = 'node' | 'deno' | 'bun';

export type Capabilities = {
  canSpawnProcess: boolean;
  canReadEnv: boolean;
  canWriteTemp: boolean;
  supportsAbortSignal: boolean;
  supportsKillSignal: boolean;
  runtime: Runtime;
  gitVersion?: string;
  lfsVersion?: string;
};

/**
 * LFS mode configuration
 */
export type LfsMode =
  | 'enabled'
  | 'disabled'
  | {
      skipSmudge?: boolean;
      skipDownload?: boolean;
    };

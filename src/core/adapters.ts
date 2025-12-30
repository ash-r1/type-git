/**
 * Runtime adapter interfaces for cross-platform support (Node/Deno/Bun)
 *
 * This module defines:
 * - ExecAdapter: Process execution abstraction (#15)
 * - FsAdapter: Filesystem operations abstraction (#16)
 * - Related types and options
 */

import type { Capabilities } from './types.js';

// =============================================================================
// ExecAdapter (#15: ExecAdapter インターフェース定義)
// =============================================================================

/**
 * Options for spawning a process
 */
export type SpawnOptions = {
  /** Command and arguments (first element is the command) */
  argv: Array<string>;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Kill signal to use when aborting (default: SIGTERM) */
  killSignal?: 'SIGTERM' | 'SIGKILL';
};

/**
 * Result from spawning a process
 */
export type SpawnResult = {
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code (-1 if unknown) */
  exitCode: number;
  /** Signal that terminated the process (if any) */
  signal?: string;
  /** Whether the process was aborted via AbortSignal */
  aborted: boolean;
};

/**
 * Stream handler for incremental output
 *
 * Used for progress tracking and real-time output processing.
 */
export type StreamHandler = {
  /** Called when stdout data is received */
  onStdout?: (chunk: string) => void;
  /** Called when stderr data is received */
  onStderr?: (chunk: string) => void;
};

/**
 * Handle to a spawned process
 *
 * Allows streaming output and waiting for completion.
 */
export interface SpawnHandle {
  /** Async iterator for stdout lines */
  readonly stdout: AsyncIterable<string>;
  /** Async iterator for stderr lines */
  readonly stderr: AsyncIterable<string>;
  /** Wait for process completion */
  wait(): Promise<SpawnResult>;
  /** Kill the process */
  kill(signal?: 'SIGTERM' | 'SIGKILL'): void;
}

/**
 * Adapter interface for process execution
 *
 * Abstracts process spawning across Node.js, Deno, and Bun.
 */
export interface ExecAdapter {
  /**
   * Get the capabilities of this runtime
   */
  getCapabilities(): Capabilities;

  /**
   * Spawn a process and wait for completion
   *
   * @param options - Spawn options
   * @param handlers - Optional stream handlers for real-time output
   * @returns Promise resolving to spawn result
   */
  spawn(options: SpawnOptions, handlers?: StreamHandler): Promise<SpawnResult>;

  /**
   * Spawn a process with streaming support
   *
   * @param options - Spawn options
   * @returns Handle to the spawned process
   */
  spawnStreaming?(options: SpawnOptions): SpawnHandle;
}

// =============================================================================
// FsAdapter (#16: FsAdapter インターフェース定義)
// =============================================================================

/**
 * Options for tailing a file
 */
export type TailOptions = {
  /** Path to the file to tail */
  filePath: string;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Callback for each new line */
  onLine: (line: string) => void;
  /** Start offset in bytes (default: 0) */
  startOffset?: number;
  /** Polling interval in milliseconds (default: 100) */
  pollInterval?: number;
};

/**
 * Handle to a tail operation
 */
export interface TailHandle {
  /** Async iterator for new lines */
  readonly lines: AsyncIterable<string>;
  /** Stop tailing */
  stop(): void;
}

/**
 * Adapter interface for filesystem operations
 *
 * Used primarily for LFS progress tracking via GIT_LFS_PROGRESS.
 */
export interface FsAdapter {
  /**
   * Create a temporary file and return its path
   *
   * @param prefix - Optional prefix for the temp file name
   * @returns Path to the created temporary file
   */
  createTempFile(prefix?: string): Promise<string>;

  /**
   * Start tailing a file (watching for new lines)
   *
   * @param options - Tail options
   * @returns Promise that resolves when tailing stops
   */
  tail(options: TailOptions): Promise<void>;

  /**
   * Start tailing a file with streaming support
   *
   * @param filePath - Path to the file to tail
   * @param options - Optional tail options
   * @returns Handle to the tail operation
   */
  tailStreaming?(
    filePath: string,
    options?: { signal?: AbortSignal; pollInterval?: number },
  ): TailHandle;

  /**
   * Delete a file
   *
   * @param filePath - Path to the file to delete
   */
  deleteFile(filePath: string): Promise<void>;

  /**
   * Check if a file exists
   *
   * @param filePath - Path to check
   * @returns Whether the file exists
   */
  exists(filePath: string): Promise<boolean>;

  /**
   * Read a file's contents
   *
   * @param filePath - Path to the file
   * @returns File contents as string
   */
  readFile?(filePath: string): Promise<string>;

  /**
   * Write contents to a file
   *
   * @param filePath - Path to the file
   * @param contents - Contents to write
   */
  writeFile?(filePath: string, contents: string): Promise<void>;
}

// =============================================================================
// Adapter Factory
// =============================================================================

/**
 * Combined adapters for a runtime
 */
export interface RuntimeAdapters {
  exec: ExecAdapter;
  fs: FsAdapter;
}

/**
 * Factory function type for creating runtime adapters
 */
export type AdapterFactory = () => RuntimeAdapters;

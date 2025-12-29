/**
 * Runtime adapter interfaces for cross-platform support (Node/Deno/Bun)
 */

import type { Capabilities } from './types.js';

/**
 * Options for spawning a process
 */
export type SpawnOptions = {
  argv: string[];
  env?: Record<string, string>;
  cwd?: string;
  signal?: AbortSignal;
};

/**
 * Result from spawning a process
 */
export type SpawnResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal?: string;
  aborted: boolean;
};

/**
 * Stream handler for incremental output
 */
export type StreamHandler = {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
};

/**
 * Adapter interface for process execution
 */
export interface ExecAdapter {
  /**
   * Get the capabilities of this runtime
   */
  getCapabilities(): Capabilities;

  /**
   * Spawn a process and wait for completion
   */
  spawn(options: SpawnOptions, handlers?: StreamHandler): Promise<SpawnResult>;
}

/**
 * Options for tailing a file
 */
export type TailOptions = {
  filePath: string;
  signal?: AbortSignal;
  onLine: (line: string) => void;
};

/**
 * Adapter interface for filesystem operations
 */
export interface FsAdapter {
  /**
   * Create a temporary file and return its path
   */
  createTempFile(prefix?: string): Promise<string>;

  /**
   * Start tailing a file (watching for new lines)
   */
  tail(options: TailOptions): Promise<void>;

  /**
   * Delete a file
   */
  deleteFile(filePath: string): Promise<void>;

  /**
   * Check if a file exists
   */
  exists(filePath: string): Promise<boolean>;
}

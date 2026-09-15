/**
 * GitBackend abstraction for libgit2-compatible mode
 *
 * This module defines:
 * - GitBackend interface for alternative Git implementations
 * - BackendCapabilities for feature detection
 * - Support for isomorphic-git, nodegit, and wasm-git backends
 */

import type { CloneOpts, InitOpts } from './git.js';
import type {
  BranchInfo,
  BranchOpts,
  Commit,
  CommitOpts,
  CommitResult,
  LogOpts,
  StatusOpts,
  StatusPorcelain,
} from './repo.js';
import type { ExecOpts, ExecutionContext, GitProgress, RawResult } from './types.js';

// =============================================================================
// Backend Types
// =============================================================================

/**
 * Backend type identifier
 */
export type BackendType = 'cli' | 'isomorphic-git' | 'nodegit' | 'wasm-git';

/**
 * Backend capabilities for feature detection
 */
export interface BackendCapabilities {
  /** Backend type identifier */
  type: BackendType;
  /** Whether LFS operations are supported */
  supportsLfs: boolean;
  /** Whether progress tracking is supported */
  supportsProgress: boolean;
  /** Whether AbortSignal is supported for cancellation */
  supportsAbort: boolean;
  /** Whether bare repositories are supported */
  supportsBareRepo: boolean;
  /** Whether this backend can run in browser */
  supportsBrowser: boolean;
}

// =============================================================================
// Backend Options
// =============================================================================

/**
 * Options for backend operations
 */
export type BackendExecOpts = ExecOpts & {
  /** Git progress callback */
  onProgress?: (progress: GitProgress) => void;
};

/**
 * Options for branch creation
 */
export type BackendBranchCreateOpts = {
  /** Starting point for the branch (commit hash, branch name, or tag) */
  startPoint?: string;
  /** Force creation even if branch exists */
  force?: boolean;
};

/**
 * Options for add operation
 */
export type BackendAddOpts = {
  /** Add all changes including untracked files */
  all?: boolean;
  /** Allow adding otherwise ignored files */
  force?: boolean;
  /** Update tracked files only */
  update?: boolean;
};

// =============================================================================
// GitBackend Interface
// =============================================================================

/**
 * GitBackend interface for alternative Git implementations
 *
 * This interface abstracts Git operations to support multiple backends:
 * - CLI backend (wraps git CLI)
 * - isomorphic-git (pure JavaScript)
 * - nodegit (native libgit2 bindings)
 * - wasm-git (WebAssembly libgit2)
 *
 * Note: LFS operations are NOT supported in non-CLI backends.
 */
export interface GitBackend {
  /**
   * Get backend capabilities
   */
  getCapabilities(): BackendCapabilities;

  // ===========================================================================
  // Repository Operations (Git interface level)
  // ===========================================================================

  /**
   * Check if a path is a valid git repository
   *
   * @param path - Path to check
   * @returns Object with isBare flag if valid, null if not a repository
   */
  checkRepository(path: string): Promise<{ isBare: boolean } | null>;

  /**
   * Initialize a new repository
   *
   * @param path - Path where to create the repository
   * @param opts - Initialization options
   */
  init(path: string, opts?: InitOpts & BackendExecOpts): Promise<void>;

  /**
   * Clone a repository
   *
   * @param url - Repository URL
   * @param path - Destination path
   * @param opts - Clone options
   */
  clone(url: string, path: string, opts?: CloneOpts & BackendExecOpts): Promise<void>;

  // ===========================================================================
  // Repository-Scoped Operations (Repo interface level)
  // ===========================================================================

  /**
   * Get repository status
   *
   * @param workdir - Working directory path
   * @param opts - Status options
   * @returns Parsed status with entries and branch info
   */
  status(workdir: string, opts?: StatusOpts & BackendExecOpts): Promise<StatusPorcelain>;

  /**
   * Get commit log
   *
   * @param workdir - Working directory path
   * @param opts - Log options
   * @returns Array of commits
   */
  log(workdir: string, opts?: LogOpts & BackendExecOpts): Promise<Commit[]>;

  /**
   * Create a commit
   *
   * @param workdir - Working directory path
   * @param message - Commit message
   * @param opts - Commit options
   * @returns Commit result with hash and statistics
   */
  commit(
    workdir: string,
    message: string,
    opts?: CommitOpts & BackendExecOpts,
  ): Promise<CommitResult>;

  /**
   * Add files to the index
   *
   * @param workdir - Working directory path
   * @param paths - Files to add (use ['.'] for all)
   * @param opts - Add options
   */
  add(workdir: string, paths: string[], opts?: BackendAddOpts & BackendExecOpts): Promise<void>;

  /**
   * List branches
   *
   * @param workdir - Working directory path
   * @param opts - Branch list options
   * @returns Array of branch information
   */
  branchList(workdir: string, opts?: BranchOpts & BackendExecOpts): Promise<BranchInfo[]>;

  /**
   * Create a new branch
   *
   * @param workdir - Working directory path
   * @param name - Branch name
   * @param opts - Branch creation options
   */
  branchCreate(
    workdir: string,
    name: string,
    opts?: BackendBranchCreateOpts & BackendExecOpts,
  ): Promise<void>;

  // ===========================================================================
  // Raw/Fallback Operations (CLI only)
  // ===========================================================================

  /**
   * Execute a raw git command
   *
   * This is only available for CLI backend.
   * Other backends should throw an error or return undefined.
   *
   * @param context - Execution context (global, worktree, or bare)
   * @param argv - Command arguments
   * @param opts - Execution options
   * @returns Raw result with stdout, stderr, and exit code
   */
  raw?(context: ExecutionContext, argv: string[], opts?: BackendExecOpts): Promise<RawResult>;
}

// =============================================================================
// Backend Factory Types
// =============================================================================

/**
 * Options for creating a CLI backend
 */
export type CliBackendOptions = {
  /** Path to git binary (default: 'git') */
  gitBinary?: string;
  /** Base environment variables */
  env?: Record<string, string>;
  /** Directories to prepend to PATH */
  pathPrefix?: string[];
  /** Custom HOME directory */
  home?: string;
};

/**
 * Options for creating an isomorphic-git backend
 */
export type IsomorphicGitBackendOptions = {
  /** File system implementation (required for Node.js, optional for browser) */
  fs: unknown;
  /** HTTP client for network operations (optional) */
  http?: unknown;
  /** Credentials callback */
  onAuth?: (url: string) => { username: string; password: string } | undefined;
  /** Authentication failure callback */
  onAuthFailure?: (
    url: string,
    auth: { username: string; password: string },
  ) => { username: string; password: string } | undefined;
};

/**
 * Options for creating a nodegit backend
 */
export type NodeGitBackendOptions = {
  /** Certificate check callback */
  certificateCheck?: () => number;
  /** Credentials callback */
  credentials?: (url: string, usernameFromUrl: string) => unknown;
};

/**
 * Options for creating a wasm-git backend
 */
export type WasmGitBackendOptions = {
  /** Path to wasm file (optional, uses default if not provided) */
  wasmPath?: string;
};

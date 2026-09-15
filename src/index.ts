/**
 * type-git - Type-safe Git wrapper library with LFS support
 */

// Adapters
export * from './adapters/node/index.js';
// Core backend types
export type {
  BackendCapabilities,
  BackendType,
  GitBackend,
} from './core/backend.js';
// Core types and interfaces
export * from './core/index.js';
// Backend-based implementation
export {
  BackendGitImpl,
  type CreateBackendGitOptions,
  createBackendGit,
} from './impl/backend-git-impl.js';
// Implementation
export {
  type CreateGitOptions,
  createGit,
  createGitSync,
  LEGACY_GIT_VERSION,
  MIN_GIT_VERSION,
} from './impl/index.js';

// Parsers (for advanced usage)
export {
  detectErrorCategory,
  GIT_LOG_FORMAT,
  type GitProgressInfo,
  type LfsProgressInfo,
  type LsRemoteRef,
  type LsTreeObjectType,
  type ParsedCommit,
  type ParsedLsTreeEntry,
  type ParsedWorktree,
  type PorcelainV2Entry,
  parseGitLog,
  parseGitProgress,
  parseJson,
  parseKeyValue,
  parseLfsProgress,
  parseLines,
  parseLsRemote,
  parseLsTree,
  parsePorcelainV2,
  parseRecords,
  parseWorktreeList,
} from './parsers/index.js';
// Runner
export { CliRunner, type CliRunnerOptions } from './runner/index.js';

/**
 * type-git - Type-safe Git wrapper library with LFS support
 */

// Adapters
export * from './adapters/node/index.js';
// Core types and interfaces
export * from './core/index.js';
// Implementation
export {
  type CreateGitOptions,
  createGit,
  createGitSync,
  LEGACY_GIT_VERSION,
  MIN_GIT_VERSION,
  RECOMMENDED_GIT_VERSION,
} from './impl/index.js';

// Parsers (for advanced usage)
export {
  detectErrorCategory,
  GIT_LOG_FORMAT,
  type GitProgressInfo,
  type LfsProgressInfo,
  type LsRemoteRef,
  type ParsedCommit,
  type ParsedWorktree,
  type PorcelainV2Entry,
  parseGitLog,
  parseGitProgress,
  parseJson,
  parseKeyValue,
  parseLfsProgress,
  parseLines,
  parseLsRemote,
  parsePorcelainV2,
  parseRecords,
  parseWorktreeList,
} from './parsers/index.js';
// Runner
export { CliRunner, type CliRunnerOptions } from './runner/index.js';

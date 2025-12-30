/**
 * type-git - Type-safe Git wrapper library with LFS support
 */

// Core types and interfaces
export * from './core/index.js';

// Implementation
export { createGit, type CreateGitOptions } from './impl/index.js';

// Runner
export { CliRunner, type CliRunnerOptions } from './runner/index.js';

// Parsers (for advanced usage)
export {
  parseLines,
  parseRecords,
  parseJson,
  parseKeyValue,
  parsePorcelainV2,
  parseGitProgress,
  parseLfsProgress,
  parseLsRemote,
  parseGitLog,
  parseWorktreeList,
  detectErrorCategory,
  GIT_LOG_FORMAT,
  type PorcelainV2Entry,
  type GitProgressInfo,
  type LfsProgressInfo,
  type LsRemoteRef,
  type ParsedCommit,
  type ParsedWorktree,
} from './parsers/index.js';

// Adapters
export * from './adapters/node/index.js';

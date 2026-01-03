/**
 * Implementation module exports
 */

export { BareRepoImpl } from './bare-repo-impl.js';
export {
  type CreateGitOptions,
  compareVersions,
  createGit,
  createGitSync,
  GitImpl,
  LEGACY_GIT_VERSION,
  MIN_GIT_VERSION,
  parseVersion,
  RECOMMENDED_GIT_VERSION,
} from './git-impl.js';
export { WorktreeRepoImpl } from './worktree-repo-impl.js';

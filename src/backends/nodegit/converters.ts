/**
 * Type converters for nodegit backend
 *
 * Converts nodegit output types to type-git types.
 */

import type { BranchInfo, Commit, StatusEntry } from '../../core/repo.js';

/**
 * nodegit status flags (from libgit2)
 */
export const STATUS_FLAGS = {
  INDEX_NEW: 1,
  INDEX_MODIFIED: 2,
  INDEX_DELETED: 4,
  INDEX_RENAMED: 8,
  INDEX_TYPECHANGE: 16,
  WT_NEW: 128,
  WT_MODIFIED: 256,
  WT_DELETED: 512,
  WT_TYPECHANGE: 1024,
  WT_RENAMED: 2048,
  WT_UNREADABLE: 4096,
  IGNORED: 16384,
  CONFLICTED: 32768,
} as const;

/**
 * nodegit StatusFile interface (simplified)
 */
export interface NodeGitStatusFile {
  path(): string;
  status(): number[];
  headToIndex(): { oldFile(): { path(): string } } | null;
  indexToWorkdir(): { oldFile(): { path(): string } } | null;
}

/**
 * nodegit Commit interface (simplified)
 */
export interface NodeGitCommit {
  sha(): string;
  summary(): string;
  body(): string;
  parents(): Array<{ tostrS(): string }>;
  author(): {
    name(): string;
    email(): string;
    when(): { time(): number };
  };
  committer(): {
    name(): string;
    email(): string;
    when(): { time(): number };
  };
}

/**
 * nodegit Reference interface (simplified)
 */
export interface NodeGitReference {
  isBranch(): boolean;
  shorthand(): string;
  target(): { tostrS(): string };
}

/**
 * Convert nodegit StatusFile array to type-git StatusEntry array
 */
export function convertStatus(statusFiles: NodeGitStatusFile[]): StatusEntry[] {
  const entries: StatusEntry[] = [];

  for (const file of statusFiles) {
    const statusFlags = file.status();
    const path = file.path();
    const indexStatus = getIndexStatus(statusFlags);
    const workdirStatus = getWorkdirStatus(statusFlags);

    // Get original path for renamed files
    let originalPath: string | undefined;
    if (statusFlags.includes(STATUS_FLAGS.INDEX_RENAMED)) {
      const headToIndex = file.headToIndex();
      if (headToIndex) {
        originalPath = headToIndex.oldFile().path();
      }
    } else if (statusFlags.includes(STATUS_FLAGS.WT_RENAMED)) {
      const indexToWorkdir = file.indexToWorkdir();
      if (indexToWorkdir) {
        originalPath = indexToWorkdir.oldFile().path();
      }
    }

    entries.push({
      path,
      index: indexStatus,
      workdir: workdirStatus,
      originalPath,
    });
  }

  return entries;
}

/**
 * Get index status character from nodegit status flags
 */
function getIndexStatus(statusFlags: number[]): string {
  if (statusFlags.includes(STATUS_FLAGS.INDEX_NEW)) {
    return 'A';
  }
  if (statusFlags.includes(STATUS_FLAGS.INDEX_MODIFIED)) {
    return 'M';
  }
  if (statusFlags.includes(STATUS_FLAGS.INDEX_DELETED)) {
    return 'D';
  }
  if (statusFlags.includes(STATUS_FLAGS.INDEX_RENAMED)) {
    return 'R';
  }
  if (statusFlags.includes(STATUS_FLAGS.INDEX_TYPECHANGE)) {
    return 'T';
  }
  return ' ';
}

/**
 * Get workdir status character from nodegit status flags
 */
function getWorkdirStatus(statusFlags: number[]): string {
  if (statusFlags.includes(STATUS_FLAGS.WT_NEW)) {
    return '?';
  }
  if (statusFlags.includes(STATUS_FLAGS.WT_MODIFIED)) {
    return 'M';
  }
  if (statusFlags.includes(STATUS_FLAGS.WT_DELETED)) {
    return 'D';
  }
  if (statusFlags.includes(STATUS_FLAGS.WT_RENAMED)) {
    return 'R';
  }
  if (statusFlags.includes(STATUS_FLAGS.WT_TYPECHANGE)) {
    return 'T';
  }
  if (statusFlags.includes(STATUS_FLAGS.IGNORED)) {
    return '!';
  }
  if (statusFlags.includes(STATUS_FLAGS.CONFLICTED)) {
    return 'U';
  }
  return ' ';
}

/**
 * Convert nodegit Commit to type-git Commit
 */
export function convertCommit(commit: NodeGitCommit): Commit {
  const author = commit.author();
  const committer = commit.committer();

  return {
    hash: commit.sha(),
    abbrevHash: commit.sha().substring(0, 7),
    parents: commit.parents().map((p) => p.tostrS()),
    author: {
      name: author.name(),
      email: author.email(),
      timestamp: author.when().time(),
    },
    committer: {
      name: committer.name(),
      email: committer.email(),
      timestamp: committer.when().time(),
    },
    subject: commit.summary(),
    body: commit.body() ?? '',
  };
}

/**
 * Convert nodegit commits to type-git Commit array
 */
export function convertCommits(commits: NodeGitCommit[]): Commit[] {
  return commits.map(convertCommit);
}

/**
 * nodegit Repository interface (for branch operations)
 */
export interface NodeGitRepository {
  head(): Promise<NodeGitReference>;
  getReferences(): Promise<NodeGitReference[]>;
  getReferenceCommit(ref: NodeGitReference): Promise<NodeGitCommit>;
  getBranch(ref: NodeGitReference): Promise<unknown>;
}

/**
 * Convert nodegit references to type-git BranchInfo array
 */
export async function convertBranches(
  repo: NodeGitRepository,
  references: NodeGitReference[],
): Promise<BranchInfo[]> {
  let currentBranch: string | undefined;

  try {
    const head = await repo.head();
    currentBranch = head.shorthand();
  } catch {
    // Ignore errors getting HEAD
  }

  const branches: BranchInfo[] = [];

  for (const ref of references) {
    if (!ref.isBranch()) {
      continue;
    }

    const name = ref.shorthand();

    try {
      const commit = await repo.getReferenceCommit(ref);

      branches.push({
        name,
        current: name === currentBranch,
        commit: commit.sha().substring(0, 7),
        upstream: undefined, // Would need additional lookup
        gone: false,
      });
    } catch {
      // Skip branches that can't be resolved
    }
  }

  return branches;
}

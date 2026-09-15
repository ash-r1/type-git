/**
 * Type converters for isomorphic-git backend
 *
 * Converts isomorphic-git output types to type-git types.
 */

import type { BranchInfo, Commit, StatusEntry } from '../../core/repo.js';

/**
 * isomorphic-git status matrix format:
 * [filepath, HEAD, WORKDIR, STAGE]
 *
 * HEAD values:
 *   0 = absent
 *   1 = present
 *
 * WORKDIR values:
 *   0 = absent
 *   1 = identical to STAGE
 *   2 = different from STAGE
 *
 * STAGE values:
 *   0 = absent
 *   1 = identical to HEAD
 *   2 = different from HEAD (added)
 *   3 = different from HEAD (deleted in workdir)
 */
export type StatusMatrixEntry = [string, 0 | 1, 0 | 1 | 2, 0 | 1 | 2 | 3];

/**
 * Convert isomorphic-git statusMatrix to type-git StatusEntry array
 */
export function convertStatusMatrix(matrix: StatusMatrixEntry[]): StatusEntry[] {
  const entries: StatusEntry[] = [];

  for (const [path, head, workdir, stage] of matrix) {
    const indexStatus = getIndexStatus(head, stage);
    const workdirStatus = getWorkdirStatus(stage, workdir);

    // Skip unchanged files (both statuses are ' ')
    if (indexStatus === ' ' && workdirStatus === ' ') {
      continue;
    }

    entries.push({
      path,
      index: indexStatus,
      workdir: workdirStatus,
    });
  }

  return entries;
}

/**
 * Get index (staging area) status character
 */
function getIndexStatus(head: 0 | 1, stage: 0 | 1 | 2 | 3): string {
  if (head === 0 && stage === 2) {
    return 'A'; // Added
  }
  if (head === 1 && stage === 0) {
    return 'D'; // Deleted
  }
  if (head === 1 && stage === 2) {
    return 'M'; // Modified
  }
  return ' ';
}

/**
 * Get workdir status character
 */
function getWorkdirStatus(stage: 0 | 1 | 2 | 3, workdir: 0 | 1 | 2): string {
  if (stage === 0 && workdir === 2) {
    return '?'; // Untracked
  }
  if (stage !== 0 && workdir === 0) {
    return 'D'; // Deleted
  }
  if (stage !== 0 && workdir === 2) {
    return 'M'; // Modified
  }
  return ' ';
}

/**
 * isomorphic-git log result
 */
export interface IsomorphicGitCommit {
  oid: string;
  commit: {
    message: string;
    tree: string;
    parent: string[];
    author: {
      name: string;
      email: string;
      timestamp: number;
      timezoneOffset: number;
    };
    committer: {
      name: string;
      email: string;
      timestamp: number;
      timezoneOffset: number;
    };
    gpgsig?: string;
  };
  payload: string;
}

/**
 * Convert isomorphic-git log result to type-git Commit array
 */
export function convertCommits(commits: IsomorphicGitCommit[]): Commit[] {
  return commits.map((result) => {
    const { oid, commit } = result;
    const messageParts = commit.message.split('\n');
    const subject = messageParts[0] ?? '';
    const body = messageParts.slice(1).join('\n').trim();

    return {
      hash: oid,
      abbrevHash: oid.substring(0, 7),
      parents: commit.parent,
      author: {
        name: commit.author.name,
        email: commit.author.email,
        timestamp: commit.author.timestamp,
      },
      committer: {
        name: commit.committer.name,
        email: commit.committer.email,
        timestamp: commit.committer.timestamp,
      },
      subject,
      body,
    };
  });
}

/**
 * Convert isomorphic-git branch list to type-git BranchInfo array
 */
export async function convertBranches(
  branches: string[],
  currentBranch: string | undefined,
  resolveRef: (ref: string) => Promise<string>,
): Promise<BranchInfo[]> {
  const results: BranchInfo[] = [];

  for (const name of branches) {
    try {
      const commit = await resolveRef(`refs/heads/${name}`);

      results.push({
        name,
        current: name === currentBranch,
        commit: commit.substring(0, 7),
        upstream: undefined, // isomorphic-git doesn't easily expose this
        gone: false,
      });
    } catch {
      // Skip branches that can't be resolved
    }
  }

  return results;
}

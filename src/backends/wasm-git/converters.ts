/**
 * Type converters for wasm-git backend
 *
 * Converts wasm-git (libgit2 WASM) output types to type-git types.
 * Since wasm-git uses the same underlying libgit2 structure as nodegit,
 * the status flags are identical.
 */

import type { BranchInfo, Commit, StatusEntry } from '../../core/repo.js';

/**
 * libgit2 status flags (same as nodegit)
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
  IGNORED: 16384,
  CONFLICTED: 32768,
} as const;

/**
 * wasm-git status entry from FS.analyzePath or status iteration
 */
export interface WasmGitStatusEntry {
  path: string;
  status: number;
}

/**
 * Convert wasm-git status entries to type-git StatusEntry array
 */
export function convertStatus(entries: WasmGitStatusEntry[]): StatusEntry[] {
  return entries.map((entry) => ({
    path: entry.path,
    index: getIndexStatus(entry.status),
    workdir: getWorkdirStatus(entry.status),
  }));
}

/**
 * Get index status character from libgit2 status flags
 */
function getIndexStatus(status: number): string {
  if (status & STATUS_FLAGS.INDEX_NEW) {
    return 'A';
  }
  if (status & STATUS_FLAGS.INDEX_MODIFIED) {
    return 'M';
  }
  if (status & STATUS_FLAGS.INDEX_DELETED) {
    return 'D';
  }
  if (status & STATUS_FLAGS.INDEX_RENAMED) {
    return 'R';
  }
  if (status & STATUS_FLAGS.INDEX_TYPECHANGE) {
    return 'T';
  }
  return ' ';
}

/**
 * Get workdir status character from libgit2 status flags
 */
function getWorkdirStatus(status: number): string {
  if (status & STATUS_FLAGS.WT_NEW) {
    return '?';
  }
  if (status & STATUS_FLAGS.WT_MODIFIED) {
    return 'M';
  }
  if (status & STATUS_FLAGS.WT_DELETED) {
    return 'D';
  }
  if (status & STATUS_FLAGS.WT_RENAMED) {
    return 'R';
  }
  if (status & STATUS_FLAGS.WT_TYPECHANGE) {
    return 'T';
  }
  if (status & STATUS_FLAGS.IGNORED) {
    return '!';
  }
  if (status & STATUS_FLAGS.CONFLICTED) {
    return 'U';
  }
  return ' ';
}

/**
 * wasm-git commit data structure
 */
export interface WasmGitCommitData {
  oid: string;
  message: string;
  parentOids: string[];
  author: {
    name: string;
    email: string;
    time: number;
  };
  committer: {
    name: string;
    email: string;
    time: number;
  };
}

/**
 * Convert wasm-git commit to type-git Commit
 */
export function convertCommit(commit: WasmGitCommitData): Commit {
  const messageParts = commit.message.split('\n');
  const subject = messageParts[0] ?? '';
  const body = messageParts.slice(1).join('\n').trim();

  return {
    hash: commit.oid,
    abbrevHash: commit.oid.substring(0, 7),
    parents: commit.parentOids,
    author: {
      name: commit.author.name,
      email: commit.author.email,
      timestamp: commit.author.time,
    },
    committer: {
      name: commit.committer.name,
      email: commit.committer.email,
      timestamp: commit.committer.time,
    },
    subject,
    body,
  };
}

/**
 * Convert wasm-git commits to type-git Commit array
 */
export function convertCommits(commits: WasmGitCommitData[]): Commit[] {
  return commits.map(convertCommit);
}

/**
 * wasm-git branch data structure
 */
export interface WasmGitBranchData {
  name: string;
  oid: string;
  isHead: boolean;
}

/**
 * Convert wasm-git branches to type-git BranchInfo array
 */
export function convertBranches(branches: WasmGitBranchData[]): BranchInfo[] {
  return branches.map((branch) => ({
    name: branch.name,
    current: branch.isHead,
    commit: branch.oid.substring(0, 7),
    upstream: undefined,
    gone: false,
  }));
}

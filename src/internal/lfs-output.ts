import type { LfsFileEntry, LfsStatus } from '../core/repo.js';
import { GitError } from '../core/types.js';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function data(stdout: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(stdout);
    if (record(value)) {
      return value;
    }
  } catch {
    /* Report one consistent parse failure below. */
  }
  throw new GitError('ParseError', 'Invalid Git LFS JSON', { stdout });
}
function validSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
export function parseLfsStatusJson(stdout: string): LfsStatus {
  const files = data(stdout).files;
  if (!record(files)) {
    throw new GitError('ParseError', 'Missing Git LFS status files');
  }
  return {
    files: Object.entries(files).map(([name, value]) => {
      if (
        !record(value) ||
        typeof value.status !== 'string' ||
        (value.size !== undefined && !validSize(value.size))
      ) {
        throw new GitError('ParseError', 'Invalid Git LFS status entry');
      }
      return { name, status: value.status, ...(validSize(value.size) ? { size: value.size } : {}) };
    }),
  };
}
export function parseLfsFilesJson(stdout: string): LfsFileEntry[] {
  const files = data(stdout).files;
  if (files === null) {
    return []; // Git LFS encodes an empty slice as null.
  }
  if (!Array.isArray(files)) {
    throw new GitError('ParseError', 'Missing Git LFS file list');
  }
  return files.map((value: unknown) => {
    if (
      !record(value) ||
      typeof value.name !== 'string' ||
      typeof value.oid !== 'string' ||
      !/^[a-f0-9]{64}$/.test(value.oid) ||
      typeof value.checkout !== 'boolean' ||
      !validSize(value.size)
    ) {
      throw new GitError('ParseError', 'Invalid Git LFS file entry');
    }
    return {
      path: value.name,
      oid: value.oid,
      size: value.size,
      status: value.checkout ? 'checked-out' : 'not-checked-out',
    };
  });
}

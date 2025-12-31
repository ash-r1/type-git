/**
 * stdout parsing utilities for Git output
 *
 * This module provides:
 * - parseLines: Parse newline-separated output
 * - parseRecords: Parse delimited records (NUL-terminated or custom)
 * - parseJson: Parse JSON output
 * - parseKeyValue: Parse key-value pairs
 */

/**
 * Safely get an element from an array, throwing if undefined
 * @internal
 */
function at<T>(arr: T[], index: number, context: string): T {
  const value = arr[index];
  if (value === undefined) {
    throw new Error(`Parse error: expected element at index ${index} in ${context}`);
  }
  return value;
}

/**
 * Parse newline-separated output into lines
 *
 * @param stdout - Raw stdout string
 * @param options - Parse options
 * @returns Array of non-empty lines
 */
export function parseLines(
  stdout: string,
  options?: {
    /** Keep empty lines (default: false) */
    keepEmpty?: boolean;
    /** Trim each line (default: true) */
    trim?: boolean;
  },
): string[] {
  const { keepEmpty = false, trim = true } = options ?? {};

  const lines = stdout.split('\n');

  return lines
    .map((line) => (trim ? line.trim() : line))
    .filter((line) => keepEmpty || line.length > 0);
}

/**
 * Parse delimited records (e.g., NUL-terminated for --format with %x00)
 *
 * @param stdout - Raw stdout string
 * @param delimiter - Record delimiter (default: '\0')
 * @returns Array of records
 */
export function parseRecords(stdout: string, delimiter: string = '\0'): string[] {
  if (!stdout) {
    return [];
  }

  // Remove trailing delimiter if present
  const normalized = stdout.endsWith(delimiter) ? stdout.slice(0, -delimiter.length) : stdout;

  if (!normalized) {
    return [];
  }

  return normalized.split(delimiter);
}

/**
 * Parse JSON output from git commands
 *
 * @param stdout - Raw stdout string (single JSON object or NDJSON)
 * @param options - Parse options
 * @returns Parsed JSON value(s)
 */
export function parseJson<T = unknown>(
  stdout: string,
  options?: {
    /** Parse as newline-delimited JSON (NDJSON) */
    ndjson?: boolean;
  },
): T | T[] {
  const { ndjson = false } = options ?? {};

  const trimmed = stdout.trim();

  if (!trimmed) {
    return ndjson ? [] : (undefined as T);
  }

  if (ndjson) {
    return trimmed
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as T);
  }

  return JSON.parse(trimmed) as T;
}

/**
 * Parse key-value pairs from git output
 *
 * Used for parsing config output, show --format output, etc.
 *
 * @param stdout - Raw stdout string
 * @param options - Parse options
 * @returns Map of key-value pairs
 */
export function parseKeyValue(
  stdout: string,
  options?: {
    /** Key-value separator (default: '=') */
    separator?: string;
    /** Record delimiter (default: '\n') */
    delimiter?: string;
  },
): Map<string, string> {
  const { separator = '=', delimiter = '\n' } = options ?? {};

  const result = new Map<string, string>();
  const lines = delimiter === '\n' ? parseLines(stdout) : parseRecords(stdout, delimiter);

  for (const line of lines) {
    const sepIndex = line.indexOf(separator);
    if (sepIndex > 0) {
      const key = line.slice(0, sepIndex);
      const value = line.slice(sepIndex + separator.length);
      result.set(key, value);
    }
  }

  return result;
}

/**
 * Parse porcelain v2 status output
 *
 * @param stdout - Raw stdout from `git status --porcelain=v2`
 * @returns Parsed status entries
 */
export type PorcelainV2Entry =
  | {
      type: 'changed';
      xy: string;
      sub: string;
      mH: string;
      mI: string;
      mW: string;
      hH: string;
      hI: string;
      path: string;
      origPath?: string;
    }
  | {
      type: 'untracked';
      path: string;
    }
  | {
      type: 'ignored';
      path: string;
    }
  | {
      type: 'unmerged';
      xy: string;
      sub: string;
      m1: string;
      m2: string;
      m3: string;
      mW: string;
      h1: string;
      h2: string;
      h3: string;
      path: string;
    };

export function parsePorcelainV2(stdout: string): PorcelainV2Entry[] {
  const entries: PorcelainV2Entry[] = [];
  const lines = parseLines(stdout);

  for (const line of lines) {
    if (line.startsWith('1 ')) {
      // Ordinary changed entry
      const parts = line.split(' ');
      const pathPart = parts.slice(8).join(' ');
      entries.push({
        type: 'changed',
        xy: at(parts, 1, 'porcelain-v2 ordinary'),
        sub: at(parts, 2, 'porcelain-v2 ordinary'),
        mH: at(parts, 3, 'porcelain-v2 ordinary'),
        mI: at(parts, 4, 'porcelain-v2 ordinary'),
        mW: at(parts, 5, 'porcelain-v2 ordinary'),
        hH: at(parts, 6, 'porcelain-v2 ordinary'),
        hI: at(parts, 7, 'porcelain-v2 ordinary'),
        path: pathPart,
      });
    } else if (line.startsWith('2 ')) {
      // Renamed/copied entry
      const parts = line.split(' ');
      const pathPart = parts.slice(9).join(' ');
      const pathParts = pathPart.split('\t');
      entries.push({
        type: 'changed',
        xy: at(parts, 1, 'porcelain-v2 renamed'),
        sub: at(parts, 2, 'porcelain-v2 renamed'),
        mH: at(parts, 3, 'porcelain-v2 renamed'),
        mI: at(parts, 4, 'porcelain-v2 renamed'),
        mW: at(parts, 5, 'porcelain-v2 renamed'),
        hH: at(parts, 6, 'porcelain-v2 renamed'),
        hI: at(parts, 7, 'porcelain-v2 renamed'),
        path: at(pathParts, 0, 'porcelain-v2 renamed path'),
        origPath: pathParts[1],
      });
    } else if (line.startsWith('u ')) {
      // Unmerged entry
      const parts = line.split(' ');
      const pathPart = parts.slice(10).join(' ');
      entries.push({
        type: 'unmerged',
        xy: at(parts, 1, 'porcelain-v2 unmerged'),
        sub: at(parts, 2, 'porcelain-v2 unmerged'),
        m1: at(parts, 3, 'porcelain-v2 unmerged'),
        m2: at(parts, 4, 'porcelain-v2 unmerged'),
        m3: at(parts, 5, 'porcelain-v2 unmerged'),
        mW: at(parts, 6, 'porcelain-v2 unmerged'),
        h1: at(parts, 7, 'porcelain-v2 unmerged'),
        h2: at(parts, 8, 'porcelain-v2 unmerged'),
        h3: at(parts, 9, 'porcelain-v2 unmerged'),
        path: pathPart,
      });
    } else if (line.startsWith('? ')) {
      // Untracked
      entries.push({
        type: 'untracked',
        path: line.slice(2),
      });
    } else if (line.startsWith('! ')) {
      // Ignored
      entries.push({
        type: 'ignored',
        path: line.slice(2),
      });
    }
    // Skip header lines (# branch.*)
  }

  return entries;
}

/**
 * Parse git progress output from stderr
 *
 * Parses lines like:
 * - "Counting objects: 100% (10/10), done."
 * - "Compressing objects:  50% (4/8)"
 * - "Receiving objects:  10% (1/10)"
 *
 * @param line - Single line from stderr
 * @returns Parsed progress or null if not a progress line
 */
export type GitProgressInfo = {
  phase: string;
  current: number;
  total: number | null;
  percent: number | null;
  done: boolean;
};

export function parseGitProgress(line: string): GitProgressInfo | null {
  // Pattern: "Phase: XX% (current/total), done." or "Phase: XX% (current/total)"
  const match = line.match(/^(.+?):\s*(\d+)%\s*\((\d+)\/(\d+)\)(?:,\s*(done))?/);

  if (match) {
    const percent = match[2];
    const current = match[3];
    const total = match[4];
    if (percent === undefined || current === undefined || total === undefined) {
      return null;
    }
    return {
      phase: match[1]?.trim() ?? '',
      percent: Number.parseInt(percent, 10),
      current: Number.parseInt(current, 10),
      total: Number.parseInt(total, 10),
      done: match[5] === 'done',
    };
  }

  // Pattern without percentage: "Phase: current/total"
  const simpleMatch = line.match(/^(.+?):\s*(\d+)\/(\d+)/);
  if (simpleMatch) {
    const currentStr = simpleMatch[2];
    const totalStr = simpleMatch[3];
    if (currentStr === undefined || totalStr === undefined) {
      return null;
    }
    const current = Number.parseInt(currentStr, 10);
    const total = Number.parseInt(totalStr, 10);
    return {
      phase: simpleMatch[1]?.trim() ?? '',
      current,
      total,
      percent: total > 0 ? Math.round((current / total) * 100) : null,
      done: false,
    };
  }

  return null;
}

/**
 * Parse LFS progress file line
 *
 * Format: <direction> <oid> <bytes_so_far>/<bytes_total> <bytes_transferred>
 *
 * @param line - Single line from GIT_LFS_PROGRESS file
 * @returns Parsed LFS progress or null if invalid
 */
export type LfsProgressInfo = {
  direction: 'download' | 'upload' | 'checkout';
  oid: string;
  bytesSoFar: number;
  bytesTotal: number;
  bytesTransferred: number;
};

export function parseLfsProgress(line: string): LfsProgressInfo | null {
  const parts = line.trim().split(/\s+/);

  if (parts.length < 4) {
    return null;
  }

  const directionStr = parts[0];
  if (directionStr !== 'download' && directionStr !== 'upload' && directionStr !== 'checkout') {
    return null;
  }
  const direction = directionStr;

  const oid = parts[1];
  const bytesStr = parts[2];
  const transferredStr = parts[3];
  if (oid === undefined || bytesStr === undefined || transferredStr === undefined) {
    return null;
  }

  const bytesMatch = bytesStr.match(/^(\d+)\/(\d+)$/);
  if (!bytesMatch) {
    return null;
  }

  const bytesSoFar = bytesMatch[1];
  const bytesTotal = bytesMatch[2];
  if (bytesSoFar === undefined || bytesTotal === undefined) {
    return null;
  }

  return {
    direction,
    oid,
    bytesSoFar: Number.parseInt(bytesSoFar, 10),
    bytesTotal: Number.parseInt(bytesTotal, 10),
    bytesTransferred: Number.parseInt(transferredStr, 10),
  };
}

// =============================================================================
// LFS Stderr Progress Parser (GIT_LFS_FORCE_PROGRESS=1)
// =============================================================================

/**
 * Parsed LFS stderr progress info
 */
export type LfsStderrProgressInfo = {
  direction: 'download' | 'upload' | 'checkout';
  percent: number;
  filesCompleted: number;
  filesTotal: number;
  bytesSoFar: number;
  bytesTotal: number;
  /** Transfer rate in bytes per second */
  bitrate: number | null;
  done: boolean;
};

/**
 * Parse size string like "1.2 MB", "500 KB", "10 GB" to bytes
 */
function parseSizeToBytes(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) {
    return 0;
  }

  const value = Number.parseFloat(match[1] ?? '0');
  const unit = (match[2] || 'B').toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  return Math.round(value * (multipliers[unit] || 1));
}

/**
 * Parse bitrate string like "500 KB/s", "1.5 MB/s" to bytes per second
 */
function parseBitrateToBytes(bitrateStr: string): number | null {
  const match = bitrateStr.match(/^([\d.]+)\s*(B|KB|MB|GB)\/s$/i);
  if (!match) {
    return null;
  }

  const value = Number.parseFloat(match[1] ?? '0');
  const unit = (match[2] ?? 'B').toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };

  return Math.round(value * (multipliers[unit] || 1));
}

/**
 * Parse LFS progress from stderr (GIT_LFS_FORCE_PROGRESS=1)
 *
 * Formats:
 * - "Downloading LFS objects:  50% (1/2), 1.2 MB | 500 KB/s"
 * - "Uploading LFS objects: 100% (5/5), 10 MB | 1.5 MB/s, done."
 * - "Filtering content:  75% (3/4), 500.0 KB | 100 KB/s"
 * - "Checking out LFS objects:  25% (1/4), 2.0 MB | 1 MB/s"
 *
 * @param line - Single line from stderr
 * @returns Parsed LFS progress or null if not an LFS progress line
 */
export function parseLfsStderrProgress(line: string): LfsStderrProgressInfo | null {
  // Determine direction
  let direction: 'download' | 'upload' | 'checkout';
  if (/downloading|filtering/i.test(line)) {
    direction = 'download';
  } else if (/uploading/i.test(line)) {
    direction = 'upload';
  } else if (/checking out/i.test(line)) {
    direction = 'checkout';
  } else {
    return null;
  }

  // Match: percent% (filesCompleted/filesTotal), size | bitrate[, done.]
  // Also handle format without size: percent% (filesCompleted/filesTotal)
  const progressMatch = line.match(
    /(\d+)%\s*\((\d+)\/(\d+)\)(?:,\s*([\d.]+\s*(?:B|KB|MB|GB|TB)?)\s*(?:\|\s*([\d.]+\s*(?:B|KB|MB|GB)\/s))?)?/i,
  );

  if (!progressMatch) {
    return null;
  }

  const percentStr = progressMatch[1];
  const filesCompletedStr = progressMatch[2];
  const filesTotalStr = progressMatch[3];
  if (percentStr === undefined || filesCompletedStr === undefined || filesTotalStr === undefined) {
    return null;
  }

  const percent = Number.parseInt(percentStr, 10);
  const filesCompleted = Number.parseInt(filesCompletedStr, 10);
  const filesTotal = Number.parseInt(filesTotalStr, 10);
  const sizeStr = progressMatch[4];
  const bitrateStr = progressMatch[5];

  const bytesSoFar = sizeStr ? parseSizeToBytes(sizeStr) : 0;
  // Estimate bytesTotal based on percent (if we have size info)
  const bytesTotal = percent > 0 && bytesSoFar > 0 ? Math.round((bytesSoFar / percent) * 100) : 0;
  const bitrate = bitrateStr ? parseBitrateToBytes(bitrateStr) : null;
  const done = /,\s*done\.?\s*$/i.test(line);

  return {
    direction,
    percent,
    filesCompleted,
    filesTotal,
    bytesSoFar,
    bytesTotal,
    bitrate,
    done,
  };
}

// =============================================================================
// ls-remote Parser
// =============================================================================

/**
 * Parse git ls-remote output
 *
 * Format: <hash>\t<refname>
 *
 * @param stdout - Raw stdout from `git ls-remote`
 * @returns Parsed refs
 */
export type LsRemoteRef = {
  hash: string;
  name: string;
};

export function parseLsRemote(stdout: string): LsRemoteRef[] {
  const refs: LsRemoteRef[] = [];
  const lines = parseLines(stdout);

  for (const line of lines) {
    const [hash, name] = line.split('\t');
    if (hash && name) {
      refs.push({ hash, name });
    }
  }

  return refs;
}

// =============================================================================
// ls-tree Parser
// =============================================================================

/**
 * Object type in a tree
 */
export type LsTreeObjectType = 'blob' | 'tree' | 'commit';

/**
 * Entry from git ls-tree output
 */
export type ParsedLsTreeEntry = {
  /** File mode (e.g., '100644' for regular file, '040000' for directory) */
  mode: string;
  /** Object type: blob (file), tree (directory), or commit (submodule) */
  type: LsTreeObjectType;
  /** Object hash (SHA-1 or SHA-256) */
  hash: string;
  /** File path relative to repository root */
  path: string;
  /** Object size in bytes (only for blobs when using --long option) */
  size?: number;
};

// Regex for standard ls-tree output: <mode> <type> <hash>\t<path>
const LS_TREE_REGEX = /^(\d+)\s+(blob|tree|commit)\s+([a-f0-9]+)\t(.+)$/;

// Regex for ls-tree --long output: <mode> <type> <hash> <size>\t<path>
const LS_TREE_LONG_REGEX = /^(\d+)\s+(blob|tree|commit)\s+([a-f0-9]+)\s+(-|\d+)\t(.+)$/;

/**
 * Parse git ls-tree output
 *
 * Supports multiple output formats:
 * - Default: <mode> <type> <hash>\t<path>
 * - With --long: <mode> <type> <hash> <size>\t<path>
 * - With --name-only: <path>
 * - With --object-only: <hash>
 *
 * @param stdout - Raw stdout from `git ls-tree`
 * @param opts - Parser options to handle different output modes
 * @returns Parsed tree entries
 */
export function parseLsTree(
  stdout: string,
  opts?: { nameOnly?: boolean; objectOnly?: boolean; long?: boolean },
): Array<ParsedLsTreeEntry> {
  const entries: Array<ParsedLsTreeEntry> = [];
  const lines = parseLines(stdout);

  for (const line of lines) {
    // Handle --name-only output (just paths)
    if (opts?.nameOnly) {
      entries.push({
        mode: '',
        type: 'blob',
        hash: '',
        path: line,
      });
      continue;
    }

    // Handle --object-only output (just hashes)
    if (opts?.objectOnly) {
      entries.push({
        mode: '',
        type: 'blob',
        hash: line,
        path: '',
      });
      continue;
    }

    // Try parsing --long format first
    if (opts?.long) {
      const longMatch = line.match(LS_TREE_LONG_REGEX);
      if (longMatch) {
        const mode = longMatch[1];
        const type = longMatch[2];
        const hash = longMatch[3];
        const sizeStr = longMatch[4];
        const path = longMatch[5];
        if (mode && type && hash && path) {
          entries.push({
            mode,
            type: type as LsTreeObjectType,
            hash,
            path,
            size: sizeStr === '-' || !sizeStr ? undefined : Number.parseInt(sizeStr, 10),
          });
        }
        continue;
      }
    }

    // Parse standard format
    const match = line.match(LS_TREE_REGEX);
    if (match) {
      const mode = match[1];
      const type = match[2];
      const hash = match[3];
      const path = match[4];
      if (mode && type && hash && path) {
        entries.push({
          mode,
          type: type as LsTreeObjectType,
          hash,
          path,
        });
      }
    }
  }

  return entries;
}

// =============================================================================
// git log Parser
// =============================================================================

/**
 * Commit information from git log
 */
export type ParsedCommit = {
  hash: string;
  abbrevHash: string;
  parents: string[];
  authorName: string;
  authorEmail: string;
  authorTimestamp: number;
  committerName: string;
  committerEmail: string;
  committerTimestamp: number;
  subject: string;
  body: string;
};

/**
 * The format string used for git log parsing
 *
 * Uses %x00 (NUL) as field separator and %x01 as record separator
 */
export const GIT_LOG_FORMAT =
  '%H%x00%h%x00%P%x00%an%x00%ae%x00%at%x00%cn%x00%ce%x00%ct%x00%s%x00%b%x01';

/**
 * Parse git log output with our custom format
 *
 * @param stdout - Raw stdout from `git log --format=<GIT_LOG_FORMAT>`
 * @returns Parsed commits
 */
export function parseGitLog(stdout: string): ParsedCommit[] {
  const commits: ParsedCommit[] = [];

  // Split by record separator (0x01)
  const records = stdout.split('\x01').filter((r) => r.trim());

  for (const record of records) {
    const fields = record.split('\x00');

    if (fields.length < 11) {
      continue;
    }

    const hash = fields[0];
    const abbrevHash = fields[1];
    const parentsStr = fields[2];
    const authorName = fields[3];
    const authorEmail = fields[4];
    const authorTimestampStr = fields[5];
    const committerName = fields[6];
    const committerEmail = fields[7];
    const committerTimestampStr = fields[8];
    const subject = fields[9];

    // Skip if required fields are missing
    if (
      hash === undefined ||
      abbrevHash === undefined ||
      authorName === undefined ||
      authorEmail === undefined ||
      authorTimestampStr === undefined ||
      committerName === undefined ||
      committerEmail === undefined ||
      committerTimestampStr === undefined ||
      subject === undefined
    ) {
      continue;
    }

    commits.push({
      hash,
      abbrevHash,
      parents: parentsStr ? parentsStr.split(' ').filter(Boolean) : [],
      authorName,
      authorEmail,
      authorTimestamp: Number.parseInt(authorTimestampStr, 10),
      committerName,
      committerEmail,
      committerTimestamp: Number.parseInt(committerTimestampStr, 10),
      subject,
      body: fields[10]?.trim() ?? '',
    });
  }

  return commits;
}

// =============================================================================
// git worktree list --porcelain Parser
// =============================================================================

/**
 * Worktree information from git worktree list --porcelain
 */
export type ParsedWorktree = {
  path: string;
  head: string;
  branch?: string;
  locked: boolean;
  prunable: boolean;
};

/**
 * Parse git worktree list --porcelain output
 *
 * Format:
 * worktree /path/to/worktree
 * HEAD <sha>
 * branch refs/heads/main
 * [locked [reason]]
 * [prunable]
 *
 * @param stdout - Raw stdout from `git worktree list --porcelain`
 * @returns Parsed worktrees
 */
export function parseWorktreeList(stdout: string): ParsedWorktree[] {
  const worktrees: ParsedWorktree[] = [];
  const lines = parseLines(stdout, { keepEmpty: true });

  let current: Partial<ParsedWorktree> | null = null;

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      // Save previous worktree if exists
      if (current?.path && current.head) {
        worktrees.push({
          path: current.path,
          head: current.head,
          branch: current.branch,
          locked: current.locked ?? false,
          prunable: current.prunable ?? false,
        });
      }
      // Start new worktree
      current = {
        path: line.slice('worktree '.length),
        locked: false,
        prunable: false,
      };
    } else if (line.startsWith('HEAD ') && current) {
      current.head = line.slice('HEAD '.length);
    } else if (line.startsWith('branch ') && current) {
      current.branch = line.slice('branch '.length);
    } else if (line.startsWith('detached') && current) {
      // Detached HEAD - no branch
    } else if (line.startsWith('locked') && current) {
      current.locked = true;
    } else if (line.startsWith('prunable') && current) {
      current.prunable = true;
    } else if (line === '' && current && current.path && current.head) {
      // Empty line marks end of worktree entry
      worktrees.push({
        path: current.path,
        head: current.head,
        branch: current.branch,
        locked: current.locked ?? false,
        prunable: current.prunable ?? false,
      });
      current = null;
    }
  }

  // Don't forget the last worktree
  if (current?.path && current.head) {
    worktrees.push({
      path: current.path,
      head: current.head,
      branch: current.branch,
      locked: current.locked ?? false,
      prunable: current.prunable ?? false,
    });
  }

  return worktrees;
}

// =============================================================================
// Error Category Detection (§13.3)
// =============================================================================

import type { GitErrorCategory } from '../core/types.js';

/**
 * Error detection patterns for category classification (§13.3)
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp; category: GitErrorCategory }> = [
  // Auth errors
  { pattern: /fatal:\s*Authentication failed/i, category: 'auth' },
  { pattern: /fatal:.*could not read Username/i, category: 'auth' },
  { pattern: /Permission denied \(publickey\)/i, category: 'auth' },
  { pattern: /HTTP\s+401/i, category: 'auth' },

  // Network errors
  { pattern: /fatal:\s*Could not resolve host/i, category: 'network' },
  { pattern: /fatal:\s*unable to access.*Connection timed out/i, category: 'network' },
  { pattern: /fatal:\s*unable to access.*Connection refused/i, category: 'network' },
  { pattern: /fatal:\s*Could not read from remote repository/i, category: 'network' },

  // Conflict errors
  { pattern: /CONFLICT \(content\)/i, category: 'conflict' },
  { pattern: /Automatic merge failed/i, category: 'conflict' },
  { pattern: /error:\s*you need to resolve your current index first/i, category: 'conflict' },

  // LFS errors
  { pattern: /LFS:.*507 Insufficient Storage/i, category: 'lfs' },
  { pattern: /batch response:.*error/i, category: 'lfs' },
  { pattern: /smudge filter lfs failed/i, category: 'lfs' },

  // Permission errors
  { pattern: /error:\s*cannot lock ref/i, category: 'permission' },
  { pattern: /fatal:\s*Unable to create.*Permission denied/i, category: 'permission' },
  { pattern: /error:\s*unable to unlink.*Permission denied/i, category: 'permission' },

  // Corruption errors
  { pattern: /fatal:\s*bad object/i, category: 'corruption' },
  { pattern: /fatal:\s*loose object.*is corrupt/i, category: 'corruption' },
  { pattern: /error:\s*object file.*is empty/i, category: 'corruption' },
];

/**
 * Detect error category from stderr content (§13.3)
 *
 * @param stderr - stderr content from git command
 * @returns Detected error category
 */
export function detectErrorCategory(stderr: string): GitErrorCategory {
  for (const { pattern, category } of ERROR_PATTERNS) {
    if (pattern.test(stderr)) {
      return category;
    }
  }
  return 'unknown';
}

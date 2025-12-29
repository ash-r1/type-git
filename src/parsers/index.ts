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
        xy: parts[1]!,
        sub: parts[2]!,
        mH: parts[3]!,
        mI: parts[4]!,
        mW: parts[5]!,
        hH: parts[6]!,
        hI: parts[7]!,
        path: pathPart,
      });
    } else if (line.startsWith('2 ')) {
      // Renamed/copied entry
      const parts = line.split(' ');
      const pathPart = parts.slice(9).join(' ');
      const [path, origPath] = pathPart.split('\t');
      entries.push({
        type: 'changed',
        xy: parts[1]!,
        sub: parts[2]!,
        mH: parts[3]!,
        mI: parts[4]!,
        mW: parts[5]!,
        hH: parts[6]!,
        hI: parts[7]!,
        path: path!,
        origPath,
      });
    } else if (line.startsWith('u ')) {
      // Unmerged entry
      const parts = line.split(' ');
      const pathPart = parts.slice(10).join(' ');
      entries.push({
        type: 'unmerged',
        xy: parts[1]!,
        sub: parts[2]!,
        m1: parts[3]!,
        m2: parts[4]!,
        m3: parts[5]!,
        mW: parts[6]!,
        h1: parts[7]!,
        h2: parts[8]!,
        h3: parts[9]!,
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
    return {
      phase: match[1]!.trim(),
      percent: parseInt(match[2]!, 10),
      current: parseInt(match[3]!, 10),
      total: parseInt(match[4]!, 10),
      done: match[5] === 'done',
    };
  }

  // Pattern without percentage: "Phase: current/total"
  const simpleMatch = line.match(/^(.+?):\s*(\d+)\/(\d+)/);
  if (simpleMatch) {
    const current = parseInt(simpleMatch[2]!, 10);
    const total = parseInt(simpleMatch[3]!, 10);
    return {
      phase: simpleMatch[1]!.trim(),
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
  direction: 'download' | 'upload';
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

  const direction = parts[0] as 'download' | 'upload';
  if (direction !== 'download' && direction !== 'upload') {
    return null;
  }

  const oid = parts[1]!;
  const bytesMatch = parts[2]!.match(/^(\d+)\/(\d+)$/);
  if (!bytesMatch) {
    return null;
  }

  return {
    direction,
    oid,
    bytesSoFar: parseInt(bytesMatch[1]!, 10),
    bytesTotal: parseInt(bytesMatch[2]!, 10),
    bytesTransferred: parseInt(parts[3]!, 10),
  };
}

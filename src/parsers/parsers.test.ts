/**
 * Tests for parser utilities
 */

import { describe, expect, it } from 'vitest';
import {
  detectErrorCategory,
  parseGitLog,
  parseGitProgress,
  parseLfsProgress,
  parseLines,
  parseLsRemote,
  parseRecords,
  parseWorktreeList,
} from './index.js';

describe('parseLines', () => {
  it('should parse newline-separated output', () => {
    const lines = parseLines('line1\nline2\nline3');
    expect(lines).toEqual(['line1', 'line2', 'line3']);
  });

  it('should skip empty lines by default', () => {
    const lines = parseLines('line1\n\nline2\n');
    expect(lines).toEqual(['line1', 'line2']);
  });

  it('should keep empty lines when requested', () => {
    const lines = parseLines('line1\n\nline2', { keepEmpty: true });
    expect(lines).toEqual(['line1', '', 'line2']);
  });

  it('should trim lines by default', () => {
    const lines = parseLines('  line1  \n  line2  ');
    expect(lines).toEqual(['line1', 'line2']);
  });
});

describe('parseRecords', () => {
  it('should parse NUL-delimited records', () => {
    const records = parseRecords('record1\0record2\0record3');
    expect(records).toEqual(['record1', 'record2', 'record3']);
  });

  it('should handle trailing delimiter', () => {
    const records = parseRecords('record1\0record2\0');
    expect(records).toEqual(['record1', 'record2']);
  });

  it('should handle empty input', () => {
    const records = parseRecords('');
    expect(records).toEqual([]);
  });
});

describe('parseLsRemote', () => {
  it('should parse ls-remote output', () => {
    const stdout = `abc123\trefs/heads/main
def456\trefs/heads/feature
789ghi\trefs/tags/v1.0.0`;

    const refs = parseLsRemote(stdout);
    expect(refs).toEqual([
      { hash: 'abc123', name: 'refs/heads/main' },
      { hash: 'def456', name: 'refs/heads/feature' },
      { hash: '789ghi', name: 'refs/tags/v1.0.0' },
    ]);
  });

  it('should handle empty output', () => {
    const refs = parseLsRemote('');
    expect(refs).toEqual([]);
  });
});

describe('parseGitLog', () => {
  it('should parse git log output with custom format', () => {
    const stdout =
      'abc123\x00abc1\x00parent1 parent2\x00Author Name\x00author@example.com\x001234567890\x00Committer Name\x00committer@example.com\x001234567899\x00Commit subject\x00Commit body\x01';

    const commits = parseGitLog(stdout);
    expect(commits).toHaveLength(1);
    expect(commits[0]).toEqual({
      hash: 'abc123',
      abbrevHash: 'abc1',
      parents: ['parent1', 'parent2'],
      authorName: 'Author Name',
      authorEmail: 'author@example.com',
      authorTimestamp: 1234567890,
      committerName: 'Committer Name',
      committerEmail: 'committer@example.com',
      committerTimestamp: 1234567899,
      subject: 'Commit subject',
      body: 'Commit body',
    });
  });

  it('should handle multiple commits', () => {
    const stdout =
      'hash1\x00h1\x00\x00Author\x00a@e.com\x001000\x00Committer\x00c@e.com\x001001\x00Subject1\x00\x01' +
      'hash2\x00h2\x00hash1\x00Author\x00a@e.com\x001002\x00Committer\x00c@e.com\x001003\x00Subject2\x00Body2\x01';

    const commits = parseGitLog(stdout);
    expect(commits).toHaveLength(2);
    expect(commits[0]?.subject).toBe('Subject1');
    expect(commits[1]?.subject).toBe('Subject2');
    expect(commits[1]?.parents).toEqual(['hash1']);
  });

  it('should trim hash when body ends with newline', () => {
    // When body ends with newline, the next record starts with that newline
    // which would pollute the hash field if not trimmed
    const stdout =
      'hash1\x00h1\x00\x00Author\x00a@e.com\x001000\x00Committer\x00c@e.com\x001001\x00Subject1\x00Body with trailing newline\n\x01' +
      '\nhash2\x00h2\x00hash1\x00Author\x00a@e.com\x001002\x00Committer\x00c@e.com\x001003\x00Subject2\x00\x01';

    const commits = parseGitLog(stdout);
    expect(commits).toHaveLength(2);
    expect(commits[0]?.hash).toBe('hash1');
    expect(commits[0]?.body).toBe('Body with trailing newline');
    expect(commits[1]?.hash).toBe('hash2');
  });
});

describe('parseWorktreeList', () => {
  it('should parse worktree list --porcelain output', () => {
    const stdout = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
HEAD def456
branch refs/heads/feature
locked

worktree /path/to/detached
HEAD 789ghi
detached
`;

    const worktrees = parseWorktreeList(stdout);
    expect(worktrees).toHaveLength(3);

    expect(worktrees[0]).toEqual({
      path: '/path/to/main',
      head: 'abc123',
      branch: 'refs/heads/main',
      locked: false,
      prunable: false,
    });

    expect(worktrees[1]).toEqual({
      path: '/path/to/feature',
      head: 'def456',
      branch: 'refs/heads/feature',
      locked: true,
      prunable: false,
    });

    expect(worktrees[2]).toEqual({
      path: '/path/to/detached',
      head: '789ghi',
      branch: undefined,
      locked: false,
      prunable: false,
    });
  });
});

describe('parseGitProgress', () => {
  it('should parse progress with percentage', () => {
    const progress = parseGitProgress('Counting objects: 100% (10/10), done.');
    expect(progress).toEqual({
      phase: 'Counting objects',
      percent: 100,
      current: 10,
      total: 10,
      done: true,
    });
  });

  it('should parse progress without done', () => {
    const progress = parseGitProgress('Compressing objects:  50% (4/8)');
    expect(progress).toEqual({
      phase: 'Compressing objects',
      percent: 50,
      current: 4,
      total: 8,
      done: false,
    });
  });

  it('should parse progress without percentage', () => {
    const progress = parseGitProgress('Receiving objects: 5/10');
    expect(progress).toEqual({
      phase: 'Receiving objects',
      current: 5,
      total: 10,
      percent: 50,
      done: false,
    });
  });

  it('should return null for non-progress lines', () => {
    expect(parseGitProgress('Some other output')).toBeNull();
  });
});

describe('parseLfsProgress', () => {
  it('should parse download progress', () => {
    const progress = parseLfsProgress('download abc123 1000/2000 500');
    expect(progress).toEqual({
      direction: 'download',
      oid: 'abc123',
      bytesSoFar: 1000,
      bytesTotal: 2000,
      bytesTransferred: 500,
    });
  });

  it('should parse upload progress', () => {
    const progress = parseLfsProgress('upload def456 500/1000 250');
    expect(progress).toEqual({
      direction: 'upload',
      oid: 'def456',
      bytesSoFar: 500,
      bytesTotal: 1000,
      bytesTransferred: 250,
    });
  });

  it('should parse checkout progress', () => {
    const progress = parseLfsProgress('checkout ghi789 100/100 100');
    expect(progress).toEqual({
      direction: 'checkout',
      oid: 'ghi789',
      bytesSoFar: 100,
      bytesTotal: 100,
      bytesTransferred: 100,
    });
  });

  it('should return null for invalid lines', () => {
    expect(parseLfsProgress('invalid line')).toBeNull();
    expect(parseLfsProgress('download abc123')).toBeNull();
    expect(parseLfsProgress('invalid abc123 100/200 50')).toBeNull();
  });
});

describe('detectErrorCategory', () => {
  it('should detect auth errors', () => {
    expect(detectErrorCategory('fatal: Authentication failed for')).toBe('auth');
    expect(detectErrorCategory('Permission denied (publickey).')).toBe('auth');
    expect(detectErrorCategory('HTTP 401 Unauthorized')).toBe('auth');
  });

  it('should detect network errors', () => {
    expect(detectErrorCategory('fatal: Could not resolve host: github.com')).toBe('network');
    expect(detectErrorCategory('fatal: unable to access: Connection timed out')).toBe('network');
    expect(detectErrorCategory('fatal: Could not read from remote repository.')).toBe('network');
  });

  it('should detect conflict errors', () => {
    expect(detectErrorCategory('CONFLICT (content): Merge conflict in file.txt')).toBe('conflict');
    expect(detectErrorCategory('Automatic merge failed; fix conflicts and then commit')).toBe(
      'conflict',
    );
  });

  it('should detect lfs errors', () => {
    expect(detectErrorCategory('LFS: 507 Insufficient Storage')).toBe('lfs');
    expect(detectErrorCategory('smudge filter lfs failed')).toBe('lfs');
  });

  it('should detect permission errors', () => {
    expect(detectErrorCategory("error: cannot lock ref 'refs/heads/main'")).toBe('permission');
    expect(
      detectErrorCategory('fatal: Unable to create /repo/.git/index.lock: Permission denied'),
    ).toBe('permission');
  });

  it('should detect corruption errors', () => {
    expect(detectErrorCategory('fatal: bad object abc123')).toBe('corruption');
    expect(detectErrorCategory('fatal: loose object abc123 is corrupt')).toBe('corruption');
  });

  it('should return unknown for unrecognized errors', () => {
    expect(detectErrorCategory('Some unknown error')).toBe('unknown');
  });
});

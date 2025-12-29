import { describe, it, expect } from 'vitest';
import { GitError } from '../../src/core/types.js';

describe('GitError', () => {
  it('should create error with kind and message', () => {
    const error = new GitError('NonZeroExit', 'Command failed');

    expect(error.kind).toBe('NonZeroExit');
    expect(error.message).toBe('Command failed');
    expect(error.name).toBe('GitError');
  });

  it('should include context information', () => {
    const error = new GitError('ParseError', 'Failed to parse output', {
      argv: ['git', 'status'],
      workdir: '/tmp/repo',
      exitCode: 0,
      stdout: 'some output',
      stderr: '',
    });

    expect(error.context.argv).toEqual(['git', 'status']);
    expect(error.context.workdir).toBe('/tmp/repo');
    expect(error.context.exitCode).toBe(0);
  });

  it('should be instanceof Error', () => {
    const error = new GitError('SpawnFailed', 'Failed to spawn');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(GitError);
  });
});

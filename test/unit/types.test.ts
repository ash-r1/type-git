import { describe, it, expect } from 'vitest';
import type { Git } from '../../src/core/git.js';
import type { BareRepo, WorktreeRepo } from '../../src/core/repo.js';
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

/**
 * Type-level tests for Git interface overloads.
 * These tests verify that TypeScript correctly narrows return types based on options.
 */
describe('Git interface overloads (type-level)', () => {
  // Type assertions that will fail at compile time if overloads are incorrect
  it('init returns WorktreeRepo when bare is not specified', () => {
    // This is a type-level test - we just need it to compile
    const _typeTest = async (git: Git) => {
      const repo = await git.init('/path');
      // TypeScript should infer repo as WorktreeRepo
      const _workdir: typeof repo extends WorktreeRepo ? true : false = true;
      expect(_workdir).toBe(true);
    };
    expect(true).toBe(true);
  });

  it('init returns BareRepo when bare: true', () => {
    const _typeTest = async (git: Git) => {
      const repo = await git.init('/path', { bare: true });
      // TypeScript should infer repo as BareRepo
      const _gitDir: typeof repo extends BareRepo ? true : false = true;
      expect(_gitDir).toBe(true);
    };
    expect(true).toBe(true);
  });

  it('clone returns WorktreeRepo when bare/mirror is not specified', () => {
    const _typeTest = async (git: Git) => {
      const repo = await git.clone('url', '/path');
      // TypeScript should infer repo as WorktreeRepo
      const _workdir: typeof repo extends WorktreeRepo ? true : false = true;
      expect(_workdir).toBe(true);
    };
    expect(true).toBe(true);
  });

  it('clone returns BareRepo when bare: true', () => {
    const _typeTest = async (git: Git) => {
      const repo = await git.clone('url', '/path', { bare: true });
      // TypeScript should infer repo as BareRepo
      const _gitDir: typeof repo extends BareRepo ? true : false = true;
      expect(_gitDir).toBe(true);
    };
    expect(true).toBe(true);
  });

  it('clone returns BareRepo when mirror: true', () => {
    const _typeTest = async (git: Git) => {
      const repo = await git.clone('url', '/path', { mirror: true });
      // TypeScript should infer repo as BareRepo
      const _gitDir: typeof repo extends BareRepo ? true : false = true;
      expect(_gitDir).toBe(true);
    };
    expect(true).toBe(true);
  });

  it('open returns WorktreeRepo', () => {
    const _typeTest = async (git: Git) => {
      const repo = await git.open('/path');
      // TypeScript should infer repo as WorktreeRepo
      const _workdir: typeof repo extends WorktreeRepo ? true : false = true;
      expect(_workdir).toBe(true);
    };
    expect(true).toBe(true);
  });

  it('openBare returns BareRepo', () => {
    const _typeTest = async (git: Git) => {
      const repo = await git.openBare('/path');
      // TypeScript should infer repo as BareRepo
      const _gitDir: typeof repo extends BareRepo ? true : false = true;
      expect(_gitDir).toBe(true);
    };
    expect(true).toBe(true);
  });

  it('openRaw returns WorktreeRepo | BareRepo', () => {
    const _typeTest = async (git: Git) => {
      const repo = await git.openRaw('/path');
      // TypeScript should infer repo as WorktreeRepo | BareRepo (union type)
      // We can check that it's assignable to both possibilities
      if ('workdir' in repo) {
        const _workdir: WorktreeRepo = repo;
        expect(_workdir).toBeDefined();
      } else {
        const _gitDir: BareRepo = repo;
        expect(_gitDir).toBeDefined();
      }
    };
    expect(true).toBe(true);
  });
});

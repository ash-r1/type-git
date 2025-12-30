/**
 * Git implementation - repository-agnostic operations
 */

import type { RuntimeAdapters } from '../core/adapters.js';
import type { ExecOpts, RawResult, GitOpenOptions } from '../core/types.js';
import { GitError } from '../core/types.js';
import type { Git, CloneOpts, InitOpts, LsRemoteOpts, LsRemoteResult } from '../core/git.js';
import type { WorktreeRepo, BareRepo } from '../core/repo.js';
import { CliRunner, type CliRunnerOptions } from '../runner/cli-runner.js';
import { parseLsRemote } from '../parsers/index.js';
import { WorktreeRepoImpl } from './worktree-repo-impl.js';
import { BareRepoImpl } from './bare-repo-impl.js';

/**
 * Options for creating a Git instance
 */
export type CreateGitOptions = CliRunnerOptions & {
  /** Runtime adapters (exec, fs) */
  adapters: RuntimeAdapters;
};

/**
 * Git implementation
 */
export class GitImpl implements Git {
  private readonly runner: CliRunner;

  constructor(options: CreateGitOptions) {
    this.runner = new CliRunner(options.adapters, options);
  }

  /**
   * Open an existing repository
   */
  async open(path: string, opts?: GitOpenOptions): Promise<WorktreeRepo | BareRepo> {
    // Check if it's a bare repository
    const result = await this.runner.run({ type: 'worktree', workdir: path }, ['rev-parse', '--is-bare-repository']);

    if (result.exitCode !== 0) {
      // Try as git-dir directly
      const bareResult = await this.runner.run({ type: 'bare', gitDir: path }, ['rev-parse', '--is-bare-repository']);

      if (bareResult.exitCode !== 0) {
        throw new GitError('NonZeroExit', `Not a git repository: ${path}`, {
          exitCode: bareResult.exitCode,
          stderr: bareResult.stderr,
        });
      }

      if (bareResult.stdout.trim() === 'true') {
        return new BareRepoImpl(this.runner, path, opts);
      }
    }

    const isBare = result.stdout.trim() === 'true';

    if (isBare) {
      // Find the actual git-dir
      const gitDirResult = await this.runner.run({ type: 'worktree', workdir: path }, ['rev-parse', '--git-dir']);
      const gitDir = gitDirResult.stdout.trim();
      return new BareRepoImpl(this.runner, gitDir, opts);
    }

    return new WorktreeRepoImpl(this.runner, path, opts);
  }

  /**
   * Clone a repository
   */
  async clone(
    url: string,
    path: string,
    opts?: CloneOpts & ExecOpts,
  ): Promise<WorktreeRepo | BareRepo> {
    const args = ['clone'];

    // Add progress flag for progress tracking
    if (opts?.onProgress) {
      args.push('--progress');
    }

    if (opts?.bare) {
      args.push('--bare');
    }

    if (opts?.depth !== undefined) {
      args.push('--depth', String(opts.depth));
    }

    if (opts?.branch) {
      args.push('--branch', opts.branch);
    }

    if (opts?.singleBranch) {
      args.push('--single-branch');
    }

    if (opts?.mirror) {
      args.push('--mirror');
    }

    if (opts?.noCheckout) {
      args.push('--no-checkout');
    }

    if (opts?.recurseSubmodules) {
      args.push('--recurse-submodules');
    }

    args.push(url, path);

    await this.runner.runOrThrow({ type: 'global' }, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });

    // Return the appropriate repo type
    if (opts?.bare || opts?.mirror) {
      return new BareRepoImpl(this.runner, path);
    }

    return new WorktreeRepoImpl(this.runner, path);
  }

  /**
   * Initialize a new repository
   */
  async init(path: string, opts?: InitOpts & ExecOpts): Promise<WorktreeRepo | BareRepo> {
    const args = ['init'];

    if (opts?.bare) {
      args.push('--bare');
    }

    if (opts?.initialBranch) {
      args.push('--initial-branch', opts.initialBranch);
    }

    args.push(path);

    await this.runner.runOrThrow({ type: 'global' }, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });

    if (opts?.bare) {
      return new BareRepoImpl(this.runner, path);
    }

    return new WorktreeRepoImpl(this.runner, path);
  }

  /**
   * List references in a remote repository
   */
  async lsRemote(url: string, opts?: LsRemoteOpts & ExecOpts): Promise<LsRemoteResult> {
    const args = ['ls-remote'];

    if (opts?.heads) {
      args.push('--heads');
    }

    if (opts?.tags) {
      args.push('--tags');
    }

    if (opts?.refs) {
      args.push('--refs');
    }

    args.push(url);

    const result = await this.runner.runOrThrow({ type: 'global' }, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });

    const refs = parseLsRemote(result.stdout);

    return { refs };
  }

  /**
   * Get git version
   */
  async version(opts?: ExecOpts): Promise<string> {
    const result = await this.runner.runOrThrow({ type: 'global' }, ['--version'], {
      signal: opts?.signal,
    });

    // Parse "git version X.Y.Z" format
    const match = result.stdout.match(/git version (\S+)/);
    return match ? match[1]! : result.stdout.trim();
  }

  /**
   * Execute a raw git command (repository-agnostic)
   */
  async raw(argv: string[], opts?: ExecOpts): Promise<RawResult> {
    return this.runner.run({ type: 'global' }, argv, opts);
  }
}

/**
 * Create a new Git instance
 *
 * @param options - Creation options including runtime adapters
 * @returns Git instance
 */
export function createGit(options: CreateGitOptions): Git {
  return new GitImpl(options);
}

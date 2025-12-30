/**
 * BareRepo implementation - repository without working directory
 */

import type { BareRepo, FetchOpts, PushOpts } from '../core/repo.js';
import type { ExecOpts, ExecutionContext, RawResult } from '../core/types.js';
import type { CliRunner } from '../runner/cli-runner.js';

/**
 * BareRepo implementation
 */
export class BareRepoImpl implements BareRepo {
  public readonly gitDir: string;
  private readonly runner: CliRunner;

  public constructor(runner: CliRunner, gitDir: string, _options?: unknown) {
    this.runner = runner;
    this.gitDir = gitDir;
  }

  private get context(): ExecutionContext {
    return { type: 'bare', gitDir: this.gitDir };
  }

  /**
   * Execute a raw git command in this repository context
   */
  public async raw(argv: Array<string>, opts?: ExecOpts): Promise<RawResult> {
    return this.runner.run(this.context, argv, opts);
  }

  /**
   * Fetch from remote
   */
  public async fetch(opts?: FetchOpts & ExecOpts): Promise<void> {
    const args = ['fetch'];

    if (opts?.onProgress) {
      args.push('--progress');
    }

    if (opts?.prune) {
      args.push('--prune');
    }

    if (opts?.tags) {
      args.push('--tags');
    }

    if (opts?.depth !== undefined) {
      args.push(`--depth=${opts.depth}`);
    }

    if (opts?.remote) {
      args.push(opts.remote);
    }

    if (opts?.refspec) {
      const refspecs = Array.isArray(opts.refspec) ? opts.refspec : [opts.refspec];
      args.push(...refspecs);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });
  }

  /**
   * Push to remote
   */
  public async push(opts?: PushOpts & ExecOpts): Promise<void> {
    const args = ['push'];

    if (opts?.onProgress) {
      args.push('--progress');
    }

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.tags) {
      args.push('--tags');
    }

    if (opts?.setUpstream) {
      args.push('--set-upstream');
    }

    if (opts?.remote) {
      args.push(opts.remote);
    }

    if (opts?.refspec) {
      const refspecs = Array.isArray(opts.refspec) ? opts.refspec : [opts.refspec];
      args.push(...refspecs);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });
  }
}

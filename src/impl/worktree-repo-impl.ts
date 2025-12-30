/**
 * WorktreeRepo implementation - repository with working directory
 */

import type {
  ExecOpts,
  RawResult,
  GitOpenOptions,
  LfsMode,
  ExecutionContext,
} from '../core/types.js';
import type {
  WorktreeRepo,
  StatusOpts,
  StatusPorcelain,
  StatusEntry,
  LogOpts,
  Commit,
  FetchOpts,
  PushOpts,
  LfsOperations,
  LfsPullOpts,
  LfsPushOpts,
  LfsStatusOpts,
  LfsStatus,
  WorktreeOperations,
  Worktree,
  WorktreeAddOpts,
  WorktreeRemoveOpts,
  WorktreePruneOpts,
  WorktreeLockOpts,
} from '../core/repo.js';
import { CliRunner } from '../runner/cli-runner.js';
import {
  parsePorcelainV2,
  parseGitLog,
  GIT_LOG_FORMAT,
  parseWorktreeList,
  parseLines,
} from '../parsers/index.js';

/**
 * WorktreeRepo implementation
 */
export class WorktreeRepoImpl implements WorktreeRepo {
  readonly workdir: string;
  private readonly runner: CliRunner;
  private _lfsMode: LfsMode = 'enabled';

  readonly lfs: LfsOperations;
  readonly worktree: WorktreeOperations;

  constructor(runner: CliRunner, workdir: string, options?: GitOpenOptions) {
    this.runner = runner;
    this.workdir = workdir;

    if (options?.lfs) {
      this._lfsMode = options.lfs;
    }

    // Initialize LFS operations
    this.lfs = {
      pull: this.lfsPull.bind(this),
      push: this.lfsPush.bind(this),
      status: this.lfsStatus.bind(this),
    };

    // Initialize worktree operations
    this.worktree = {
      list: this.worktreeList.bind(this),
      add: this.worktreeAdd.bind(this),
      remove: this.worktreeRemove.bind(this),
      prune: this.worktreePrune.bind(this),
      lock: this.worktreeLock.bind(this),
      unlock: this.worktreeUnlock.bind(this),
    };
  }

  private get context(): ExecutionContext {
    return { type: 'worktree', workdir: this.workdir };
  }

  /**
   * Execute a raw git command in this repository context
   */
  async raw(argv: string[], opts?: ExecOpts): Promise<RawResult> {
    return this.runner.run(this.context, argv, opts);
  }

  /**
   * Get repository status
   */
  async status(opts?: StatusOpts & ExecOpts): Promise<StatusPorcelain> {
    const args = ['status', '--porcelain=v2'];

    if (opts?.untracked) {
      switch (opts.untracked) {
        case 'no':
          args.push('-uno');
          break;
        case 'normal':
          args.push('-unormal');
          break;
        case 'all':
          args.push('-uall');
          break;
      }
    }

    // Add branch info
    args.push('--branch');

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    return this.parseStatus(result.stdout);
  }

  private parseStatus(stdout: string): StatusPorcelain {
    const lines = parseLines(stdout);
    const entries: StatusEntry[] = [];
    let branch: string | undefined;
    let upstream: string | undefined;
    let ahead: number | undefined;
    let behind: number | undefined;

    for (const line of lines) {
      if (line.startsWith('# branch.head ')) {
        branch = line.slice('# branch.head '.length);
      } else if (line.startsWith('# branch.upstream ')) {
        upstream = line.slice('# branch.upstream '.length);
      } else if (line.startsWith('# branch.ab ')) {
        const match = line.match(/# branch\.ab \+(\d+) -(\d+)/);
        if (match) {
          ahead = parseInt(match[1]!, 10);
          behind = parseInt(match[2]!, 10);
        }
      } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
        // Regular or renamed entry
        const parsed = parsePorcelainV2(line);
        if (parsed.length > 0 && parsed[0]!.type === 'changed') {
          const entry = parsed[0]!;
          entries.push({
            path: entry.path,
            index: entry.xy[0]!,
            workdir: entry.xy[1]!,
            originalPath: entry.origPath,
          });
        }
      } else if (line.startsWith('u ')) {
        // Unmerged entry
        const parsed = parsePorcelainV2(line);
        if (parsed.length > 0 && parsed[0]!.type === 'unmerged') {
          const entry = parsed[0]!;
          entries.push({
            path: entry.path,
            index: entry.xy[0]!,
            workdir: entry.xy[1]!,
          });
        }
      } else if (line.startsWith('? ')) {
        // Untracked
        entries.push({
          path: line.slice(2),
          index: '?',
          workdir: '?',
        });
      } else if (line.startsWith('! ')) {
        // Ignored
        entries.push({
          path: line.slice(2),
          index: '!',
          workdir: '!',
        });
      }
    }

    return {
      entries,
      branch,
      upstream,
      ahead,
      behind,
    };
  }

  /**
   * Get commit log
   */
  async log(opts?: LogOpts & ExecOpts): Promise<Commit[]> {
    const args = ['log', `--format=${GIT_LOG_FORMAT}`];

    if (opts?.maxCount !== undefined) {
      args.push(`-n${opts.maxCount}`);
    }

    if (opts?.skip !== undefined) {
      args.push(`--skip=${opts.skip}`);
    }

    if (opts?.since) {
      const since = opts.since instanceof Date ? opts.since.toISOString() : opts.since;
      args.push(`--since=${since}`);
    }

    if (opts?.until) {
      const until = opts.until instanceof Date ? opts.until.toISOString() : opts.until;
      args.push(`--until=${until}`);
    }

    if (opts?.author) {
      args.push(`--author=${opts.author}`);
    }

    if (opts?.grep) {
      args.push(`--grep=${opts.grep}`);
    }

    if (opts?.all) {
      args.push('--all');
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    const parsed = parseGitLog(result.stdout);

    return parsed.map((p) => ({
      hash: p.hash,
      abbrevHash: p.abbrevHash,
      parents: p.parents,
      author: {
        name: p.authorName,
        email: p.authorEmail,
        timestamp: p.authorTimestamp,
      },
      committer: {
        name: p.committerName,
        email: p.committerEmail,
        timestamp: p.committerTimestamp,
      },
      subject: p.subject,
      body: p.body,
    }));
  }

  /**
   * Fetch from remote
   */
  async fetch(opts?: FetchOpts & ExecOpts): Promise<void> {
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
  async push(opts?: PushOpts & ExecOpts): Promise<void> {
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

  /**
   * Configure LFS mode for this repository
   */
  setLfsMode(mode: LfsMode): void {
    this._lfsMode = mode;
  }

  // ==========================================================================
  // LFS Operations
  // ==========================================================================

  private async lfsPull(opts?: LfsPullOpts & ExecOpts): Promise<void> {
    if (this._lfsMode === 'disabled') {
      return;
    }

    const args = ['lfs', 'pull'];

    if (opts?.remote) {
      args.push(opts.remote);
    }

    if (opts?.ref) {
      args.push(opts.ref);
    }

    if (opts?.include && opts.include.length > 0) {
      args.push('--include', opts.include.join(','));
    }

    if (opts?.exclude && opts.exclude.length > 0) {
      args.push('--exclude', opts.exclude.join(','));
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });
  }

  private async lfsPush(opts?: LfsPushOpts & ExecOpts): Promise<void> {
    if (this._lfsMode === 'disabled') {
      return;
    }

    const args = ['lfs', 'push', '--all'];

    if (opts?.remote) {
      args.push(opts.remote);
    } else {
      args.push('origin');
    }

    if (opts?.ref) {
      args.push(opts.ref);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });
  }

  private async lfsStatus(opts?: LfsStatusOpts & ExecOpts): Promise<LfsStatus> {
    const args = ['lfs', 'status'];

    if (opts?.json) {
      args.push('--json');
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    // Parse LFS status output
    // For now, return a simplified version
    const files: LfsStatus['files'] = [];

    if (opts?.json) {
      try {
        const json = JSON.parse(result.stdout);
        // Process JSON output
        if (json.files) {
          for (const [name, info] of Object.entries(json.files as Record<string, unknown>)) {
            files.push({
              name,
              size: (info as { size?: number }).size ?? 0,
              status: 'unknown',
            });
          }
        }
      } catch {
        // Fallback to text parsing
      }
    }

    return { files };
  }

  // ==========================================================================
  // Worktree Operations
  // ==========================================================================

  private async worktreeList(opts?: ExecOpts): Promise<Worktree[]> {
    const result = await this.runner.runOrThrow(this.context, ['worktree', 'list', '--porcelain'], {
      signal: opts?.signal,
    });

    return parseWorktreeList(result.stdout);
  }

  private async worktreeAdd(
    path: string,
    opts?: WorktreeAddOpts & ExecOpts,
  ): Promise<void> {
    const args = ['worktree', 'add'];

    if (opts?.detach) {
      args.push('--detach');
    }

    if (opts?.track) {
      args.push('--track');
    }

    args.push(path);

    if (opts?.branch) {
      if (!opts.detach) {
        args.push('-b', opts.branch);
      }
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });
  }

  private async worktreeRemove(
    path: string,
    opts?: WorktreeRemoveOpts & ExecOpts,
  ): Promise<void> {
    const args = ['worktree', 'remove'];

    if (opts?.force) {
      args.push('--force');
    }

    args.push(path);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async worktreePrune(opts?: WorktreePruneOpts & ExecOpts): Promise<string[]> {
    const args = ['worktree', 'prune'];

    if (opts?.dryRun) {
      args.push('--dry-run');
    }

    if (opts?.verbose) {
      args.push('--verbose');
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    // Parse pruned paths from output
    return parseLines(result.stdout);
  }

  private async worktreeLock(
    path: string,
    opts?: WorktreeLockOpts & ExecOpts,
  ): Promise<void> {
    const args = ['worktree', 'lock'];

    if (opts?.reason) {
      args.push('--reason', opts.reason);
    }

    args.push(path);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async worktreeUnlock(path: string, opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow(this.context, ['worktree', 'unlock', path], {
      signal: opts?.signal,
    });
  }
}

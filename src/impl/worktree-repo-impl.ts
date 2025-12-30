/**
 * WorktreeRepo implementation - repository with working directory
 */

import type {
  // High-level API types
  AddOpts,
  BranchCreateOpts,
  BranchDeleteOpts,
  BranchInfo,
  BranchOperations,
  BranchOpts,
  CheckoutOpts,
  // Medium priority types
  CherryPickOpts,
  CleanOpts,
  Commit,
  CommitOpts,
  CommitResult,
  DiffEntry,
  DiffOpts,
  DiffResult,
  FetchOpts,
  LfsOperations,
  LfsPullOpts,
  LfsPushOpts,
  LfsStatus,
  LfsStatusOpts,
  LogOpts,
  MergeOpts,
  MergeResult,
  MvOpts,
  PullOpts,
  PushOpts,
  RebaseOpts,
  ResetOpts,
  RestoreOpts,
  RevertOpts,
  RmOpts,
  ShowOpts,
  StashApplyOpts,
  StashEntry,
  StashOperations,
  StashPushOpts,
  StatusEntry,
  StatusOpts,
  StatusPorcelain,
  SubmoduleInfo,
  SubmoduleOperations,
  SubmoduleOpts,
  SwitchOpts,
  TagCreateOpts,
  TagInfo,
  TagListOpts,
  TagOperations,
  Worktree,
  WorktreeAddOpts,
  WorktreeLockOpts,
  WorktreeOperations,
  WorktreePruneOpts,
  WorktreeRemoveOpts,
  WorktreeRepo,
} from '../core/repo.js';
import type {
  ExecOpts,
  ExecutionContext,
  GitOpenOptions,
  LfsMode,
  RawResult,
} from '../core/types.js';
import {
  GIT_LOG_FORMAT,
  parseGitLog,
  parseLines,
  parsePorcelainV2,
  parseWorktreeList,
} from '../parsers/index.js';
import type { CliRunner } from '../runner/cli-runner.js';

/**
 * WorktreeRepo implementation
 */
export class WorktreeRepoImpl implements WorktreeRepo {
  readonly workdir: string;
  private readonly runner: CliRunner;
  private _lfsMode: LfsMode = 'enabled';

  readonly lfs: LfsOperations;
  readonly worktree: WorktreeOperations;
  readonly branch: BranchOperations;
  readonly stash: StashOperations;
  readonly tag: TagOperations;
  readonly submodule: SubmoduleOperations;

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

    // Initialize branch operations
    this.branch = {
      list: this.branchList.bind(this),
      current: this.branchCurrent.bind(this),
      create: this.branchCreate.bind(this),
      delete: this.branchDelete.bind(this),
      rename: this.branchRename.bind(this),
    };

    // Initialize stash operations
    this.stash = {
      list: this.stashList.bind(this),
      push: this.stashPush.bind(this),
      pop: this.stashPop.bind(this),
      apply: this.stashApply.bind(this),
      drop: this.stashDrop.bind(this),
      clear: this.stashClear.bind(this),
    };

    // Initialize tag operations
    this.tag = {
      list: this.tagList.bind(this),
      create: this.tagCreate.bind(this),
      delete: this.tagDelete.bind(this),
      show: this.tagShow.bind(this),
    };

    // Initialize submodule operations
    this.submodule = {
      list: this.submoduleList.bind(this),
      init: this.submoduleInit.bind(this),
      update: this.submoduleUpdate.bind(this),
      add: this.submoduleAdd.bind(this),
      deinit: this.submoduleDeinit.bind(this),
    };
  }

  private get context(): ExecutionContext {
    return { type: 'worktree', workdir: this.workdir };
  }

  /**
   * Execute a raw git command in this repository context
   */
  async raw(argv: Array<string>, opts?: ExecOpts): Promise<RawResult> {
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
    const entries: Array<StatusEntry> = [];
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
          ahead = Number.parseInt(match[1]!, 10);
          behind = Number.parseInt(match[2]!, 10);
        }
      } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
        // Regular or renamed entry
        const parsed = parsePorcelainV2(line);
        if (parsed.length > 0 && parsed[0]?.type === 'changed') {
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
        if (parsed.length > 0 && parsed[0]?.type === 'unmerged') {
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
  async log(opts?: LogOpts & ExecOpts): Promise<Array<Commit>> {
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

  private async worktreeList(opts?: ExecOpts): Promise<Array<Worktree>> {
    const result = await this.runner.runOrThrow(this.context, ['worktree', 'list', '--porcelain'], {
      signal: opts?.signal,
    });

    return parseWorktreeList(result.stdout);
  }

  private async worktreeAdd(path: string, opts?: WorktreeAddOpts & ExecOpts): Promise<void> {
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

  private async worktreeRemove(path: string, opts?: WorktreeRemoveOpts & ExecOpts): Promise<void> {
    const args = ['worktree', 'remove'];

    if (opts?.force) {
      args.push('--force');
    }

    args.push(path);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async worktreePrune(opts?: WorktreePruneOpts & ExecOpts): Promise<Array<string>> {
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

  private async worktreeLock(path: string, opts?: WorktreeLockOpts & ExecOpts): Promise<void> {
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

  // ==========================================================================
  // High-level API - add
  // ==========================================================================

  async add(paths: string | Array<string>, opts?: AddOpts & ExecOpts): Promise<void> {
    const args = ['add'];

    if (opts?.all) {
      args.push('--all');
    }

    if (opts?.dryRun) {
      args.push('--dry-run');
    }

    if (opts?.update) {
      args.push('--update');
    }

    if (opts?.force) {
      args.push('--force');
    }

    const pathList = Array.isArray(paths) ? paths : [paths];
    args.push('--', ...pathList);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // High-level API - Branch Operations
  // ==========================================================================

  private async branchList(opts?: BranchOpts & ExecOpts): Promise<Array<BranchInfo>> {
    const args = [
      'branch',
      '--list',
      '--format=%(refname:short)%00%(objectname:short)%00%(upstream:short)%00%(upstream:track,nobracket)%00%(HEAD)',
    ];

    if (opts?.all) {
      args.push('--all');
    }

    if (opts?.remotes) {
      args.push('--remotes');
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    const branches: Array<BranchInfo> = [];
    for (const line of parseLines(result.stdout)) {
      const parts = line.split('\0');
      if (parts.length >= 5) {
        const [name, commit, upstream, trackInfo, head] = parts;
        branches.push({
          name: name!,
          commit: commit!,
          current: head === '*',
          upstream: upstream || undefined,
          gone: trackInfo?.includes('gone'),
        });
      }
    }

    return branches;
  }

  private async branchCurrent(opts?: ExecOpts): Promise<string | null> {
    const result = await this.runner.run(this.context, ['symbolic-ref', '--short', 'HEAD'], {
      signal: opts?.signal,
    });

    if (result.exitCode !== 0) {
      // Detached HEAD
      return null;
    }

    return result.stdout.trim();
  }

  private async branchCreate(name: string, opts?: BranchCreateOpts & ExecOpts): Promise<void> {
    const args = ['branch'];

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.track) {
      args.push('--track');
    }

    args.push(name);

    if (opts?.startPoint) {
      args.push(opts.startPoint);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async branchDelete(name: string, opts?: BranchDeleteOpts & ExecOpts): Promise<void> {
    const args = ['branch'];

    if (opts?.remote) {
      args.push('-r');
    }

    if (opts?.force) {
      args.push('-D');
    } else {
      args.push('-d');
    }

    args.push(name);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async branchRename(oldName: string, newName: string, opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow(this.context, ['branch', '-m', oldName, newName], {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // High-level API - checkout
  // ==========================================================================

  async checkout(target: string, opts?: CheckoutOpts & ExecOpts): Promise<void> {
    const args = ['checkout'];

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.createBranch) {
      args.push('-b');
    }

    if (opts?.track) {
      args.push('--track');
    }

    args.push(target);

    if (opts?.startPoint) {
      args.push(opts.startPoint);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // High-level API - commit
  // ==========================================================================

  async commit(opts?: CommitOpts & ExecOpts): Promise<CommitResult> {
    const args = ['commit'];

    if (opts?.message) {
      args.push('-m', opts.message);
    }

    if (opts?.allowEmpty) {
      args.push('--allow-empty');
    }

    if (opts?.amend) {
      args.push('--amend');
    }

    if (opts?.all) {
      args.push('-a');
    }

    if (opts?.author) {
      args.push('--author', opts.author);
    }

    if (opts?.date) {
      const date = opts.date instanceof Date ? opts.date.toISOString() : opts.date;
      args.push('--date', date);
    }

    if (opts?.dryRun) {
      args.push('--dry-run');
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    // Parse commit output
    const output = result.stdout;
    let hash = '';
    let branch = '';
    let summary = '';
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;

    // Get the commit hash
    const hashResult = await this.runner.runOrThrow(this.context, ['rev-parse', 'HEAD'], {
      signal: opts?.signal,
    });
    hash = hashResult.stdout.trim();

    // Get the branch name
    const branchResult = await this.runner.run(this.context, ['symbolic-ref', '--short', 'HEAD'], {
      signal: opts?.signal,
    });
    branch = branchResult.exitCode === 0 ? branchResult.stdout.trim() : 'HEAD';

    // Parse stats from output if available
    const statsMatch = output.match(
      /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/,
    );
    if (statsMatch) {
      filesChanged = Number.parseInt(statsMatch[1] || '0', 10);
      insertions = Number.parseInt(statsMatch[2] || '0', 10);
      deletions = Number.parseInt(statsMatch[3] || '0', 10);
    }

    // Get subject from log
    const logResult = await this.runner.runOrThrow(this.context, ['log', '-1', '--format=%s'], {
      signal: opts?.signal,
    });
    summary = logResult.stdout.trim();

    return {
      hash,
      branch,
      summary,
      filesChanged,
      insertions,
      deletions,
    };
  }

  // ==========================================================================
  // High-level API - diff
  // ==========================================================================

  async diff(target?: string, opts?: DiffOpts & ExecOpts): Promise<DiffResult> {
    const args = ['diff'];

    if (opts?.staged) {
      args.push('--staged');
    }

    if (opts?.nameOnly) {
      args.push('--name-only');
    } else if (opts?.nameStatus) {
      args.push('--name-status');
    } else if (opts?.stat) {
      args.push('--stat');
    }

    if (opts?.context !== undefined) {
      args.push(`-U${opts.context}`);
    }

    if (opts?.ignoreWhitespace) {
      args.push('-w');
    }

    if (target) {
      args.push(target);
    }

    if (opts?.paths && opts.paths.length > 0) {
      args.push('--', ...opts.paths);
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    const files: Array<DiffEntry> = [];

    if (opts?.nameStatus) {
      for (const line of parseLines(result.stdout)) {
        const match = line.match(/^([AMDRTCUX])\t(.+?)(?:\t(.+))?$/);
        if (match) {
          const entry: DiffEntry = {
            status: match[1] as DiffEntry['status'],
            path: match[3] || match[2]!,
          };
          if (match[3]) {
            entry.oldPath = match[2];
          }
          files.push(entry);
        }
      }
    } else if (opts?.nameOnly) {
      for (const line of parseLines(result.stdout)) {
        files.push({
          path: line,
          status: 'M', // Default to modified for name-only
        });
      }
    }

    return {
      files,
      raw: opts?.nameOnly || opts?.nameStatus ? undefined : result.stdout,
    };
  }

  // ==========================================================================
  // High-level API - merge
  // ==========================================================================

  async merge(branch: string, opts?: MergeOpts & ExecOpts): Promise<MergeResult> {
    if (opts?.abort) {
      await this.runner.runOrThrow(this.context, ['merge', '--abort'], {
        signal: opts?.signal,
      });
      return { success: true };
    }

    if (opts?.continue) {
      await this.runner.runOrThrow(this.context, ['merge', '--continue'], {
        signal: opts?.signal,
      });
      const hash = (
        await this.runner.runOrThrow(this.context, ['rev-parse', 'HEAD'])
      ).stdout.trim();
      return { success: true, hash };
    }

    const args = ['merge'];

    if (opts?.message) {
      args.push('-m', opts.message);
    }

    if (opts?.ff === 'only') {
      args.push('--ff-only');
    } else if (opts?.ff === 'no' || opts?.ff === false) {
      args.push('--no-ff');
    }

    if (opts?.squash) {
      args.push('--squash');
    }

    if (opts?.noCommit) {
      args.push('--no-commit');
    }

    if (opts?.strategy) {
      args.push('-s', opts.strategy);
    }

    if (opts?.strategyOption) {
      const strategyOpts = Array.isArray(opts.strategyOption)
        ? opts.strategyOption
        : [opts.strategyOption];
      for (const opt of strategyOpts) {
        args.push('-X', opt);
      }
    }

    args.push(branch);

    const result = await this.runner.run(this.context, args, {
      signal: opts?.signal,
    });

    if (result.exitCode !== 0) {
      // Check for conflicts
      const statusResult = await this.runner.runOrThrow(this.context, ['status', '--porcelain'], {
        signal: opts?.signal,
      });
      const conflicts = parseLines(statusResult.stdout)
        .filter(
          (line) => line.startsWith('UU ') || line.startsWith('AA ') || line.startsWith('DD '),
        )
        .map((line) => line.slice(3));

      return {
        success: false,
        conflicts,
      };
    }

    // Get the new HEAD
    const hashResult = await this.runner.runOrThrow(this.context, ['rev-parse', 'HEAD'], {
      signal: opts?.signal,
    });

    // Check if it was a fast-forward
    const fastForward =
      result.stdout.includes('Fast-forward') || result.stderr.includes('Fast-forward');

    return {
      success: true,
      hash: hashResult.stdout.trim(),
      fastForward,
    };
  }

  // ==========================================================================
  // High-level API - pull
  // ==========================================================================

  async pull(opts?: PullOpts & ExecOpts): Promise<void> {
    const args = ['pull'];

    if (opts?.onProgress) {
      args.push('--progress');
    }

    if (opts?.rebase === true) {
      args.push('--rebase');
    } else if (opts?.rebase === 'merges') {
      args.push('--rebase=merges');
    } else if (opts?.rebase === 'interactive') {
      args.push('--rebase=interactive');
    }

    if (opts?.ff === 'only') {
      args.push('--ff-only');
    } else if (opts?.ff === 'no' || opts?.ff === false) {
      args.push('--no-ff');
    }

    if (opts?.tags) {
      args.push('--tags');
    }

    if (opts?.prune) {
      args.push('--prune');
    }

    if (opts?.remote) {
      args.push(opts.remote);
    }

    if (opts?.branch) {
      args.push(opts.branch);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });
  }

  // ==========================================================================
  // High-level API - reset
  // ==========================================================================

  async reset(target?: string, opts?: ResetOpts & ExecOpts): Promise<void> {
    const args = ['reset'];

    if (opts?.mode) {
      args.push(`--${opts.mode}`);
    }

    if (target) {
      args.push(target);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // High-level API - rm
  // ==========================================================================

  async rm(paths: string | Array<string>, opts?: RmOpts & ExecOpts): Promise<void> {
    const args = ['rm'];

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.cached) {
      args.push('--cached');
    }

    if (opts?.recursive) {
      args.push('-r');
    }

    if (opts?.dryRun) {
      args.push('--dry-run');
    }

    const pathList = Array.isArray(paths) ? paths : [paths];
    args.push('--', ...pathList);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // High-level API - Stash Operations
  // ==========================================================================

  private async stashList(opts?: ExecOpts): Promise<Array<StashEntry>> {
    const result = await this.runner.runOrThrow(this.context, ['stash', 'list'], {
      signal: opts?.signal,
    });

    const entries: Array<StashEntry> = [];
    for (const line of parseLines(result.stdout)) {
      // Default format: stash@{0}: On branch: message
      // Or: stash@{0}: WIP on branch: hash (when using -m)
      const match = line.match(/^stash@\{(\d+)\}:\s*(?:On\s+)?(.+?):\s*(.+)$/);
      if (match) {
        const [, indexStr, branchOrContext, message] = match;
        // Check if branchOrContext includes "WIP on" format
        const wipMatch = branchOrContext?.match(/^WIP on (.+)$/);
        entries.push({
          index: Number.parseInt(indexStr!, 10),
          message: message!,
          branch: wipMatch ? wipMatch[1] : branchOrContext,
          commit: '', // We'd need another command to get the commit hash
        });
      }
    }

    // Get commit hashes if entries were found
    if (entries.length > 0) {
      for (const entry of entries) {
        try {
          const hashResult = await this.runner.runOrThrow(
            this.context,
            ['rev-parse', `stash@{${entry.index}}`],
            { signal: opts?.signal },
          );
          entry.commit = hashResult.stdout.trim();
        } catch {
          // Ignore errors getting commit hash
        }
      }
    }

    return entries;
  }

  private async stashPush(opts?: StashPushOpts & ExecOpts): Promise<void> {
    const args = ['stash', 'push'];

    if (opts?.message) {
      args.push('-m', opts.message);
    }

    if (opts?.includeUntracked) {
      args.push('--include-untracked');
    }

    if (opts?.keepIndex) {
      args.push('--keep-index');
    }

    if (opts?.paths && opts.paths.length > 0) {
      args.push('--', ...opts.paths);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async stashPop(opts?: StashApplyOpts & ExecOpts): Promise<void> {
    const args = ['stash', 'pop'];

    if (opts?.reinstateIndex) {
      args.push('--index');
    }

    if (opts?.index !== undefined) {
      args.push(`stash@{${opts.index}}`);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async stashApply(opts?: StashApplyOpts & ExecOpts): Promise<void> {
    const args = ['stash', 'apply'];

    if (opts?.reinstateIndex) {
      args.push('--index');
    }

    if (opts?.index !== undefined) {
      args.push(`stash@{${opts.index}}`);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async stashDrop(index?: number, opts?: ExecOpts): Promise<void> {
    const args = ['stash', 'drop'];

    if (index !== undefined) {
      args.push(`stash@{${index}}`);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async stashClear(opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow(this.context, ['stash', 'clear'], {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // High-level API - switch
  // ==========================================================================

  async switch(branch: string, opts?: SwitchOpts & ExecOpts): Promise<void> {
    const args = ['switch'];

    if (opts?.create) {
      args.push('-c');
    } else if (opts?.forceCreate) {
      args.push('-C');
    }

    if (opts?.discard) {
      args.push('--discard-changes');
    }

    if (opts?.track) {
      args.push('--track');
    }

    if (opts?.detach) {
      args.push('--detach');
    }

    args.push(branch);

    if (opts?.startPoint) {
      args.push(opts.startPoint);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // High-level API - Tag Operations
  // ==========================================================================

  private async tagList(opts?: TagListOpts & ExecOpts): Promise<Array<string>> {
    const args = ['tag', '--list'];

    if (opts?.sort) {
      args.push(`--sort=${opts.sort}`);
    }

    if (opts?.pattern) {
      args.push(opts.pattern);
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    return parseLines(result.stdout);
  }

  private async tagCreate(name: string, opts?: TagCreateOpts & ExecOpts): Promise<void> {
    const args = ['tag'];

    if (opts?.message) {
      args.push('-a', '-m', opts.message);
    }

    if (opts?.force) {
      args.push('--force');
    }

    args.push(name);

    if (opts?.commit) {
      args.push(opts.commit);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async tagDelete(name: string, opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow(this.context, ['tag', '-d', name], {
      signal: opts?.signal,
    });
  }

  private async tagShow(name: string, opts?: ExecOpts): Promise<TagInfo> {
    // Try to get tag info using cat-file
    const typeResult = await this.runner.runOrThrow(this.context, ['cat-file', '-t', name], {
      signal: opts?.signal,
    });

    const isAnnotated = typeResult.stdout.trim() === 'tag';

    if (isAnnotated) {
      const result = await this.runner.runOrThrow(this.context, ['cat-file', 'tag', name], {
        signal: opts?.signal,
      });

      const lines = result.stdout.split('\n');
      let commit = '';
      let taggerName = '';
      let taggerEmail = '';
      let taggerDate: Date | undefined;
      const messageLines: Array<string> = [];
      let inMessage = false;

      for (const line of lines) {
        if (line.startsWith('object ')) {
          commit = line.slice(7);
        } else if (line.startsWith('tagger ')) {
          const match = line.match(/^tagger (.+?) <(.+?)> (\d+)/);
          if (match) {
            taggerName = match[1]!;
            taggerEmail = match[2]!;
            taggerDate = new Date(Number.parseInt(match[3]!, 10) * 1000);
          }
        } else if (line === '') {
          inMessage = true;
        } else if (inMessage) {
          messageLines.push(line);
        }
      }

      return {
        name,
        commit,
        annotated: true,
        message: messageLines.join('\n').trim() || undefined,
        tagger: taggerName
          ? {
              name: taggerName,
              email: taggerEmail,
              date: taggerDate!,
            }
          : undefined,
      };
    } else {
      // Lightweight tag - get the commit it points to
      const result = await this.runner.runOrThrow(this.context, ['rev-parse', name], {
        signal: opts?.signal,
      });

      return {
        name,
        commit: result.stdout.trim(),
        annotated: false,
      };
    }
  }

  // ==========================================================================
  // Medium Priority - cherry-pick
  // ==========================================================================

  async cherryPick(
    commits: string | Array<string>,
    opts?: CherryPickOpts & ExecOpts,
  ): Promise<void> {
    if (opts?.abort) {
      await this.runner.runOrThrow(this.context, ['cherry-pick', '--abort'], {
        signal: opts?.signal,
      });
      return;
    }

    if (opts?.continue) {
      await this.runner.runOrThrow(this.context, ['cherry-pick', '--continue'], {
        signal: opts?.signal,
      });
      return;
    }

    if (opts?.skip) {
      await this.runner.runOrThrow(this.context, ['cherry-pick', '--skip'], {
        signal: opts?.signal,
      });
      return;
    }

    const args = ['cherry-pick'];

    if (opts?.edit) {
      args.push('-e');
    }

    if (opts?.noCommit) {
      args.push('-n');
    }

    if (opts?.signoff) {
      args.push('-s');
    }

    if (opts?.mainline !== undefined) {
      args.push('-m', opts.mainline.toString());
    }

    if (opts?.strategy) {
      args.push('-s', opts.strategy);
    }

    const commitList = Array.isArray(commits) ? commits : [commits];
    args.push(...commitList);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // Medium Priority - clean
  // ==========================================================================

  async clean(opts?: CleanOpts & ExecOpts): Promise<Array<string>> {
    const args = ['clean'];

    if (opts?.force) {
      args.push('-f');
    }

    if (opts?.directories) {
      args.push('-d');
    }

    if (opts?.ignored) {
      args.push('-x');
    } else if (opts?.onlyIgnored) {
      args.push('-X');
    }

    if (opts?.dryRun) {
      args.push('-n');
    }

    if (opts?.paths && opts.paths.length > 0) {
      args.push('--', ...opts.paths);
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    // Parse cleaned/would-be-cleaned paths from output
    const cleaned: Array<string> = [];
    for (const line of parseLines(result.stdout)) {
      // Output is like "Removing file.txt" or "Would remove file.txt"
      const match = line.match(/^(?:Removing|Would remove) (.+)$/);
      if (match) {
        cleaned.push(match[1]!);
      }
    }

    return cleaned;
  }

  // ==========================================================================
  // Medium Priority - mv
  // ==========================================================================

  async mv(source: string, destination: string, opts?: MvOpts & ExecOpts): Promise<void> {
    const args = ['mv'];

    if (opts?.force) {
      args.push('-f');
    }

    if (opts?.dryRun) {
      args.push('-n');
    }

    args.push(source, destination);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // Medium Priority - rebase
  // ==========================================================================

  async rebase(opts?: RebaseOpts & ExecOpts): Promise<void> {
    if (opts?.abort) {
      await this.runner.runOrThrow(this.context, ['rebase', '--abort'], {
        signal: opts?.signal,
      });
      return;
    }

    if (opts?.continue) {
      await this.runner.runOrThrow(this.context, ['rebase', '--continue'], {
        signal: opts?.signal,
      });
      return;
    }

    if (opts?.skip) {
      await this.runner.runOrThrow(this.context, ['rebase', '--skip'], {
        signal: opts?.signal,
      });
      return;
    }

    const args = ['rebase'];

    if (opts?.onto) {
      args.push('--onto', opts.onto);
    }

    if (opts?.rebaseMerges) {
      args.push('--rebase-merges');
    }

    if (opts?.upstream) {
      args.push(opts.upstream);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // Medium Priority - restore
  // ==========================================================================

  async restore(paths: string | Array<string>, opts?: RestoreOpts & ExecOpts): Promise<void> {
    const args = ['restore'];

    if (opts?.staged) {
      args.push('--staged');
    }

    if (opts?.worktree) {
      args.push('--worktree');
    }

    if (opts?.source) {
      args.push('--source', opts.source);
    }

    if (opts?.ours) {
      args.push('--ours');
    } else if (opts?.theirs) {
      args.push('--theirs');
    }

    const pathList = Array.isArray(paths) ? paths : [paths];
    args.push('--', ...pathList);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // Medium Priority - revert
  // ==========================================================================

  async revert(commits: string | Array<string>, opts?: RevertOpts & ExecOpts): Promise<void> {
    if (opts?.abort) {
      await this.runner.runOrThrow(this.context, ['revert', '--abort'], {
        signal: opts?.signal,
      });
      return;
    }

    if (opts?.continue) {
      await this.runner.runOrThrow(this.context, ['revert', '--continue'], {
        signal: opts?.signal,
      });
      return;
    }

    if (opts?.skip) {
      await this.runner.runOrThrow(this.context, ['revert', '--skip'], {
        signal: opts?.signal,
      });
      return;
    }

    const args = ['revert'];

    if (opts?.edit) {
      args.push('-e');
    }

    if (opts?.noCommit) {
      args.push('-n');
    }

    if (opts?.mainline !== undefined) {
      args.push('-m', opts.mainline.toString());
    }

    const commitList = Array.isArray(commits) ? commits : [commits];
    args.push(...commitList);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // Medium Priority - show
  // ==========================================================================

  async show(object: string, opts?: ShowOpts & ExecOpts): Promise<string> {
    const args = ['show'];

    if (opts?.stat) {
      args.push('--stat');
    }

    if (opts?.nameOnly) {
      args.push('--name-only');
    } else if (opts?.nameStatus) {
      args.push('--name-status');
    }

    if (opts?.format) {
      args.push(`--format=${opts.format}`);
    }

    args.push(object);

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    return result.stdout;
  }

  // ==========================================================================
  // Medium Priority - Submodule Operations
  // ==========================================================================

  private async submoduleList(opts?: ExecOpts): Promise<Array<SubmoduleInfo>> {
    const result = await this.runner.run(this.context, ['submodule', 'status'], {
      signal: opts?.signal,
    });

    if (result.exitCode !== 0) {
      return [];
    }

    const submodules: Array<SubmoduleInfo> = [];
    for (const line of parseLines(result.stdout)) {
      // Format: [+-U ]<sha1> <path> (<describe>)
      const match = line.match(/^[ +-U]?([a-f0-9]+) (.+?)(?: \((.+)\))?$/);
      if (match) {
        const [, commit, path] = match;
        // Get URL from .gitmodules
        const urlResult = await this.runner.run(
          this.context,
          ['config', '-f', '.gitmodules', '--get', `submodule.${path}.url`],
          { signal: opts?.signal },
        );
        const url = urlResult.exitCode === 0 ? urlResult.stdout.trim() : '';

        // Get branch if configured
        const branchResult = await this.runner.run(
          this.context,
          ['config', '-f', '.gitmodules', '--get', `submodule.${path}.branch`],
          { signal: opts?.signal },
        );
        const branch = branchResult.exitCode === 0 ? branchResult.stdout.trim() : undefined;

        submodules.push({
          name: path!,
          path: path!,
          url,
          branch,
          commit: commit!,
        });
      }
    }

    return submodules;
  }

  private async submoduleInit(paths?: Array<string>, opts?: ExecOpts): Promise<void> {
    const args = ['submodule', 'init'];

    if (paths && paths.length > 0) {
      args.push('--', ...paths);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async submoduleUpdate(opts?: SubmoduleOpts & ExecOpts): Promise<void> {
    const args = ['submodule', 'update'];

    if (opts?.init) {
      args.push('--init');
    }

    if (opts?.recursive) {
      args.push('--recursive');
    }

    if (opts?.remote) {
      args.push('--remote');
    }

    if (opts?.force) {
      args.push('--force');
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async submoduleAdd(url: string, path: string, opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow(this.context, ['submodule', 'add', url, path], {
      signal: opts?.signal,
    });
  }

  private async submoduleDeinit(path: string, opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow(this.context, ['submodule', 'deinit', path], {
      signal: opts?.signal,
    });
  }
}

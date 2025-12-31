/**
 * CLI Backend - Git CLI wrapper implementation of GitBackend
 *
 * This backend wraps the existing CliRunner to implement the GitBackend interface.
 * It provides full Git functionality including LFS support.
 */

import type { RuntimeAdapters } from '../../core/adapters.js';
import type {
  BackendAddOpts,
  BackendBranchCreateOpts,
  BackendCapabilities,
  BackendExecOpts,
  CliBackendOptions,
  GitBackend,
} from '../../core/backend.js';
import type { CloneOpts, InitOpts } from '../../core/git.js';
import type {
  BranchInfo,
  BranchOpts,
  CheckoutBranchOpts,
  CheckoutPathOpts,
  Commit,
  CommitOpts,
  CommitResult,
  DiffEntry,
  DiffOpts,
  DiffResult,
  FetchOpts,
  LogOpts,
  MergeOpts,
  MergeResult,
  PullOpts,
  PushOpts,
  ResetOpts,
  StashApplyOpts,
  StashEntry,
  StashPushOpts,
  StatusEntry,
  StatusOpts,
  StatusPorcelain,
  TagCreateOpts,
  TagListOpts,
} from '../../core/repo.js';
import type { ExecutionContext, RawResult } from '../../core/types.js';
import { parseLines, parsePorcelainV2 } from '../../parsers/index.js';
import { CliRunner, type CliRunnerOptions } from '../../runner/cli-runner.js';

/**
 * Git log format string for parsing commits
 * Fields: hash, abbrevHash, parents, authorName, authorEmail, authorTimestamp,
 *         committerName, committerEmail, committerTimestamp, subject, body
 * Separated by NUL (\x00), records separated by record separator (\x01)
 */
const GIT_LOG_FORMAT = '%H%x00%h%x00%P%x00%an%x00%ae%x00%at%x00%cn%x00%ce%x00%ct%x00%s%x00%b%x01';

/**
 * CLI Backend implementation
 */
export class CliBackend implements GitBackend {
  private readonly runner: CliRunner;

  public constructor(adapters: RuntimeAdapters, options?: CliBackendOptions) {
    const runnerOptions: CliRunnerOptions = {
      gitBinary: options?.gitBinary,
      env: options?.env,
      pathPrefix: options?.pathPrefix,
      home: options?.home,
    };
    this.runner = new CliRunner(adapters, runnerOptions);
  }

  public getCapabilities(): BackendCapabilities {
    return {
      type: 'cli',
      supportsLfs: true,
      supportsProgress: true,
      supportsAbort: true,
      supportsBareRepo: true,
      supportsBrowser: false,
    };
  }

  // ===========================================================================
  // Repository Operations
  // ===========================================================================

  public async checkRepository(path: string): Promise<{ isBare: boolean } | null> {
    const result = await this.runner.run({ type: 'worktree', workdir: path }, [
      'rev-parse',
      '--is-bare-repository',
    ]);

    if (result.exitCode !== 0) {
      // Try as git-dir directly
      const bareResult = await this.runner.run({ type: 'bare', gitDir: path }, [
        'rev-parse',
        '--is-bare-repository',
      ]);

      if (bareResult.exitCode !== 0) {
        return null;
      }

      return { isBare: bareResult.stdout.trim() === 'true' };
    }

    return { isBare: result.stdout.trim() === 'true' };
  }

  public async init(path: string, opts?: InitOpts & BackendExecOpts): Promise<void> {
    const args = ['init'];

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.bare) {
      args.push('--bare');
    }

    if (opts?.template) {
      args.push('--template', opts.template);
    }

    if (opts?.shared !== undefined) {
      if (typeof opts.shared === 'boolean') {
        if (opts.shared) {
          args.push('--shared');
        }
      } else if (typeof opts.shared === 'number') {
        args.push(`--shared=${opts.shared.toString(8)}`);
      } else {
        args.push(`--shared=${opts.shared}`);
      }
    }

    if (opts?.initialBranch) {
      args.push('--initial-branch', opts.initialBranch);
    }

    if (opts?.objectFormat) {
      args.push('--object-format', opts.objectFormat);
    }

    if (opts?.separateGitDir) {
      args.push('--separate-git-dir', opts.separateGitDir);
    }

    args.push(path);

    await this.runOrThrow({ type: 'global' }, args, opts);
  }

  public async clone(url: string, path: string, opts?: CloneOpts & BackendExecOpts): Promise<void> {
    const args = ['clone'];

    if (opts?.onProgress) {
      args.push('--progress');
    }

    if (opts?.verbose) {
      args.push('--verbose');
    }

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.bare) {
      args.push('--bare');
    }

    if (opts?.mirror) {
      args.push('--mirror');
    }

    if (opts?.depth !== undefined) {
      args.push('--depth', String(opts.depth));
    }

    if (opts?.shallowSince) {
      const since =
        opts.shallowSince instanceof Date ? opts.shallowSince.toISOString() : opts.shallowSince;
      args.push('--shallow-since', since);
    }

    if (opts?.shallowExclude) {
      const excludes = Array.isArray(opts.shallowExclude)
        ? opts.shallowExclude
        : [opts.shallowExclude];
      for (const exclude of excludes) {
        args.push('--shallow-exclude', exclude);
      }
    }

    if (opts?.branch) {
      args.push('--branch', opts.branch);
    }

    if (opts?.singleBranch) {
      args.push('--single-branch');
    }

    if (opts?.noCheckout) {
      args.push('--no-checkout');
    }

    if (opts?.recurseSubmodules) {
      args.push('--recurse-submodules');
    }

    if (opts?.jobs !== undefined) {
      args.push('--jobs', String(opts.jobs));
    }

    if (opts?.origin) {
      args.push('--origin', opts.origin);
    }

    args.push(url, path);

    await this.runOrThrow({ type: 'global' }, args, opts);
  }

  // ===========================================================================
  // Repository-Scoped Operations
  // ===========================================================================

  public async status(
    workdir: string,
    opts?: StatusOpts & BackendExecOpts,
  ): Promise<StatusPorcelain> {
    const args = ['status', '--porcelain=v2'];

    if (opts?.verbose) {
      args.push('--verbose');
    }

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

    args.push('--branch');

    if (opts?.showStash) {
      args.push('--show-stash');
    }

    if (opts?.aheadBehind === false) {
      args.push('--no-ahead-behind');
    }

    if (opts?.nullTerminated) {
      args.push('-z');
    }

    if (opts?.ignored) {
      args.push(`--ignored=${opts.ignored}`);
    }

    if (opts?.ignoreSubmodules) {
      args.push(`--ignore-submodules=${opts.ignoreSubmodules}`);
    }

    if (opts?.noRenames) {
      args.push('--no-renames');
    } else if (opts?.findRenames !== undefined) {
      if (opts.findRenames === true) {
        args.push('--find-renames');
      } else if (typeof opts.findRenames === 'number') {
        args.push(`--find-renames=${opts.findRenames}`);
      }
    }

    const result = await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
    return this.parseStatus(result.stdout);
  }

  public async log(workdir: string, opts?: LogOpts & BackendExecOpts): Promise<Commit[]> {
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

    if (opts?.firstParent) {
      args.push('--first-parent');
    }

    if (opts?.noMerges) {
      args.push('--no-merges');
    }

    if (opts?.merges) {
      args.push('--merges');
    }

    if (opts?.reverse) {
      args.push('--reverse');
    }

    const result = await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
    return this.parseLog(result.stdout);
  }

  public async commit(
    workdir: string,
    message: string,
    opts?: CommitOpts & BackendExecOpts,
  ): Promise<CommitResult> {
    const args = ['commit', '-m', message];

    if (opts?.all) {
      args.push('--all');
    }

    if (opts?.amend) {
      args.push('--amend');
    }

    if (opts?.allowEmpty) {
      args.push('--allow-empty');
    }

    if (opts?.allowEmptyMessage) {
      args.push('--allow-empty-message');
    }

    if (opts?.noVerify) {
      args.push('--no-verify');
    }

    if (opts?.author) {
      args.push('--author', opts.author);
    }

    if (opts?.date) {
      const date = opts.date instanceof Date ? opts.date.toISOString() : opts.date;
      args.push('--date', date);
    }

    const context: ExecutionContext = { type: 'worktree', workdir };
    const result = await this.runOrThrow(context, args, opts);

    // Get commit info
    const hashResult = await this.runOrThrow(context, ['rev-parse', 'HEAD'], opts);
    const hash = hashResult.stdout.trim();

    let branch = 'HEAD';
    const branchResult = await this.runner.run(context, ['symbolic-ref', '--short', 'HEAD']);
    if (branchResult.exitCode === 0) {
      branch = branchResult.stdout.trim();
    }

    const subjectResult = await this.runOrThrow(context, ['log', '-1', '--format=%s'], opts);
    const summary = subjectResult.stdout.trim();

    // Parse stats from commit output
    const statsMatch = result.stdout.match(
      /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/,
    );

    return {
      hash,
      branch,
      summary,
      filesChanged: statsMatch?.[1] ? Number.parseInt(statsMatch[1], 10) : 0,
      insertions: statsMatch?.[2] ? Number.parseInt(statsMatch[2], 10) : 0,
      deletions: statsMatch?.[3] ? Number.parseInt(statsMatch[3], 10) : 0,
    };
  }

  public async add(
    workdir: string,
    paths: string[],
    opts?: BackendAddOpts & BackendExecOpts,
  ): Promise<void> {
    const args = ['add'];

    if (opts?.all) {
      args.push('--all');
    }

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.update) {
      args.push('--update');
    }

    args.push(...paths);

    await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
  }

  public async branchList(
    workdir: string,
    opts?: BranchOpts & BackendExecOpts,
  ): Promise<BranchInfo[]> {
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

    if (opts?.contains) {
      args.push('--contains', opts.contains);
    }

    if (opts?.noContains) {
      args.push('--no-contains', opts.noContains);
    }

    if (opts?.merged) {
      args.push('--merged', opts.merged);
    }

    if (opts?.noMerged) {
      args.push('--no-merged', opts.noMerged);
    }

    if (opts?.sort) {
      args.push('--sort', opts.sort);
    }

    const result = await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
    return this.parseBranchList(result.stdout);
  }

  public async branchCreate(
    workdir: string,
    name: string,
    opts?: BackendBranchCreateOpts & BackendExecOpts,
  ): Promise<void> {
    const args = ['branch'];

    if (opts?.force) {
      args.push('--force');
    }

    args.push(name);

    if (opts?.startPoint) {
      args.push(opts.startPoint);
    }

    await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
  }

  // ===========================================================================
  // Raw Operations
  // ===========================================================================

  public async raw(
    context: ExecutionContext,
    argv: string[],
    opts?: BackendExecOpts,
  ): Promise<RawResult> {
    return this.runner.run(context, argv, opts);
  }

  // ===========================================================================
  // Extended Operations (Tier 1 + Tier 2)
  // ===========================================================================

  public async fetch(workdir: string, opts?: FetchOpts & BackendExecOpts): Promise<void> {
    const args = ['fetch'];

    if (opts?.onProgress) {
      args.push('--progress');
    }

    if (opts?.verbose) {
      args.push('--verbose');
    }

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.all) {
      args.push('--all');
    }

    if (opts?.prune) {
      args.push('--prune');
    }

    if (opts?.pruneTags) {
      args.push('--prune-tags');
    }

    if (opts?.tags) {
      args.push('--tags');
    }

    if (opts?.noTags) {
      args.push('--no-tags');
    }

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.depth !== undefined) {
      args.push('--depth', String(opts.depth));
    }

    if (opts?.deepen !== undefined) {
      args.push('--deepen', String(opts.deepen));
    }

    if (opts?.shallowSince) {
      const since =
        opts.shallowSince instanceof Date ? opts.shallowSince.toISOString() : opts.shallowSince;
      args.push('--shallow-since', since);
    }

    if (opts?.unshallow) {
      args.push('--unshallow');
    }

    if (opts?.dryRun) {
      args.push('--dry-run');
    }

    if (opts?.recurseSubmodules) {
      if (typeof opts.recurseSubmodules === 'boolean') {
        if (opts.recurseSubmodules) {
          args.push('--recurse-submodules');
        }
      } else {
        args.push(`--recurse-submodules=${opts.recurseSubmodules}`);
      }
    }

    if (opts?.jobs !== undefined) {
      args.push('--jobs', String(opts.jobs));
    }

    if (opts?.remote) {
      args.push(opts.remote);
    }

    if (opts?.refspec) {
      const refspecs = Array.isArray(opts.refspec) ? opts.refspec : [opts.refspec];
      args.push(...refspecs);
    }

    await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
  }

  public async push(workdir: string, opts?: PushOpts & BackendExecOpts): Promise<void> {
    const args = ['push'];

    if (opts?.onProgress) {
      args.push('--progress');
    }

    if (opts?.verbose) {
      args.push('--verbose');
    }

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.all) {
      args.push('--all');
    }

    if (opts?.mirror) {
      args.push('--mirror');
    }

    if (opts?.tags) {
      args.push('--tags');
    }

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.forceWithLease) {
      if (typeof opts.forceWithLease === 'boolean') {
        args.push('--force-with-lease');
      } else {
        const { refname, expect } = opts.forceWithLease;
        if (expect) {
          args.push(`--force-with-lease=${refname}:${expect}`);
        } else {
          args.push(`--force-with-lease=${refname}`);
        }
      }
    }

    if (opts?.setUpstream) {
      args.push('--set-upstream');
    }

    if (opts?.noVerify) {
      args.push('--no-verify');
    }

    if (opts?.dryRun) {
      args.push('--dry-run');
    }

    if (opts?.deleteRefs) {
      args.push('--delete');
    }

    if (opts?.atomic) {
      args.push('--atomic');
    }

    if (opts?.followTags) {
      args.push('--follow-tags');
    }

    if (opts?.prune) {
      args.push('--prune');
    }

    if (opts?.recurseSubmodules) {
      args.push(`--recurse-submodules=${opts.recurseSubmodules}`);
    }

    if (opts?.pushOption) {
      const pushOptions = Array.isArray(opts.pushOption) ? opts.pushOption : [opts.pushOption];
      for (const option of pushOptions) {
        args.push('--push-option', option);
      }
    }

    if (opts?.remote) {
      args.push(opts.remote);
    }

    if (opts?.refspec) {
      const refspecs = Array.isArray(opts.refspec) ? opts.refspec : [opts.refspec];
      args.push(...refspecs);
    }

    await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
  }

  public async checkout(
    workdir: string,
    target: string,
    opts?: CheckoutBranchOpts & BackendExecOpts,
  ): Promise<void> {
    const args = ['checkout'];

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.createBranch) {
      args.push('-b');
    }

    if (opts?.forceCreateBranch) {
      args.push('-B');
    }

    if (opts?.track) {
      args.push('--track');
    }

    if (opts?.detach) {
      args.push('--detach');
    }

    if (opts?.orphan) {
      args.push('--orphan');
    }

    if (opts?.merge) {
      args.push('--merge');
    }

    if (opts?.conflict) {
      args.push(`--conflict=${opts.conflict}`);
    }

    if (opts?.recurseSubmodules) {
      args.push('--recurse-submodules');
    }

    args.push(target);

    if (opts?.startPoint) {
      args.push(opts.startPoint);
    }

    await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
  }

  public async checkoutPaths(
    workdir: string,
    paths: string[],
    opts?: CheckoutPathOpts & BackendExecOpts,
  ): Promise<void> {
    const args = ['checkout'];

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.ours) {
      args.push('--ours');
    }

    if (opts?.theirs) {
      args.push('--theirs');
    }

    if (opts?.source) {
      args.push(opts.source);
    }

    args.push('--');
    args.push(...paths);

    await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
  }

  public async diff(
    workdir: string,
    target?: string,
    opts?: DiffOpts & BackendExecOpts,
  ): Promise<DiffResult> {
    const args = ['diff'];

    if (opts?.staged) {
      args.push('--staged');
    }

    if (opts?.nameOnly) {
      args.push('--name-only');
    }

    if (opts?.nameStatus) {
      args.push('--name-status');
    }

    if (opts?.stat) {
      args.push('--stat');
    }

    if (opts?.numstat) {
      args.push('--numstat');
    }

    if (opts?.context !== undefined) {
      args.push(`-U${opts.context}`);
    }

    if (opts?.ignoreWhitespace) {
      args.push('--ignore-all-space');
    }

    if (opts?.detectRenames) {
      if (typeof opts.detectRenames === 'boolean') {
        args.push('-M');
      } else {
        args.push(`-M${opts.detectRenames}`);
      }
    }

    if (opts?.detectCopies) {
      if (typeof opts.detectCopies === 'boolean') {
        args.push('-C');
      } else {
        args.push(`-C${opts.detectCopies}`);
      }
    }

    if (opts?.findCopiesHarder) {
      args.push('--find-copies-harder');
    }

    if (opts?.text) {
      args.push('--text');
    }

    if (opts?.reverse) {
      args.push('-R');
    }

    if (target) {
      args.push(target);
    }

    if (opts?.paths && opts.paths.length > 0) {
      args.push('--');
      args.push(...opts.paths);
    }

    const result = await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
    return this.parseDiff(result.stdout, opts);
  }

  public async reset(
    workdir: string,
    target?: string,
    opts?: ResetOpts & BackendExecOpts,
  ): Promise<void> {
    const args = ['reset'];

    if (opts?.mode) {
      args.push(`--${opts.mode}`);
    }

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.recurseSubmodules) {
      args.push('--recurse-submodules');
    }

    if (target) {
      args.push(target);
    }

    await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
  }

  public async merge(
    workdir: string,
    branch: string,
    opts?: MergeOpts & BackendExecOpts,
  ): Promise<MergeResult> {
    const args = ['merge'];

    if (opts?.message) {
      args.push('-m', opts.message);
    }

    if (opts?.noCommit) {
      args.push('--no-commit');
    }

    if (opts?.squash) {
      args.push('--squash');
    }

    if (opts?.ff !== undefined) {
      if (opts.ff === 'only') {
        args.push('--ff-only');
      } else if (opts.ff === 'no' || opts.ff === false) {
        args.push('--no-ff');
      } else {
        args.push('--ff');
      }
    }

    if (opts?.strategy) {
      args.push('--strategy', opts.strategy);
    }

    if (opts?.strategyOption) {
      const strategyOpts = Array.isArray(opts.strategyOption)
        ? opts.strategyOption
        : [opts.strategyOption];
      for (const so of strategyOpts) {
        args.push('--strategy-option', so);
      }
    }

    if (opts?.noVerify) {
      args.push('--no-verify');
    }

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.verbose) {
      args.push('--verbose');
    }

    if (opts?.abort) {
      args.push('--abort');
    } else if (opts?.continue) {
      args.push('--continue');
    } else if (opts?.quit) {
      args.push('--quit');
    } else {
      args.push(branch);
    }

    if (opts?.allowUnrelatedHistories) {
      args.push('--allow-unrelated-histories');
    }

    const result = await this.runner.run({ type: 'worktree', workdir }, args, opts);

    // Parse merge result
    const success = result.exitCode === 0;
    const output = result.stdout + result.stderr;

    // Check for fast-forward
    const fastForward = output.includes('Fast-forward');

    // Get merge commit hash if successful
    let hash: string | undefined;
    if (success && !opts?.noCommit && !opts?.squash) {
      const hashResult = await this.runner.run({ type: 'worktree', workdir }, [
        'rev-parse',
        'HEAD',
      ]);
      if (hashResult.exitCode === 0) {
        hash = hashResult.stdout.trim();
      }
    }

    // Parse conflicts if any
    let conflicts: string[] | undefined;
    if (!success) {
      const conflictMatches = output.matchAll(/CONFLICT \([^)]+\): Merge conflict in (.+)/g);
      conflicts = [...conflictMatches].map((m) => m[1] ?? '').filter(Boolean);

      // Also check for other conflict types
      const autoMergeMatches = output.matchAll(/Auto-merging (.+)/g);
      const autoMerged = [...autoMergeMatches].map((m) => m[1] ?? '').filter(Boolean);

      if (conflicts.length === 0 && autoMerged.length > 0) {
        // Check status for unmerged files
        const statusResult = await this.runner.run(
          { type: 'worktree', workdir },
          ['diff', '--name-only', '--diff-filter=U'],
          opts,
        );
        if (statusResult.exitCode === 0 && statusResult.stdout.trim()) {
          conflicts = statusResult.stdout.trim().split('\n');
        }
      }
    }

    return {
      success,
      hash,
      conflicts: conflicts && conflicts.length > 0 ? conflicts : undefined,
      fastForward,
    };
  }

  public async pull(workdir: string, opts?: PullOpts & BackendExecOpts): Promise<void> {
    const args = ['pull'];

    if (opts?.onProgress) {
      args.push('--progress');
    }

    if (opts?.verbose) {
      args.push('--verbose');
    }

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.rebase) {
      if (typeof opts.rebase === 'boolean') {
        if (opts.rebase) {
          args.push('--rebase');
        }
      } else {
        args.push(`--rebase=${opts.rebase}`);
      }
    }

    if (opts?.ff !== undefined) {
      if (opts.ff === 'only') {
        args.push('--ff-only');
      } else if (opts.ff === 'no' || opts.ff === false) {
        args.push('--no-ff');
      } else {
        args.push('--ff');
      }
    }

    if (opts?.prune) {
      args.push('--prune');
    }

    if (opts?.tags) {
      args.push('--tags');
    }

    if (opts?.depth !== undefined) {
      args.push('--depth', String(opts.depth));
    }

    if (opts?.unshallow) {
      args.push('--unshallow');
    }

    if (opts?.squash) {
      args.push('--squash');
    }

    if (opts?.strategy) {
      args.push('--strategy', opts.strategy);
    }

    if (opts?.strategyOption) {
      const strategyOpts = Array.isArray(opts.strategyOption)
        ? opts.strategyOption
        : [opts.strategyOption];
      for (const so of strategyOpts) {
        args.push('--strategy-option', so);
      }
    }

    if (opts?.autostash) {
      args.push('--autostash');
    }

    if (opts?.setUpstream) {
      args.push('--set-upstream');
    }

    if (opts?.remote) {
      args.push(opts.remote);
    }

    if (opts?.branch) {
      args.push(opts.branch);
    }

    await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
  }

  public async stashPush(workdir: string, opts?: StashPushOpts & BackendExecOpts): Promise<void> {
    const args = ['stash', 'push'];

    if (opts?.message) {
      args.push('-m', opts.message);
    }

    if (opts?.includeUntracked) {
      args.push('--include-untracked');
    }

    if (opts?.all) {
      args.push('--all');
    }

    if (opts?.keepIndex) {
      args.push('--keep-index');
    }

    if (opts?.staged) {
      args.push('--staged');
    }

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.paths && opts.paths.length > 0) {
      args.push('--');
      args.push(...opts.paths);
    }

    await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
  }

  public async stashPop(workdir: string, opts?: StashApplyOpts & BackendExecOpts): Promise<void> {
    const args = ['stash', 'pop'];

    if (opts?.reinstateIndex) {
      args.push('--index');
    }

    if (opts?.index !== undefined) {
      args.push(`stash@{${opts.index}}`);
    }

    await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
  }

  public async stashList(workdir: string, opts?: BackendExecOpts): Promise<StashEntry[]> {
    const args = ['stash', 'list', '--format=%gd%x00%H%x00%s'];

    const result = await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
    return this.parseStashList(result.stdout);
  }

  public async tagList(
    workdir: string,
    opts?: TagListOpts & BackendExecOpts,
  ): Promise<string[]> {
    const args = ['tag', '--list'];

    if (opts?.pattern) {
      args.push(opts.pattern);
    }

    if (opts?.sort) {
      args.push('--sort', opts.sort);
    }

    if (opts?.contains) {
      args.push('--contains', opts.contains);
    }

    if (opts?.noContains) {
      args.push('--no-contains', opts.noContains);
    }

    if (opts?.merged) {
      args.push('--merged', opts.merged);
    }

    if (opts?.noMerged) {
      args.push('--no-merged', opts.noMerged);
    }

    if (opts?.pointsAt) {
      args.push('--points-at', opts.pointsAt);
    }

    const result = await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
    return parseLines(result.stdout).filter(Boolean);
  }

  public async tagCreate(
    workdir: string,
    name: string,
    opts?: TagCreateOpts & BackendExecOpts,
  ): Promise<void> {
    const args = ['tag'];

    if (opts?.message) {
      args.push('-m', opts.message);
    } else if (opts?.file) {
      args.push('-F', opts.file);
    }

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.sign) {
      args.push('--sign');
    }

    if (opts?.localUser) {
      args.push('--local-user', opts.localUser);
    }

    args.push(name);

    if (opts?.commit) {
      args.push(opts.commit);
    }

    await this.runOrThrow({ type: 'worktree', workdir }, args, opts);
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private async runOrThrow(
    context: ExecutionContext,
    args: string[],
    opts?: BackendExecOpts,
  ): Promise<RawResult> {
    const result = await this.runner.run(context, args, opts);
    const error = this.runner.mapError(result, context, args);
    if (error) {
      throw error;
    }
    return result;
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
        const aheadStr = match?.[1];
        const behindStr = match?.[2];
        if (aheadStr !== undefined && behindStr !== undefined) {
          ahead = Number.parseInt(aheadStr, 10);
          behind = Number.parseInt(behindStr, 10);
        }
      } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
        const parsed = parsePorcelainV2(line);
        const entry = parsed[0];
        if (entry?.type === 'changed') {
          const indexStatus = entry.xy[0];
          const workdirStatus = entry.xy[1];
          if (indexStatus !== undefined && workdirStatus !== undefined) {
            entries.push({
              path: entry.path,
              index: indexStatus,
              workdir: workdirStatus,
              originalPath: entry.origPath,
            });
          }
        }
      } else if (line.startsWith('u ')) {
        const parsed = parsePorcelainV2(line);
        const entry = parsed[0];
        if (entry?.type === 'unmerged') {
          const indexStatus = entry.xy[0];
          const workdirStatus = entry.xy[1];
          if (indexStatus !== undefined && workdirStatus !== undefined) {
            entries.push({
              path: entry.path,
              index: indexStatus,
              workdir: workdirStatus,
            });
          }
        }
      } else if (line.startsWith('? ')) {
        entries.push({
          path: line.slice(2),
          index: '?',
          workdir: '?',
        });
      } else if (line.startsWith('! ')) {
        entries.push({
          path: line.slice(2),
          index: '!',
          workdir: '!',
        });
      }
    }

    return { entries, branch, upstream, ahead, behind };
  }

  private parseLog(stdout: string): Commit[] {
    if (!stdout.trim()) {
      return [];
    }

    const records = stdout.split('\x01').filter((r) => r.trim());
    const commits: Commit[] = [];

    for (const record of records) {
      const fields = record.split('\x00');
      if (fields.length < 11) {
        continue;
      }

      const [
        hash,
        abbrevHash,
        parentsStr,
        authorName,
        authorEmail,
        authorTimestamp,
        committerName,
        committerEmail,
        committerTimestamp,
        subject,
        ...bodyParts
      ] = fields;

      if (!(hash && abbrevHash)) {
        continue;
      }

      commits.push({
        hash,
        abbrevHash,
        parents: parentsStr ? parentsStr.split(' ').filter(Boolean) : [],
        author: {
          name: authorName ?? '',
          email: authorEmail ?? '',
          timestamp: Number.parseInt(authorTimestamp ?? '0', 10),
        },
        committer: {
          name: committerName ?? '',
          email: committerEmail ?? '',
          timestamp: Number.parseInt(committerTimestamp ?? '0', 10),
        },
        subject: subject ?? '',
        body: bodyParts.join('\x00').trim(),
      });
    }

    return commits;
  }

  private parseBranchList(stdout: string): BranchInfo[] {
    const lines = parseLines(stdout);
    const branches: BranchInfo[] = [];

    for (const line of lines) {
      const [name, commit, upstream, track, head] = line.split('\x00');
      if (!(name && commit)) {
        continue;
      }

      branches.push({
        name,
        current: head === '*',
        commit,
        upstream: upstream || undefined,
        gone: track?.includes('gone') ?? false,
      });
    }

    return branches;
  }

  private parseDiff(stdout: string, opts?: DiffOpts): DiffResult {
    const files: DiffEntry[] = [];

    if (opts?.nameStatus) {
      // Parse --name-status format: "M\tpath" or "R100\told\tnew"
      const lines = parseLines(stdout);
      for (const line of lines) {
        const parts = line.split('\t');
        const statusCode = parts[0] ?? '';
        const status = statusCode[0] as DiffEntry['status'];
        const path = parts[1] ?? '';

        if (!status || !path) {
          continue;
        }

        const entry: DiffEntry = { path, status };

        // Handle renames/copies with percentage (e.g., R100, C050)
        if ((status === 'R' || status === 'C') && parts[2]) {
          entry.oldPath = path;
          entry.path = parts[2];
        }

        files.push(entry);
      }
    } else if (opts?.nameOnly) {
      // Parse --name-only format: just paths
      const lines = parseLines(stdout);
      for (const line of lines) {
        if (line) {
          files.push({ path: line, status: 'M' });
        }
      }
    } else if (opts?.numstat) {
      // Parse --numstat format: "additions\tdeletions\tpath"
      const lines = parseLines(stdout);
      for (const line of lines) {
        const parts = line.split('\t');
        const additions = parts[0];
        const deletions = parts[1];
        const path = parts[2];

        if (!path) {
          continue;
        }

        const entry: DiffEntry = {
          path,
          status: 'M',
          additions: additions === '-' ? undefined : Number.parseInt(additions ?? '0', 10),
          deletions: deletions === '-' ? undefined : Number.parseInt(deletions ?? '0', 10),
        };

        files.push(entry);
      }
    }

    return { files, raw: stdout };
  }

  private parseStashList(stdout: string): StashEntry[] {
    if (!stdout.trim()) {
      return [];
    }

    const lines = parseLines(stdout);
    const entries: StashEntry[] = [];

    for (const line of lines) {
      const parts = line.split('\x00');
      const refname = parts[0] ?? '';
      const commit = parts[1] ?? '';
      const message = parts[2] ?? '';

      // Parse stash@{n} format
      const match = refname.match(/stash@\{(\d+)\}/);
      if (!match) {
        continue;
      }

      const index = Number.parseInt(match[1] ?? '0', 10);

      // Parse branch name from message if present
      // Format: "WIP on branch: hash message" or "On branch: message"
      const branchMatch = message.match(/^(?:WIP )?[Oo]n ([^:]+):/);
      const branch = branchMatch?.[1];

      entries.push({
        index,
        message,
        branch,
        commit,
      });
    }

    return entries;
  }
}

/**
 * Create a CLI backend instance
 */
export function createCliBackend(
  adapters: RuntimeAdapters,
  options?: CliBackendOptions,
): GitBackend {
  return new CliBackend(adapters, options);
}

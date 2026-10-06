import { commandArguments } from '../commands/build.js';
import type { GitCommandClient, GitCommandExecOpts, GitCommandName } from '../commands/types.js';
import {
  type ExclusiveQuery,
  validateInput,
  validateOptions,
  validatePathInput,
  validateRevParseQuery,
} from '../core/option-rules.js';
import { GitError } from '../core/types.js';
import { listConfig, readConfig, readTypedConfig } from '../internal/config.js';
import { parseLfsFilesJson, parseLfsStatusJson } from '../internal/lfs-output.js';
import { fetch as fetchRepository, push as pushRepository } from '../internal/transport.js';
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
  CheckoutBranchOpts,
  CheckoutPathOpts,
  // Medium priority types
  CherryPickOpts,
  CleanOpts,
  Commit,
  CommitOpts,
  CommitResult,
  ConfigEntry,
  ConfigGetOpts,
  ConfigKey,
  ConfigListOpts,
  ConfigOperations,
  ConfigSchema,
  ConfigSetOpts,
  DiffEntry,
  DiffOpts,
  DiffResult,
  FetchOpts,
  LfsCheckoutOpts,
  LfsEnvInfo,
  LfsExtraOperations,
  LfsFetchOpts,
  LfsFileEntry,
  LfsLockEntry,
  LfsLockOpts,
  LfsLocksOpts,
  LfsLsFilesOpts,
  LfsMigrateExportOpts,
  LfsMigrateImportOpts,
  LfsMigrateInfoOpts,
  LfsOperations,
  LfsPreDownloadOpts,
  LfsPreDownloadResult,
  LfsPreUploadOpts,
  LfsPreUploadResult,
  LfsPruneOpts,
  LfsPullOpts,
  LfsPushOpts,
  LfsStatus,
  LfsStatusOpts,
  LfsTrackEntry,
  LfsTrackOpts,
  LfsUnlockOpts,
  LogOpts,
  LsTreeEntry,
  LsTreeOpts,
  MergeOpts,
  MergeResult,
  MvOpts,
  PullOpts,
  PushOpts,
  RebaseOpts,
  RemoteAddOpts,
  RemoteInfo,
  RemoteOperations,
  RemotePruneOpts,
  RemoteSetBranchesOpts,
  RemoteSetHeadOpts,
  RemoteShowOpts,
  RemoteUpdateOpts,
  RemoteUrlOpts,
  RepoLfsInstallOpts,
  RepoLfsUninstallOpts,
  RepoLsRemoteOpts,
  RepoLsRemoteResult,
  ResetOpts,
  RestoreOpts,
  RevertOpts,
  RevParseBooleanQuery,
  RevParseListQuery,
  RevParsePathOpts,
  RevParsePathQuery,
  RevParseRefOpts,
  RmOpts,
  ShowOpts,
  StashApplyOpts,
  StashEntry,
  StashOperations,
  StashPushOpts,
  StatusOpts,
  StatusPorcelain,
  SubmoduleAddOpts,
  SubmoduleDeinitOpts,
  SubmoduleForeachOpts,
  SubmoduleInfo,
  SubmoduleOperations,
  SubmoduleOpts,
  SubmoduleSetBranchOpts,
  SubmoduleStatusOpts,
  SubmoduleSummaryOpts,
  SubmoduleSyncOpts,
  SwitchOpts,
  TagCreateOpts,
  TagInfo,
  TagListOpts,
  TagOperations,
  Worktree,
  WorktreeAddOpts,
  WorktreeLockOpts,
  WorktreeMoveOpts,
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
import { runWithConcurrency } from '../internal/concurrency.js';
import {
  GIT_LOG_FORMAT,
  parseGitLog,
  parseLines,
  parseLsRemote,
  parseLsTree,
  parsePorcelainV2,
  parseRecords,
  parseWorktreeList,
} from '../parsers/index.js';
import type { CliRunner } from '../runner/cli-runner.js';

/**
 * Default number of OIDs per `git lfs push --object-id` invocation.
 *
 * Each batch becomes a single spawned process, so the batch size is bounded
 * by the OS command-line length limit. Git is spawned directly without a
 * shell, so the binding limit is the Windows CreateProcess limit of 32,767
 * characters; 200 OIDs at 65 characters each plus the command prefix use
 * roughly 40% of it. Larger batches directly reduce the number of times the
 * per-invocation fixed cost (process spawn, credential lookup, LFS batch API
 * round-trip) is paid.
 */
const PRE_UPLOAD_DEFAULT_BATCH_SIZE = 200;

/**
 * Default number of `git lfs push` batches run concurrently.
 *
 * Each batch pays its fixed cost before any bytes are transferred; running
 * batches concurrently overlaps that cost with other batches' transfers.
 */
const PRE_UPLOAD_DEFAULT_CONCURRENCY = 4;

/**
 * Number of leading batches run alone before widening to full concurrency.
 *
 * When every batch would fail for the same reason (unreachable remote,
 * missing local objects), the failure is discovered with a single round-trip
 * instead of `concurrency` parallel ones.
 */
const PRE_UPLOAD_WARMUP_BATCH_COUNT = 1;

/**
 * WorktreeRepo implementation
 */
export class WorktreeRepoImpl implements WorktreeRepo {
  public readonly kind = 'worktree' as const;
  public readonly workdir: string;
  private readonly runner: CliRunner;
  private _lfsMode: LfsMode = 'enabled';

  public readonly lfs: LfsOperations;
  public readonly lfsExtra: LfsExtraOperations;
  public readonly worktree: WorktreeOperations;
  public readonly branch: BranchOperations;
  public readonly stash: StashOperations;
  public readonly tag: TagOperations;
  public readonly submodule: SubmoduleOperations;
  public readonly remote: RemoteOperations;
  public readonly config: ConfigOperations;

  public constructor(runner: CliRunner, workdir: string, options?: GitOpenOptions) {
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
      prune: this.lfsPrune.bind(this),
      fetch: this.lfsFetch.bind(this),
      install: this.lfsInstall.bind(this),
      uninstall: this.lfsUninstall.bind(this),
      lsFiles: this.lfsLsFiles.bind(this),
      track: this.lfsTrack.bind(this),
      trackList: this.lfsTrackList.bind(this),
      untrack: this.lfsUntrack.bind(this),
      lock: this.lfsLock.bind(this),
      unlock: this.lfsUnlock.bind(this),
      locks: this.lfsLocks.bind(this),
      checkout: this.lfsCheckout.bind(this),
      migrateInfo: this.lfsMigrateInfo.bind(this),
      migrateImport: this.lfsMigrateImport.bind(this),
      migrateExport: this.lfsMigrateExport.bind(this),
      env: this.lfsEnv.bind(this),
      version: this.lfsVersion.bind(this),
    };

    // Initialize LFS extra operations
    this.lfsExtra = {
      preUpload: this.lfsPreUpload.bind(this),
      preDownload: this.lfsPreDownload.bind(this),
    };

    // Initialize worktree operations
    this.worktree = {
      list: this.worktreeList.bind(this),
      add: this.worktreeAdd.bind(this),
      remove: this.worktreeRemove.bind(this),
      prune: this.worktreePrune.bind(this),
      lock: this.worktreeLock.bind(this),
      unlock: this.worktreeUnlock.bind(this),
      move: this.worktreeMove.bind(this),
      repair: this.worktreeRepair.bind(this),
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
      status: this.submoduleStatus.bind(this),
      summary: this.submoduleSummary.bind(this),
      foreach: this.submoduleForeach.bind(this),
      sync: this.submoduleSync.bind(this),
      absorbGitDirs: this.submoduleAbsorbGitDirs.bind(this),
      setBranch: this.submoduleSetBranch.bind(this),
      setUrl: this.submoduleSetUrl.bind(this),
    };

    // Initialize remote operations
    this.remote = {
      list: this.remoteList.bind(this),
      add: this.remoteAdd.bind(this),
      remove: this.remoteRemove.bind(this),
      rename: this.remoteRename.bind(this),
      getUrl: this.remoteGetUrl.bind(this),
      setUrl: this.remoteSetUrl.bind(this),
      setHead: this.remoteSetHead.bind(this),
      show: this.remoteShow.bind(this),
      prune: this.remotePrune.bind(this),
      update: this.remoteUpdate.bind(this),
      setBranches: this.remoteSetBranches.bind(this),
    };

    // Initialize config operations (repository-level)
    this.config = {
      get: this.configGet.bind(this),
      getAll: this.configGetAll.bind(this),
      set: this.configSet.bind(this),
      add: this.configAdd.bind(this),
      unset: this.configUnset.bind(this),
      getRaw: this.configGetRaw.bind(this),
      setRaw: this.configSetRaw.bind(this),
      unsetRaw: this.configUnsetRaw.bind(this),
      list: this.configList.bind(this),
      renameSection: this.configRenameSection.bind(this),
      removeSection: this.configRemoveSection.bind(this),
    };
  }

  private get context(): ExecutionContext {
    return { type: 'worktree', workdir: this.workdir };
  }

  /**
   * Execute a raw git command in this repository context
   */
  public command: GitCommandClient['command'] = async (
    command: GitCommandName,
    args: readonly unknown[],
    opts?: GitCommandExecOpts,
  ) => {
    return this.raw(commandArguments(command, args, true), opts);
  };

  public async raw(argv: string[], opts?: ExecOpts): Promise<RawResult> {
    return this.runner.run(this.context, argv, opts);
  }

  /**
   * Check if this repository is a worktree repository (has working directory)
   *
   * For WorktreeRepoImpl, this returns the actual state from git.
   */
  public async isWorktree(): Promise<boolean> {
    const result = await this.runner.run(this.context, ['rev-parse', '--is-inside-work-tree']);
    return result.exitCode === 0 && result.stdout.trim() === 'true';
  }

  /**
   * Check if this repository is a bare repository (no working directory)
   *
   * For WorktreeRepoImpl, this queries git and returns the actual state.
   */
  public async isBare(): Promise<boolean> {
    const result = await this.runner.run(this.context, ['rev-parse', '--is-bare-repository']);
    return result.exitCode === 0 && result.stdout.trim() === 'true';
  }

  /**
   * List references in a remote repository
   */
  public async lsRemote(
    remote: string,
    opts?: RepoLsRemoteOpts & ExecOpts,
  ): Promise<RepoLsRemoteResult> {
    validateOptions('lsRemote', opts);
    const args: string[] = ['ls-remote'];

    // Ref type filters
    if (opts?.heads) {
      args.push('--heads');
    }

    if (opts?.tags) {
      args.push('--tags');
    }

    if (opts?.refsOnly) {
      args.push('--refs');
    }

    // Output options

    if (opts?.sort) {
      args.push('--sort', opts.sort);
    }

    // Add remote name
    args.push(remote);

    // Add specific refs if provided
    if (opts?.refs && opts.refs.length > 0) {
      args.push(...opts.refs);
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });

    const refs = parseLsRemote(result.stdout);

    return { refs };
  }

  /**
   * List contents of a tree object
   */
  public lsTree(
    treeish: string,
    opts: LsTreeOpts & ({ nameOnly: true } | { objectOnly: true }) & ExecOpts,
  ): Promise<string[]>;
  public lsTree(
    treeish: string,
    opts?: LsTreeOpts & { nameOnly?: false; objectOnly?: false } & ExecOpts,
  ): Promise<LsTreeEntry[]>;
  public lsTree(treeish: string, opts?: LsTreeOpts & ExecOpts): Promise<LsTreeEntry[] | string[]>;
  public async lsTree(
    treeish: string,
    opts?: LsTreeOpts & ExecOpts,
  ): Promise<LsTreeEntry[] | string[]> {
    validateOptions('lsTree', opts);
    const args: string[] = ['ls-tree', '-z'];

    // Display options
    if (opts?.recursive) {
      args.push('-r');
    }

    if (opts?.treeOnly) {
      args.push('-d');
    }

    if (opts?.showTrees) {
      args.push('-t');
    }

    if (opts?.long) {
      args.push('--long');
    }

    if (opts?.fullName) {
      args.push('--full-name');
    }

    if (opts?.fullTree) {
      args.push('--full-tree');
    }

    if (opts?.abbrev !== undefined) {
      if (opts.abbrev === true) {
        args.push('--abbrev');
      } else if (typeof opts.abbrev === 'number') {
        args.push(`--abbrev=${opts.abbrev}`);
      }
    }

    // Add tree-ish (required)
    args.push(treeish);

    // Add optional paths
    if (opts?.paths && opts.paths.length > 0) {
      args.push('--', ...opts.paths);
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    const entries = parseLsTree(result.stdout, { long: opts?.long });
    if (opts?.nameOnly) {
      return entries.map((entry) => entry.path);
    }
    if (opts?.objectOnly) {
      return entries.map((entry) => entry.hash);
    }
    return entries;
  }

  /**
   * Get repository status
   */
  public async status(opts?: StatusOpts & ExecOpts): Promise<StatusPorcelain> {
    validateOptions('status', opts);
    const args = ['status', '--porcelain=v2', '-z'];

    // Verbosity options

    // Untracked files handling
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

    // Show stash information
    if (opts?.showStash) {
      args.push('--show-stash');
    }

    // Ahead/behind tracking
    if (opts?.aheadBehind === false) {
      args.push('--no-ahead-behind');
    }

    // Ignored files handling
    if (opts?.ignored) {
      switch (opts.ignored) {
        case 'traditional':
          args.push('--ignored=traditional');
          break;
        case 'no':
          args.push('--ignored=no');
          break;
        case 'matching':
          args.push('--ignored=matching');
          break;
      }
    }

    // Submodule handling
    if (opts?.ignoreSubmodules) {
      args.push(`--ignore-submodules=${opts.ignoreSubmodules}`);
    }

    // Rename detection
    if (opts?.noRenames) {
      args.push('--no-renames');
    }
    if (opts?.findRenames !== undefined) {
      if (opts.findRenames === true) {
        args.push('--find-renames');
      } else if (typeof opts.findRenames === 'number') {
        args.push(`--find-renames=${opts.findRenames}`);
      }
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    return this.parseStatus(result.stdout);
  }

  private parseStatus(stdout: string): StatusPorcelain {
    const result: StatusPorcelain = {
      entries: parsePorcelainV2(stdout).map((entry) => {
        if (entry.type === 'untracked' || entry.type === 'ignored') {
          const status = entry.type === 'untracked' ? '?' : '!';
          return { path: entry.path, index: status, workdir: status };
        }
        return {
          path: entry.path,
          index: entry.xy[0]!,
          workdir: entry.xy[1]!,
          ...('origPath' in entry && entry.origPath !== undefined
            ? { originalPath: entry.origPath }
            : {}),
        };
      }),
    };
    const records = stdout.includes('\0')
      ? parseRecords(stdout)
      : parseLines(stdout, { trim: false });
    for (let i = 0; i < records.length; i++) {
      const line = records[i]!;
      if (line.startsWith('2 ') && stdout.includes('\0')) {
        i++;
        continue;
      }
      if (line.startsWith('# branch.head ')) {
        result.branch = line.slice(14);
      }
      if (line.startsWith('# branch.upstream ')) {
        result.upstream = line.slice(18);
      }
      const ab = line.match(/^# branch\.ab \+(\d+) -(\d+)$/);
      if (ab) {
        result.ahead = Number(ab[1]);
        result.behind = Number(ab[2]);
      }
      if (line.startsWith('# stash ')) {
        result.stash = Number(line.slice(8));
      }
    }
    return result;
  }

  /**
   * Get commit log
   */
  public async log(opts?: LogOpts & ExecOpts): Promise<Commit[]> {
    validateOptions('log', opts);
    const format = opts?.useMailmap
      ? GIT_LOG_FORMAT.replace('%an', '%aN')
          .replace('%ae', '%aE')
          .replace('%cn', '%cN')
          .replace('%ce', '%cE')
      : GIT_LOG_FORMAT;
    const args = [
      'log',
      '-z',
      '--no-patch',
      '--no-notes',
      '--no-show-signature',
      '--no-color',
      '--encoding=UTF-8',
      `--format=${format}`,
    ];

    if (opts?.maxCount !== undefined) {
      args.push(`-n${opts.maxCount}`);
    }

    if (opts?.skip !== undefined) {
      args.push(`--skip=${opts.skip}`);
    }

    // Date filters (since/after and until/before are aliases)
    if (opts?.since) {
      const since = opts.since instanceof Date ? opts.since.toISOString() : opts.since;
      args.push(`--since=${since}`);
    }
    if (opts?.after) {
      const after = opts.after instanceof Date ? opts.after.toISOString() : opts.after;
      args.push(`--after=${after}`);
    }

    if (opts?.until) {
      const until = opts.until instanceof Date ? opts.until.toISOString() : opts.until;
      args.push(`--until=${until}`);
    }
    if (opts?.before) {
      const before = opts.before instanceof Date ? opts.before.toISOString() : opts.before;
      args.push(`--before=${before}`);
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

    // New options

    if (opts?.useMailmap) {
      args.push('--use-mailmap');
    }

    if (opts?.merges) {
      args.push('--merges');
    }

    if (opts?.noMerges) {
      args.push('--no-merges');
    }

    if (opts?.ancestryPath) {
      args.push('--ancestry-path');
    }

    if (opts?.reverse) {
      args.push('--reverse');
    }

    // ref must be placed after all options (positional argument)
    if (opts?.ref) {
      args.push(opts.ref);
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
  public async fetch(opts?: FetchOpts & ExecOpts): Promise<void> {
    return fetchRepository(this.runner, this.context, opts);
  }

  /**
   * Push to remote
   */
  public async push(opts?: PushOpts & ExecOpts): Promise<void> {
    return pushRepository(this.runner, this.context, opts);
  }

  /**
   * Configure LFS mode for this repository
   */
  public setLfsMode(mode: LfsMode): void {
    this._lfsMode = mode;
  }

  /**
   * Per-command environment overrides derived from the configured LFS mode.
   *
   * When the repository was opened (or reconfigured) with an object-form LFS
   * mode requesting `skipSmudge` and/or `skipDownload`, working-tree-populating
   * operations (checkout, switch, reset, merge, pull, rebase, restore) run with
   * `GIT_LFS_SKIP_SMUDGE=1`. Git then leaves LFS pointer files in place instead
   * of downloading their contents during the implicit checkout.
   *
   * The objects can be materialized later via the explicit `repo.lfs.pull()` /
   * `repo.lfs.checkout()` helpers, which use dedicated git-lfs commands and are
   * not affected by `GIT_LFS_SKIP_SMUDGE`.
   *
   * Returns `undefined` for the `'enabled'` / `'disabled'` string modes so the
   * runner environment is left untouched.
   */
  private lfsModeEnv(): Record<string, string> | undefined {
    const mode = this._lfsMode;
    if (typeof mode === 'object' && (mode.skipSmudge === true || mode.skipDownload === true)) {
      return { GIT_LFS_SKIP_SMUDGE: '1' };
    }
    return undefined;
  }

  // ==========================================================================
  // LFS Operations
  // ==========================================================================

  private async lfsPull(opts?: LfsPullOpts & ExecOpts): Promise<void> {
    validateOptions('lfsPull', opts);
    if (this._lfsMode === 'disabled') {
      return;
    }

    const args = ['lfs', 'pull'];

    if (opts?.remote) {
      args.push(opts.remote);
    }

    if (opts?.include !== undefined) {
      args.push('--include', opts.include.join(','));
    }

    if (opts?.exclude !== undefined) {
      args.push('--exclude', opts.exclude.join(','));
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
      onLfsProgress: opts?.onLfsProgress,
    });
  }

  private async lfsPush(opts?: LfsPushOpts & ExecOpts): Promise<void> {
    validateOptions('lfsPush', opts);
    if (this._lfsMode === 'disabled') {
      return;
    }

    if (opts?.stdin && opts.objectId === undefined && !opts.ref) {
      throw new TypeError('lfs.push with stdin requires objectId or ref');
    }

    const args = ['lfs', 'push'];

    if (opts?.dryRun) {
      args.push('--dry-run');
    }

    const oids =
      opts?.objectId !== undefined
        ? Array.isArray(opts.objectId)
          ? opts.objectId
          : [opts.objectId]
        : undefined;
    if (oids?.length === 0 && !opts?.stdin) {
      throw new TypeError(
        'lfs.push with objectId requires at least one OID unless stdin is enabled',
      );
    }
    args.push(oids ? '--object-id' : '--all');
    args.push(opts?.remote ?? 'origin');

    const values = oids ?? (opts?.ref ? [opts.ref] : []);
    if (opts?.stdin) {
      args.push('--stdin');
    } else {
      args.push(...values);
    }

    await this.runner.runOrThrow(this.context, args, {
      stdin: opts?.stdin ? (values.length > 0 ? `${values.join('\n')}\n` : '') : undefined,
      signal: opts?.signal,
      onProgress: opts?.onProgress,
      onLfsProgress: opts?.onLfsProgress,
    });
  }

  private async lfsStatus(opts?: LfsStatusOpts & ExecOpts): Promise<LfsStatus> {
    validateOptions('lfsStatus', opts);
    const result = await this.runner.runOrThrow(this.context, ['lfs', 'status', '--json'], opts);
    return parseLfsStatusJson(result.stdout);
  }

  /**
   * Pre-upload LFS objects before commit/push (2-phase commit pattern)
   *
   * This allows uploading LFS objects to the remote before creating a commit,
   * ensuring reliable large file handling. Objects are batched to stay within
   * command-line length limits, and batches run with bounded concurrency to
   * overlap per-invocation fixed costs with other batches' transfers.
   *
   * Failure handling: once a batch fails, no new batch is started (in-flight
   * batches are awaited), and the objects of failed and unstarted batches are
   * reported in `skippedCount`. The first batch always runs alone before the
   * remaining batches widen to the concurrency limit, so a failure common to
   * all batches costs a single round-trip.
   *
   * Usage pattern:
   * 1. Stage changes: git add
   * 2. Pre-upload LFS: await repo.lfsExtra.preUpload()
   * 3. Commit: git commit
   * 4. Push refs: git push (only refs, objects already uploaded)
   */
  private async lfsPreUpload(opts?: LfsPreUploadOpts & ExecOpts): Promise<LfsPreUploadResult> {
    if (this._lfsMode === 'disabled') {
      return { uploadedCount: 0, uploadedBytes: 0, skippedCount: 0 };
    }

    const remote = opts?.remote ?? 'origin';
    const batchSize = opts?.batchSize ?? PRE_UPLOAD_DEFAULT_BATCH_SIZE;
    const concurrency = opts?.concurrency ?? PRE_UPLOAD_DEFAULT_CONCURRENCY;
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new RangeError(`batchSize must be a positive integer, got: ${batchSize}`);
    }
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new RangeError(`concurrency must be a positive integer, got: ${concurrency}`);
    }

    // Get OIDs to upload
    let oids: string[];
    if (opts?.oids && opts.oids.length > 0) {
      oids = opts.oids;
    } else {
      // Get all LFS objects that need to be pushed
      const lsFilesResult = await this.runner.run(
        this.context,
        ['lfs', 'ls-files', '--all', '--long'],
        { signal: opts?.signal },
      );

      if (lsFilesResult.exitCode !== 0) {
        return { uploadedCount: 0, uploadedBytes: 0, skippedCount: 0 };
      }

      // Parse OIDs from ls-files output (format: <oid> [-|*] <path>)
      oids = [];
      for (const line of parseLines(lsFilesResult.stdout)) {
        const match = line.match(/^([a-f0-9]{64})\s+[-*]\s+/);
        const oid = match?.[1];
        if (oid !== undefined) {
          oids.push(oid);
        }
      }
    }

    if (oids.length === 0) {
      return { uploadedCount: 0, uploadedBytes: 0, skippedCount: 0 };
    }

    // Split into batches; each batch is one `git lfs push` invocation
    const batches: string[][] = [];
    for (let i = 0; i < oids.length; i += batchSize) {
      batches.push(oids.slice(i, i + batchSize));
    }

    let uploadedCount = 0;
    let uploadedBytes = 0;
    let skippedCount = 0;
    let attemptedCount = 0;

    // Identity sentinel: thrown by a failed batch so the scheduler stops
    // starting new batches; converted back to counts below, never surfaced.
    const batchFailedStop = new Error('lfs pre-upload batch failed');

    const pushBatch = async (batch: string[]): Promise<void> => {
      const args = ['lfs', 'push', remote, '--object-id', ...batch];

      const result = await this.runner.run(this.context, args, {
        signal: opts?.signal,
        onProgress: opts?.onProgress,
        onLfsProgress: opts?.onLfsProgress,
      });

      attemptedCount += batch.length;

      if (result.exitCode === 0 && !result.aborted) {
        // Parse upload stats from output if available
        uploadedCount += batch.length;

        // Try to extract bytes from progress output
        const bytesMatch = result.stderr.match(
          /Uploading LFS objects:.*?\((\d+(?:\.\d+)?)\s*([KMG]?B)/i,
        );
        const bytesStr = bytesMatch?.[1];
        if (bytesStr !== undefined) {
          let bytes = Number.parseFloat(bytesStr);
          const unit = bytesMatch?.[2]?.toUpperCase();
          if (unit === 'KB') {
            bytes *= 1024;
          } else if (unit === 'MB') {
            bytes *= 1024 * 1024;
          } else if (unit === 'GB') {
            bytes *= 1024 * 1024 * 1024;
          }
          uploadedBytes += bytes;
        }
      } else {
        skippedCount += batch.length;
        throw batchFailedStop;
      }
    };

    try {
      await runWithConcurrency(batches, pushBatch, {
        concurrency,
        warmupCount: PRE_UPLOAD_WARMUP_BATCH_COUNT,
      });
    } catch (error) {
      if (error !== batchFailedStop) {
        throw error;
      }
      // Batches that were never started count as skipped, keeping
      // uploadedCount + skippedCount equal to the number of OIDs.
      skippedCount += oids.length - attemptedCount;
    }

    return { uploadedCount, uploadedBytes, skippedCount };
  }

  /**
   * Pre-download LFS objects before checkout (2-phase fetch pattern)
   *
   * This allows downloading LFS objects before switching branches,
   * ensuring files are available locally before checkout.
   *
   * Usage pattern:
   * 1. Fetch refs: git fetch
   * 2. Pre-download LFS: await repo.lfsExtra.preDownload({ ref: 'origin/feature' })
   * 3. Checkout: git checkout feature
   */
  private async lfsPreDownload(
    opts?: LfsPreDownloadOpts & ExecOpts,
  ): Promise<LfsPreDownloadResult> {
    if (this._lfsMode === 'disabled') {
      return { downloadedCount: 0, downloadedBytes: 0, skippedCount: 0 };
    }

    const remote = opts?.remote ?? 'origin';
    const batchSize = opts?.batchSize ?? 50;
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new RangeError(`batchSize must be a positive integer, got: ${batchSize}`);
    }

    // Get OIDs to download
    let oids: string[];
    if (opts?.oids && opts.oids.length > 0) {
      oids = opts.oids;
    } else if (opts?.ref) {
      // Get LFS objects for a specific ref
      const lsFilesResult = await this.runner.run(
        this.context,
        ['lfs', 'ls-files', '--long', opts.ref],
        { signal: opts?.signal },
      );

      if (lsFilesResult.exitCode !== 0) {
        return { downloadedCount: 0, downloadedBytes: 0, skippedCount: 0 };
      }

      // Parse OIDs from ls-files output
      oids = [];
      for (const line of parseLines(lsFilesResult.stdout)) {
        const match = line.match(/^([a-f0-9]{64})\s+[-*]\s+/);
        const oid = match?.[1];
        if (oid !== undefined) {
          oids.push(oid);
        }
      }
    } else {
      // No ref specified and no OIDs provided
      return { downloadedCount: 0, downloadedBytes: 0, skippedCount: 0 };
    }

    if (oids.length === 0) {
      return { downloadedCount: 0, downloadedBytes: 0, skippedCount: 0 };
    }

    // Process in batches
    let downloadedCount = 0;
    let downloadedBytes = 0;
    let skippedCount = 0;

    for (let i = 0; i < oids.length; i += batchSize) {
      const batch = oids.slice(i, i + batchSize);
      const args = ['lfs', 'fetch', remote, '--', ...batch];

      const result = await this.runner.run(this.context, args, {
        signal: opts?.signal,
        onProgress: opts?.onProgress,
        onLfsProgress: opts?.onLfsProgress,
      });

      if (result.exitCode === 0) {
        downloadedCount += batch.length;

        // Try to extract bytes from progress output
        const bytesMatch = result.stderr.match(
          /Downloading LFS objects:.*?\((\d+(?:\.\d+)?)\s*([KMG]?B)/i,
        );
        const bytesStr = bytesMatch?.[1];
        if (bytesStr !== undefined) {
          let bytes = Number.parseFloat(bytesStr);
          const unit = bytesMatch?.[2]?.toUpperCase();
          if (unit === 'KB') {
            bytes *= 1024;
          } else if (unit === 'MB') {
            bytes *= 1024 * 1024;
          } else if (unit === 'GB') {
            bytes *= 1024 * 1024 * 1024;
          }
          downloadedBytes += bytes;
        }
      } else {
        skippedCount += batch.length;
      }
    }

    return { downloadedCount, downloadedBytes, skippedCount };
  }

  /**
   * Prune old and unreferenced LFS objects from local storage
   */
  private async lfsPrune(opts?: LfsPruneOpts & ExecOpts): Promise<void> {
    if (this._lfsMode === 'disabled') {
      return;
    }

    const args = ['lfs', 'prune'];

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.dryRun) {
      args.push('--dry-run');
    }

    if (opts?.verifyRemote) {
      args.push('--verify-remote');
    }

    if (opts?.verifyUnreferenced) {
      args.push('--verify-unreferenced');
    }

    if (opts?.recent) {
      args.push('--recent');
    }

    if (opts?.verbose) {
      args.push('--verbose');
    }

    if (opts?.whenUnverified) {
      args.push(`--when-unverified=${opts.whenUnverified}`);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });
  }

  private async lfsFetch(opts?: LfsFetchOpts & ExecOpts): Promise<void> {
    validateOptions('lfsFetch', opts);
    if (this._lfsMode === 'disabled') {
      return;
    }

    const args = ['lfs', 'fetch'];

    if (opts?.dryRun) {
      args.push('--dry-run');
    }
    if (opts?.refetch) {
      args.push('--refetch');
    }
    if (opts?.json) {
      args.push('--json');
    }

    if (opts?.all) {
      args.push('--all');
    }

    if (opts?.prune) {
      args.push('--prune');
    }

    if (opts?.recent) {
      args.push('--recent');
    }

    if (opts?.include) {
      const patterns = Array.isArray(opts.include) ? opts.include : [opts.include];
      args.push('--include', patterns.join(','));
    }

    if (opts?.exclude) {
      const patterns = Array.isArray(opts.exclude) ? opts.exclude : [opts.exclude];
      args.push('--exclude', patterns.join(','));
    }

    if (opts?.remote || opts?.refs) {
      args.push(opts.remote ?? 'origin');
    }

    if (opts?.refs) {
      const refList = Array.isArray(opts.refs) ? opts.refs : [opts.refs];
      args.push(...refList);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
      onLfsProgress: opts?.onLfsProgress,
    });
  }

  private async lfsInstall(opts?: RepoLfsInstallOpts & ExecOpts): Promise<void> {
    const args = ['lfs', 'install'];

    if (opts?.force) {
      args.push('--force');
    }

    // Use --worktree if specified, otherwise default to --local
    if (opts?.worktree) {
      args.push('--worktree');
    } else {
      args.push('--local');
    }

    if (opts?.skipSmudge) {
      args.push('--skip-smudge');
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async lfsUninstall(opts?: RepoLfsUninstallOpts & ExecOpts): Promise<void> {
    const args = ['lfs', 'uninstall'];

    // Use --worktree if specified, otherwise default to --local
    if (opts?.worktree) {
      args.push('--worktree');
    } else {
      args.push('--local');
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async lfsLsFiles(opts?: LfsLsFilesOpts & ExecOpts): Promise<LfsFileEntry[]> {
    validateOptions('lfsLsFiles', opts);
    if (this._lfsMode === 'disabled') {
      return [];
    }

    const args = ['lfs', 'ls-files', '--json'];

    if (opts?.long) {
      args.push('--long');
    }

    // biome-ignore lint/style/useExplicitLengthCheck: size is a boolean option, not a length property
    if (opts?.size) {
      args.push('--size');
    }

    if (opts?.all) {
      args.push('--all');
    }

    if (opts?.deleted) {
      args.push('--deleted');
    }

    if (opts?.include) {
      const patterns = Array.isArray(opts.include) ? opts.include : [opts.include];
      args.push('--include', patterns.join(','));
    }

    if (opts?.exclude) {
      const patterns = Array.isArray(opts.exclude) ? opts.exclude : [opts.exclude];
      args.push('--exclude', patterns.join(','));
    }

    if (opts?.ref) {
      args.push(opts.ref);
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    return parseLfsFilesJson(result.stdout);
  }

  private async lfsTrack(
    patterns: string | string[],
    opts?: LfsTrackOpts & ExecOpts,
  ): Promise<void> {
    const args = ['lfs', 'track'];

    if (opts?.verbose) {
      args.push('--verbose');
    }

    if (opts?.dryRun) {
      args.push('--dry-run');
    }

    if (opts?.lockable) {
      args.push('--lockable');
    }

    if (opts?.noModifyAttrs) {
      args.push('--no-modify-attrs');
    }

    if (opts?.noExcluded) {
      args.push('--no-excluded');
    }

    const patternList = Array.isArray(patterns) ? patterns : [patterns];
    args.push(...patternList);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async lfsTrackList(opts?: ExecOpts): Promise<LfsTrackEntry[]> {
    if (this._lfsMode === 'disabled') {
      return [];
    }

    const result = await this.runner.runOrThrow(this.context, ['lfs', 'track'], {
      signal: opts?.signal,
    });

    const entries: LfsTrackEntry[] = [];
    for (const line of parseLines(result.stdout)) {
      // Format: "Listing tracked patterns\n    *.psd (.gitattributes)\n    *.bin (.gitattributes) [lockable]"
      const match = line.match(/^\s+(\S+)\s+\(([^)]+)\)(?:\s+\[lockable\])?$/);
      if (match) {
        entries.push({
          pattern: match[1]!,
          source: match[2]!,
          lockable: line.includes('[lockable]'),
        });
      }
    }

    return entries;
  }

  private async lfsUntrack(patterns: string | string[], opts?: ExecOpts): Promise<void> {
    const args = ['lfs', 'untrack'];

    const patternList = Array.isArray(patterns) ? patterns : [patterns];
    args.push(...patternList);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async lfsLock(path: string, opts?: LfsLockOpts & ExecOpts): Promise<LfsLockEntry> {
    if (this._lfsMode === 'disabled') {
      throw new Error('LFS is disabled');
    }

    const args = ['lfs', 'lock', '--json'];

    if (opts?.remote) {
      args.push('--remote', opts.remote);
    }

    args.push(path);

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    const data = JSON.parse(result.stdout) as {
      id: string;
      path: string;
      owner: { name: string };
      // biome-ignore lint/style/useNamingConvention: locked_at is from git-lfs JSON output
      locked_at: string;
    };

    return {
      id: data.id,
      path: data.path,
      owner: { name: data.owner.name },
      lockedAt: new Date(data.locked_at),
    };
  }

  private async lfsUnlock(pathOrId: string, opts?: LfsUnlockOpts & ExecOpts): Promise<void> {
    if (this._lfsMode === 'disabled') {
      return;
    }

    const args = ['lfs', 'unlock'];

    if (opts?.id) {
      args.push('--id');
    }

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.remote) {
      args.push('--remote', opts.remote);
    }

    args.push(pathOrId);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async lfsLocks(opts?: LfsLocksOpts & ExecOpts): Promise<LfsLockEntry[]> {
    if (this._lfsMode === 'disabled') {
      return [];
    }

    validateOptions('lfsLocks', opts);
    const args = ['lfs', 'locks', '--json'];
    if (opts?.verify) {
      args.push('--verify');
    }

    if (opts?.remote) {
      args.push('--remote', opts.remote);
    }

    if (opts?.path) {
      args.push('--path', opts.path);
    }

    if (opts?.id) {
      args.push('--id', opts.id);
    }

    if (opts?.local) {
      args.push('--local');
    }

    if (opts?.cached) {
      args.push('--cached');
    }

    if (opts?.limit !== undefined) {
      args.push('--limit', String(opts.limit));
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    type Lock = {
      id: string;
      path: string;
      owner?: { name: string };
      // biome-ignore lint/style/useNamingConvention: Git LFS JSON field
      locked_at: string;
    };
    const data = JSON.parse(result.stdout) as
      | Lock[]
      | { ours: Lock[] | null; theirs: Lock[] | null }
      | null;
    const convert = (lock: Lock, ours?: boolean): LfsLockEntry => ({
      id: lock.id,
      path: lock.path,
      owner: { name: lock.owner?.name ?? '' },
      lockedAt: new Date(lock.locked_at),
      ...(ours === undefined ? {} : { ours }),
    });
    if (!data) {
      return [];
    }
    return Array.isArray(data)
      ? data.map((lock) => convert(lock))
      : [
          ...(data.ours ?? []).map((lock) => convert(lock, true)),
          ...(data.theirs ?? []).map((lock) => convert(lock, false)),
        ];
  }

  private lfsCheckout(
    patterns: string | [string],
    opts: LfsCheckoutOpts & { to: string } & ExecOpts,
  ): Promise<void>;
  private lfsCheckout(
    patterns?: string | string[],
    opts?: LfsCheckoutOpts & { to?: '' } & ExecOpts,
  ): Promise<void>;
  private async lfsCheckout(
    patterns?: string | string[],
    opts?: LfsCheckoutOpts & ExecOpts,
  ): Promise<void> {
    if (this._lfsMode === 'disabled') {
      return;
    }

    const args = ['lfs', 'checkout'];

    validateOptions('lfsCheckout', opts);
    validateInput('lfsCheckout', { ...opts, patterns });
    for (const stage of ['base', 'ours', 'theirs'] as const) {
      if (opts?.[stage]) {
        args.push(`--${stage}`);
      }
    }
    if (opts?.to !== undefined) {
      args.push('--to', opts.to);
    }

    if (patterns) {
      const patternList = Array.isArray(patterns) ? patterns : [patterns];
      args.push(...patternList);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });
  }

  private async lfsMigrateInfo(opts?: LfsMigrateInfoOpts & ExecOpts): Promise<string> {
    validateOptions('lfsMigrateInfo', opts);
    if (this._lfsMode === 'disabled') {
      return '';
    }
    const args = ['lfs', 'migrate', 'info'];
    this.appendMigrateArgs(args, opts);
    for (const key of ['above', 'top', 'unit', 'pointers'] as const) {
      if (opts?.[key] !== undefined) {
        args.push(`--${key}=${opts[key]}`);
      }
    }
    if (opts?.fixup) {
      args.push('--fixup');
    }
    if (opts?.refs) {
      args.push('--', ...(Array.isArray(opts.refs) ? opts.refs : [opts.refs]));
    }
    const result = await this.runner.runOrThrow(this.context, args, { signal: opts?.signal });
    return result.stdout;
  }

  private async lfsMigrateImport(opts?: LfsMigrateImportOpts & ExecOpts): Promise<void> {
    validateOptions('lfsMigrateImport', opts);
    if (this._lfsMode === 'disabled') {
      return;
    }
    const args = ['lfs', 'migrate', 'import'];
    this.appendMigrateArgs(args, opts);
    if (opts?.above !== undefined) {
      args.push(`--above=${opts.above}`);
    }
    if (opts?.fixup) {
      args.push('--fixup');
    }
    if (opts?.noRewrite) {
      args.push('--no-rewrite');
    }
    if (opts?.verbose) {
      args.push('--verbose');
    }
    if (opts?.objectMap !== undefined) {
      args.push(`--object-map=${opts.objectMap}`);
    }
    if (opts?.message !== undefined) {
      args.push(`--message=${opts.message}`);
    }
    const operands = opts?.noRewrite ? opts.files : opts?.refs;
    if (operands) {
      args.push('--', ...(Array.isArray(operands) ? operands : [operands]));
    }
    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });
  }

  private async lfsMigrateExport(opts: LfsMigrateExportOpts & ExecOpts): Promise<void> {
    validateOptions('lfsMigrateExport', opts);
    if (this._lfsMode === 'disabled') {
      return;
    }
    const args = ['lfs', 'migrate', 'export'];
    this.appendMigrateArgs(args, opts);
    if (opts.remote !== undefined) {
      args.push(`--remote=${opts.remote}`);
    }
    if (opts.verbose) {
      args.push('--verbose');
    }
    if (opts.objectMap !== undefined) {
      args.push(`--object-map=${opts.objectMap}`);
    }
    if (opts.refs) {
      args.push('--', ...(Array.isArray(opts.refs) ? opts.refs : [opts.refs]));
    }
    await this.runner.runOrThrow(this.context, args, {
      signal: opts.signal,
      onProgress: opts.onProgress,
    });
  }

  private appendMigrateArgs(
    args: string[],
    opts?: Pick<
      LfsMigrateInfoOpts,
      'everything' | 'include' | 'exclude' | 'includeRef' | 'excludeRef' | 'skipFetch' | 'yesReally'
    >,
  ): void {
    if (opts?.everything) {
      args.push('--everything');
    }
    for (const key of ['include', 'exclude'] as const) {
      const value = opts?.[key];
      // Cobra StringVar replaces preceding values. Emit one comma-separated filter.
      if (value !== undefined) {
        args.push(`--${key}=${Array.isArray(value) ? value.join(',') : value}`);
      }
    }
    for (const [key, flag] of [
      ['includeRef', '--include-ref'],
      ['excludeRef', '--exclude-ref'],
    ] as const) {
      const value = opts?.[key];
      if (value !== undefined) {
        for (const ref of Array.isArray(value) ? value : [value]) {
          args.push(`${flag}=${ref}`);
        }
      }
    }
    if (opts?.skipFetch) {
      args.push('--skip-fetch');
    }
    if (opts?.yesReally) {
      args.push('--yes');
    }
  }

  private async lfsEnv(opts?: ExecOpts): Promise<LfsEnvInfo> {
    const result = await this.runner.runOrThrow(this.context, ['lfs', 'env'], {
      signal: opts?.signal,
    });

    const info: LfsEnvInfo = {
      gitVersion: '',
      lfsVersion: '',
      endpoint: '',
    };

    for (const line of parseLines(result.stdout)) {
      if (line.startsWith('git version')) {
        info.gitVersion = line.replace('git version ', '').trim();
      } else if (line.startsWith('git-lfs/')) {
        info.lfsVersion = line.split(' ')[0]?.replace('git-lfs/', '') ?? '';
      } else if (line.startsWith('Endpoint=')) {
        info.endpoint = line.replace('Endpoint=', '').trim();
      } else if (line.startsWith('  SSH=')) {
        info.sshEndpoint = line.replace('  SSH=', '').trim();
      } else if (line.startsWith('LocalWorkingDir=')) {
        info.localWorkingDir = line.replace('LocalWorkingDir=', '').trim();
      } else if (line.startsWith('LocalGitDir=')) {
        info.localGitDir = line.replace('LocalGitDir=', '').trim();
      } else if (line.startsWith('LocalGitStorageDir=')) {
        info.localGitStorageDir = line.replace('LocalGitStorageDir=', '').trim();
      } else if (line.startsWith('LocalMediaDir=')) {
        info.localMediaDir = line.replace('LocalMediaDir=', '').trim();
      } else if (line.startsWith('LocalReferenceDirs=')) {
        info.localReferenceDirs = line.replace('LocalReferenceDirs=', '').trim();
      } else if (line.startsWith('TempDir=')) {
        info.tempDir = line.replace('TempDir=', '').trim();
      } else if (line.startsWith('ConcurrentTransfers=')) {
        info.concurrentTransfers = Number.parseInt(
          line.replace('ConcurrentTransfers=', '').trim(),
          10,
        );
      } else if (line.startsWith('TusTransfers=')) {
        info.tusTransfers = line.replace('TusTransfers=', '').trim() === 'true';
      } else if (line.startsWith('BasicTransfersOnly=')) {
        info.basicTransfersOnly = line.replace('BasicTransfersOnly=', '').trim() === 'true';
      } else if (line.startsWith('SkipDownloadErrors=')) {
        info.skipDownloadErrors = line.replace('SkipDownloadErrors=', '').trim() === 'true';
      } else if (line.startsWith('FetchRecentAlways=')) {
        info.fetchRecentAlways = line.replace('FetchRecentAlways=', '').trim() === 'true';
      } else if (line.startsWith('FetchRecentRefsDays=')) {
        info.fetchRecentRefsDays = Number.parseInt(
          line.replace('FetchRecentRefsDays=', '').trim(),
          10,
        );
      } else if (line.startsWith('FetchRecentCommitsDays=')) {
        info.fetchRecentCommitsDays = Number.parseInt(
          line.replace('FetchRecentCommitsDays=', '').trim(),
          10,
        );
      } else if (line.startsWith('FetchRecentRefsIncludeRemotes=')) {
        info.fetchRecentRefsIncludeRemotes =
          line.replace('FetchRecentRefsIncludeRemotes=', '').trim() === 'true';
      } else if (line.startsWith('PruneOffsetDays=')) {
        info.pruneOffsetDays = Number.parseInt(line.replace('PruneOffsetDays=', '').trim(), 10);
      } else if (line.startsWith('PruneVerifyRemoteAlways=')) {
        info.pruneVerifyRemoteAlways =
          line.replace('PruneVerifyRemoteAlways=', '').trim() === 'true';
      } else if (line.startsWith('PruneRemoteName=')) {
        info.pruneRemoteName = line.replace('PruneRemoteName=', '').trim();
      } else if (line.startsWith('AccessDownload=')) {
        info.accessDownload = line.replace('AccessDownload=', '').trim();
      } else if (line.startsWith('AccessUpload=')) {
        info.accessUpload = line.replace('AccessUpload=', '').trim();
      }
    }

    return info;
  }

  private async lfsVersion(opts?: ExecOpts): Promise<string> {
    const result = await this.runner.runOrThrow(this.context, ['lfs', 'version'], {
      signal: opts?.signal,
    });

    // Format: "git-lfs/3.4.0 (GitHub; linux amd64; go 1.21.1)"
    const match = result.stdout.match(/git-lfs\/(\S+)/);
    return match?.[1] ?? result.stdout.trim();
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
  ): Promise<WorktreeRepo> {
    validateOptions('worktreeAdd', opts);
    const args = ['worktree', 'add'];

    if (opts?.detach) {
      args.push('--detach');
    }

    if (opts?.track) {
      args.push('--track');
    }

    // New options
    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.checkout === true) {
      args.push('--checkout');
    } else if (opts?.checkout === false) {
      args.push('--no-checkout');
    }

    if (opts?.lock) {
      args.push('--lock');
    }

    if (opts?.orphan) {
      args.push('--orphan');
    }

    // -b must come before path
    if (opts?.branch && !(opts.detach || opts.orphan)) {
      args.push('-b', opts.branch);
    }

    args.push(path);

    // Add commit-ish after path (e.g., branch name, tag, or commit hash)
    if (opts?.commitish) {
      args.push(opts.commitish);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });

    // Return a new WorktreeRepo for the newly created worktree, preserving LFS mode
    return new WorktreeRepoImpl(this.runner, path, { lfs: this._lfsMode });
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

  private async worktreePrune(opts?: WorktreePruneOpts & ExecOpts): Promise<string[]> {
    const args = ['worktree', 'prune'];

    if (opts?.dryRun) {
      args.push('--dry-run');
    }

    if (opts?.verbose) {
      args.push('--verbose');
    }

    // New options
    if (opts?.expire) {
      args.push(`--expire=${opts.expire}`);
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

  private async worktreeMove(
    src: string,
    dst: string,
    opts?: WorktreeMoveOpts & ExecOpts,
  ): Promise<WorktreeRepo> {
    const args = ['worktree', 'move'];

    if (opts?.force) {
      args.push('--force');
    }

    args.push(src, dst);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    // Return a new WorktreeRepo for the worktree at the new location, preserving LFS mode
    return new WorktreeRepoImpl(this.runner, dst, { lfs: this._lfsMode });
  }

  private async worktreeRepair(paths?: string[], opts?: ExecOpts): Promise<void> {
    const args = ['worktree', 'repair'];

    if (paths && paths.length > 0) {
      args.push(...paths);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // High-level API - add
  // ==========================================================================

  public add(paths: [], opts: AddOpts & { pathspecFromFile: string } & ExecOpts): Promise<void>;
  public add(
    paths: string | string[],
    opts?: AddOpts & { pathspecFromFile?: never } & ExecOpts,
  ): Promise<void>;
  public async add(paths: string | string[], opts?: AddOpts & ExecOpts): Promise<void> {
    validatePathInput('add', paths, opts);
    validateOptions('add', opts);
    const args = ['add'];

    // Verbosity
    if (opts?.verbose) {
      args.push('--verbose');
    }

    // Main options
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

    // New options
    if (opts?.intentToAdd) {
      args.push('--intent-to-add');
    }

    if (opts?.renormalize) {
      args.push('--renormalize');
    }

    if (opts?.ignoreRemoval) {
      args.push('--ignore-removal');
    }

    if (opts?.refresh) {
      args.push('--refresh');
    }

    if (opts?.ignoreErrors) {
      args.push('--ignore-errors');
    }

    if (opts?.ignoreMissing) {
      args.push('--ignore-missing');
    }

    if (opts?.sparse) {
      args.push('--sparse');
    }

    if (opts?.chmod) {
      args.push(`--chmod=${opts.chmod}`);
    }

    if (opts?.pathspecFromFile) {
      args.push(`--pathspec-from-file=${opts.pathspecFromFile}`);
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

  private async branchList(opts?: BranchOpts & ExecOpts): Promise<BranchInfo[]> {
    const args = [
      'branch',
      '--list',
      '--format=%(refname:short)%00%(objectname:short)%00%(upstream:short)%00%(upstream:track,nobracket)%00%(HEAD)',
    ];

    // Existing options
    if (opts?.all) {
      args.push('--all');
    }

    if (opts?.remotes) {
      args.push('--remotes');
    }

    // New options
    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.contains) {
      args.push(`--contains=${opts.contains}`);
    }

    if (opts?.noContains) {
      args.push(`--no-contains=${opts.noContains}`);
    }

    if (opts?.abbrev !== undefined) {
      args.push(`--abbrev=${opts.abbrev}`);
    }

    if (opts?.merged) {
      args.push(`--merged=${opts.merged}`);
    }

    if (opts?.noMerged) {
      args.push(`--no-merged=${opts.noMerged}`);
    }

    if (opts?.sort) {
      args.push(`--sort=${opts.sort}`);
    }

    if (opts?.pointsAt) {
      args.push(`--points-at=${opts.pointsAt}`);
    }

    if (opts?.ignoreCase) {
      args.push('--ignore-case');
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    const branches: BranchInfo[] = [];
    for (const line of parseLines(result.stdout)) {
      const parts = line.split('\0');
      const name = parts[0];
      const commit = parts[1];
      const upstream = parts[2];
      const trackInfo = parts[3];
      const head = parts[4];
      if (name !== undefined && commit !== undefined) {
        branches.push({
          name,
          commit,
          current: head === '*',
          upstream: upstream || undefined,
          gone: trackInfo?.includes('gone'),
        });
      }
    }

    return branches;
  }

  private async branchCurrent(opts?: ExecOpts): Promise<string | null> {
    const args = ['symbolic-ref', '--quiet', '--short', 'HEAD'];
    const result = await this.runner.run(this.context, args, opts);
    if (result.exitCode === 1 && !result.aborted) {
      return null;
    }
    this.runner.checkResult(this.context, args, result);
    return result.stdout.trim();
  }

  private async branchCreate(name: string, opts?: BranchCreateOpts & ExecOpts): Promise<void> {
    const args = ['branch'];

    // Existing options
    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.track) {
      args.push('--track');
    }

    // New options
    if (opts?.setUpstreamTo) {
      args.push(`--set-upstream-to=${opts.setUpstreamTo}`);
    }

    if (opts?.createReflog) {
      args.push('--create-reflog');
    }

    if (opts?.recurseSubmodules) {
      args.push('--recurse-submodules');
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

  // Overload: branch switching mode
  public async checkout(target: string, opts?: CheckoutBranchOpts & ExecOpts): Promise<void>;
  // Overload: pathspec mode
  public checkout(
    paths: [],
    opts: CheckoutPathOpts & { pathspecFromFile: string } & ExecOpts,
  ): Promise<void>;
  public checkout(
    paths: string[],
    opts?: CheckoutPathOpts & { pathspecFromFile?: never } & ExecOpts,
  ): Promise<void>;
  // Implementation
  public async checkout(
    targetOrPaths: string | string[],
    opts?: (CheckoutBranchOpts | CheckoutPathOpts) & ExecOpts,
  ): Promise<void> {
    validateOptions(Array.isArray(targetOrPaths) ? 'checkoutPath' : 'checkoutBranch', opts);
    const args = ['checkout'];

    // Determine mode based on first argument type
    const isPathMode = Array.isArray(targetOrPaths);

    if (isPathMode) {
      validatePathInput('checkout', targetOrPaths as string[], opts as CheckoutPathOpts);
      // Pathspec mode: git checkout [<tree-ish>] -- <pathspec>...
      const pathOpts = opts as (CheckoutPathOpts & ExecOpts) | undefined;

      if (pathOpts?.force) {
        args.push('--force');
      }

      if (pathOpts?.quiet) {
        args.push('--quiet');
      }

      if (pathOpts?.overlay !== undefined) {
        args.push(pathOpts.overlay ? '--overlay' : '--no-overlay');
      }

      if (pathOpts?.ours) {
        args.push('--ours');
      }

      if (pathOpts?.theirs) {
        args.push('--theirs');
      }

      if (pathOpts?.pathspecFromFile) {
        args.push(`--pathspec-from-file=${pathOpts.pathspecFromFile}`);
      }

      // Add source tree-ish if specified
      if (pathOpts?.source) {
        args.push(pathOpts.source);
      }

      // Add -- separator and pathspecs
      args.push('--');
      args.push(...targetOrPaths);
    } else {
      // Branch switching mode: git checkout <branch>
      const branchOpts = opts as (CheckoutBranchOpts & ExecOpts) | undefined;

      if (branchOpts?.force) {
        args.push('--force');
      }

      if (branchOpts?.forceCreateBranch) {
        args.push('-B');
      } else if (branchOpts?.createBranch) {
        args.push('-b');
      }

      if (branchOpts?.track) {
        args.push('--track');
      }

      if (branchOpts?.createReflog) {
        args.push('-l');
      }

      if (branchOpts?.guess !== undefined) {
        args.push(branchOpts.guess ? '--guess' : '--no-guess');
      }

      if (branchOpts?.quiet) {
        args.push('--quiet');
      }

      if (branchOpts?.recurseSubmodules) {
        args.push('--recurse-submodules');
      }

      if (branchOpts?.merge) {
        args.push('--merge');
      }

      if (branchOpts?.conflict) {
        args.push(`--conflict=${branchOpts.conflict}`);
      }

      if (branchOpts?.detach) {
        args.push('--detach');
      }

      if (branchOpts?.orphan) {
        args.push('--orphan');
      }

      if (branchOpts?.overwriteIgnore === false) {
        args.push('--no-overwrite-ignore');
      }

      if (branchOpts?.ignoreOtherWorktrees) {
        args.push('--ignore-other-worktrees');
      }

      args.push(targetOrPaths);

      if (branchOpts?.startPoint) {
        args.push(branchOpts.startPoint);
      }
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      env: this.lfsModeEnv(),
    });
  }

  // ==========================================================================
  // High-level API - commit
  // ==========================================================================

  public async commit(opts?: CommitOpts & ExecOpts): Promise<CommitResult> {
    validateOptions('commit', opts);
    const args = ['commit'];

    // Existing options
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

    if (opts?.noVerify) {
      args.push('--no-verify');
    }

    if (opts?.gpgSign) {
      args.push('-S');
    }
    if (opts?.noGpgSign) {
      args.push('--no-gpg-sign');
    }

    // New options
    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.verbose) {
      args.push('--verbose');
    }

    if (opts?.file) {
      args.push('--file', opts.file);
    }

    if (opts?.reuseMessage) {
      args.push('--reuse-message', opts.reuseMessage);
    }

    if (opts?.fixup) {
      args.push('--fixup', opts.fixup);
    }

    if (opts?.squash) {
      args.push('--squash', opts.squash);
    }

    if (opts?.resetAuthor) {
      args.push('--reset-author');
    }

    if (opts?.trailer) {
      const trailers = Array.isArray(opts.trailer) ? opts.trailer : [opts.trailer];
      for (const trailer of trailers) {
        args.push('--trailer', trailer);
      }
    }

    if (opts?.signoff) {
      args.push('--signoff');
    }

    if (opts?.cleanup) {
      args.push(`--cleanup=${opts.cleanup}`);
    }

    if (opts?.include) {
      args.push('--include');
    }

    if (opts?.only) {
      args.push('--only');
    }

    if (opts?.noPostRewrite) {
      args.push('--no-post-rewrite');
    }

    if (opts?.untrackedFiles) {
      args.push(`--untracked-files=${opts.untrackedFiles}`);
    }

    if (opts?.pathspecFromFile) {
      args.push(`--pathspec-from-file=${opts.pathspecFromFile}`);
    }

    if (opts?.allowEmptyMessage) {
      args.push('--allow-empty-message');
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    // Parse commit output
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

    branch = (await this.branchCurrent(opts)) ?? 'HEAD';

    const stats = await this.runner.runOrThrow(
      this.context,
      ['diff-tree', '--root', '--no-commit-id', '--numstat', '-r', '-z', '-M', hash],
      opts,
    );
    const records = parseRecords(stats.stdout);
    // biome-ignore lint/style/useForOf: rename records consume two additional paths
    for (let i = 0; i < records.length; i++) {
      const record = records[i]!;
      const match = record.match(/^(\d+|-)\t(\d+|-)\t([\s\S]*)$/);
      if (!match) {
        throw new GitError('ParseError', 'Invalid commit numstat record');
      }
      filesChanged++;
      if (match[1] !== '-') {
        insertions += Number(match[1]);
      }
      if (match[2] !== '-') {
        deletions += Number(match[2]);
      }
      if (match[3] === '') {
        i += 2; // Rename source and destination are separate NUL records.
      }
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

  public diff(
    target: string | undefined,
    opts: DiffOpts & { nameOnly: true } & ExecOpts,
  ): Promise<string[]>;
  public diff(
    target?: string,
    opts?: DiffOpts & { nameOnly?: false } & ExecOpts,
  ): Promise<DiffResult>;
  public diff(target?: string, opts?: DiffOpts & ExecOpts): Promise<DiffResult | string[]>;
  public async diff(target?: string, opts?: DiffOpts & ExecOpts): Promise<DiffResult | string[]> {
    validateOptions('diff', opts);
    const args = ['diff', '--no-ext-diff', '--no-textconv', '--no-color'];
    if (opts?.nameOnly || opts?.nameStatus) {
      args.push('-z');
    }

    // Existing options
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

    if (opts?.context !== undefined) {
      args.push(`-U${opts.context}`);
    }

    if (opts?.ignoreWhitespace) {
      args.push('-w');
    }

    // New options
    if (opts?.nullTerminated) {
      args.push('-z');
    }

    if (opts?.patch) {
      args.push('-p');
    }

    if (opts?.patchWithRaw) {
      args.push('--patch-with-raw');
    }

    if (opts?.numstat) {
      args.push('--numstat');
    }

    if (opts?.patchWithStat) {
      args.push('--patch-with-stat');
    }

    if (opts?.fullIndex) {
      args.push('--full-index');
    }

    if (opts?.abbrev !== undefined) {
      args.push(`--abbrev=${opts.abbrev}`);
    }

    if (opts?.reverse) {
      args.push('-R');
    }

    if (opts?.detectRewrites !== undefined) {
      if (opts.detectRewrites === true) {
        args.push('-B');
      } else if (typeof opts.detectRewrites === 'string') {
        args.push(`-B${opts.detectRewrites}`);
      }
    }

    if (opts?.detectRenames !== undefined) {
      if (opts.detectRenames === true) {
        args.push('-M');
      } else if (typeof opts.detectRenames === 'string') {
        args.push(`-M${opts.detectRenames}`);
      }
    }

    if (opts?.detectCopies !== undefined) {
      if (opts.detectCopies === true) {
        args.push('-C');
      } else if (typeof opts.detectCopies === 'string') {
        args.push(`-C${opts.detectCopies}`);
      }
    }

    if (opts?.findCopiesHarder) {
      args.push('--find-copies-harder');
    }

    if (opts?.renameLimit !== undefined) {
      args.push(`-l${opts.renameLimit}`);
    }

    if (opts?.pickaxe) {
      args.push(`-S${opts.pickaxe}`);
    }

    if (opts?.pickaxeAll) {
      args.push('--pickaxe-all');
    }

    if (opts?.text) {
      args.push('--text');
    }

    if (opts?.mergeBase) {
      args.push('--merge-base');
    }

    if (opts?.wordDiff) {
      args.push(`--word-diff=${opts.wordDiff}`);
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

    if (opts?.nameOnly) {
      return parseRecords(result.stdout);
    }
    if (opts?.nameStatus) {
      const records = parseRecords(result.stdout);
      const files: DiffEntry[] = [];
      for (let i = 0; i < records.length; ) {
        const code = records[i++]!;
        if (!/^[AMDRTCUXB][0-9]*$/.test(code)) {
          throw new GitError('ParseError', 'Invalid diff status');
        }
        const oldPath = records[i++];
        const renamed = code[0] === 'R' || code[0] === 'C';
        const path = renamed ? records[i++] : oldPath;
        if (oldPath === undefined || path === undefined) {
          throw new GitError('ParseError', 'Missing diff path');
        }
        files.push({
          status: code[0] as DiffEntry['status'],
          path,
          ...(renamed ? { oldPath, similarity: Number(code.slice(1)) } : {}),
        });
      }
      return { files };
    }
    return { files: [], raw: result.stdout };
  }

  // ==========================================================================
  // High-level API - merge
  // ==========================================================================

  public async merge(branch: string, opts?: MergeOpts & ExecOpts): Promise<MergeResult> {
    validateOptions('merge', opts);
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

    if (opts?.quit) {
      await this.runner.runOrThrow(this.context, ['merge', '--quit'], opts);
      return { success: true };
    }
    const args = ['merge'];

    // Existing options
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

    if (opts?.noVerify) {
      args.push('--no-verify');
    }

    // New options
    if (opts?.noDiffstat) {
      args.push('-n');
    } else if (opts?.stat) {
      args.push('--stat');
    }

    if (opts?.compactSummary) {
      args.push('--compact-summary');
    }

    if (opts?.log !== undefined) {
      if (opts.log === true) {
        args.push('--log');
      } else if (typeof opts.log === 'number') {
        args.push(`--log=${opts.log}`);
      }
    }

    if (opts?.cleanup) {
      args.push(`--cleanup=${opts.cleanup}`);
    }

    if (opts?.rerereAutoupdate !== undefined) {
      args.push(opts.rerereAutoupdate ? '--rerere-autoupdate' : '--no-rerere-autoupdate');
    }

    if (opts?.verifySignatures) {
      args.push('--verify-signatures');
    }

    if (opts?.verbose) {
      args.push('--verbose');
    }

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.allowUnrelatedHistories) {
      args.push('--allow-unrelated-histories');
    }

    if (opts?.gpgSign !== undefined) {
      if (opts.gpgSign === true) {
        args.push('-S');
      } else if (typeof opts.gpgSign === 'string') {
        args.push(`-S${opts.gpgSign}`);
      }
    }

    if (opts?.autostash) {
      args.push('--autostash');
    }

    if (opts?.overwriteIgnore === false) {
      args.push('--no-overwrite-ignore');
    }

    if (opts?.signoff) {
      args.push('--signoff');
    }

    if (opts?.intoName) {
      args.push(`--into-name=${opts.intoName}`);
    }

    args.push(branch);

    const result = await this.runner.run(this.context, args, {
      signal: opts?.signal,
      env: this.lfsModeEnv(),
    });

    if (result.aborted) {
      this.runner.checkResult(this.context, args, result);
    }
    if (result.exitCode !== 0) {
      // Only actual merge conflicts are represented as a result. Other failures throw.
      const statusResult = await this.runner.runOrThrow(
        this.context,
        ['status', '--porcelain=v2', '-z'],
        { signal: opts?.signal },
      );
      const conflicts = parsePorcelainV2(statusResult.stdout)
        .filter((entry) => entry.type === 'unmerged')
        .map((entry) => entry.path);
      if (conflicts.length === 0) {
        this.runner.checkResult(this.context, args, result);
      }
      return { success: false, conflicts };
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

  public async pull(opts?: PullOpts & ExecOpts): Promise<void> {
    validateOptions('pull', opts);
    const args = ['pull'];

    // Progress tracking (git and/or LFS progress are streamed over stderr)
    if (opts?.onProgress || opts?.onLfsProgress) {
      args.push('--progress');
    }

    // Existing options
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

    // New options
    if (opts?.verbose) {
      args.push('--verbose');
    }

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.recurseSubmodules !== undefined) {
      if (opts.recurseSubmodules === true || opts.recurseSubmodules === 'yes') {
        args.push('--recurse-submodules=yes');
      } else if (opts.recurseSubmodules === 'on-demand') {
        args.push('--recurse-submodules=on-demand');
      } else if (opts.recurseSubmodules === 'no' || opts.recurseSubmodules === false) {
        args.push('--recurse-submodules=no');
      }
    }

    if (opts?.noStat) {
      args.push('-n');
    } else if (opts?.stat) {
      args.push('--stat');
    }

    if (opts?.compactSummary) {
      args.push('--compact-summary');
    }

    if (opts?.log !== undefined) {
      if (opts.log === true) {
        args.push('--log');
      } else if (typeof opts.log === 'number') {
        args.push(`--log=${opts.log}`);
      }
    }

    if (opts?.signoff) {
      args.push('--signoff');
    }

    if (opts?.squash) {
      args.push('--squash');
    }

    if (opts?.commit !== undefined) {
      args.push(opts.commit ? '--commit' : '--no-commit');
    }

    if (opts?.cleanup) {
      args.push(`--cleanup=${opts.cleanup}`);
    }

    if (opts?.verify !== undefined) {
      args.push(opts.verify ? '--verify' : '--no-verify');
    }

    if (opts?.verifySignatures) {
      args.push('--verify-signatures');
    }

    if (opts?.autostash) {
      args.push('--autostash');
    }

    if (opts?.strategy) {
      args.push(`--strategy=${opts.strategy}`);
    }

    if (opts?.strategyOption) {
      const strategyOpts = Array.isArray(opts.strategyOption)
        ? opts.strategyOption
        : [opts.strategyOption];
      for (const opt of strategyOpts) {
        args.push('-X', opt);
      }
    }

    if (opts?.gpgSign !== undefined) {
      if (opts.gpgSign === true) {
        args.push('-S');
      } else if (typeof opts.gpgSign === 'string') {
        args.push(`-S${opts.gpgSign}`);
      }
    }

    if (opts?.allowUnrelatedHistories) {
      args.push('--allow-unrelated-histories');
    }

    if (opts?.all) {
      args.push('--all');
    }

    if (opts?.append) {
      args.push('--append');
    }

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.jobs !== undefined) {
      args.push(`--jobs=${opts.jobs}`);
    }

    if (opts?.dryRun) {
      args.push('--dry-run');
    }

    if (opts?.keep) {
      args.push('--keep');
    }

    if (opts?.depth !== undefined) {
      args.push(`--depth=${opts.depth}`);
    }

    if (opts?.shallowSince) {
      const since =
        opts.shallowSince instanceof Date ? opts.shallowSince.toISOString() : opts.shallowSince;
      args.push(`--shallow-since=${since}`);
    }

    if (opts?.shallowExclude) {
      const excludes = Array.isArray(opts.shallowExclude)
        ? opts.shallowExclude
        : [opts.shallowExclude];
      for (const exclude of excludes) {
        args.push(`--shallow-exclude=${exclude}`);
      }
    }

    if (opts?.deepen !== undefined) {
      args.push(`--deepen=${opts.deepen}`);
    }

    if (opts?.unshallow) {
      args.push('--unshallow');
    }

    if (opts?.updateShallow) {
      args.push('--update-shallow');
    }

    if (opts?.ipv4) {
      args.push('--ipv4');
    }

    if (opts?.ipv6) {
      args.push('--ipv6');
    }

    if (opts?.setUpstream) {
      args.push('--set-upstream');
    }

    // Remote and branch (must be last)
    if (opts?.remote) {
      args.push(opts.remote);
    }

    if (opts?.branch) {
      args.push(opts.branch);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
      onLfsProgress: opts?.onLfsProgress,
      env: this.lfsModeEnv(),
    });
  }

  // ==========================================================================
  // High-level API - reset
  // ==========================================================================

  public async reset(target?: string, opts?: ResetOpts & ExecOpts): Promise<void> {
    validateOptions('reset', opts);
    const args = ['reset'];

    // Existing options
    if (opts?.mode) {
      args.push(`--${opts.mode}`);
    }

    // New options
    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.noRefresh) {
      args.push('--no-refresh');
    }

    if (opts?.recurseSubmodules) {
      args.push('--recurse-submodules');
    }

    if (opts?.intentToAdd) {
      args.push('--intent-to-add');
    }

    if (opts?.pathspecFromFile) {
      args.push(`--pathspec-from-file=${opts.pathspecFromFile}`);
    }

    if (target) {
      args.push(target);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      env: this.lfsModeEnv(),
    });
  }

  // ==========================================================================
  // High-level API - rm
  // ==========================================================================

  public rm(paths: [], opts: RmOpts & { pathspecFromFile: string } & ExecOpts): Promise<void>;
  public rm(
    paths: string | string[],
    opts?: RmOpts & { pathspecFromFile?: never } & ExecOpts,
  ): Promise<void>;
  public async rm(paths: string | string[], opts?: RmOpts & ExecOpts): Promise<void> {
    validatePathInput('rm', paths, opts);
    const args = ['rm'];

    // Existing options
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

    // New options
    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.ignoreUnmatch) {
      args.push('--ignore-unmatch');
    }

    if (opts?.sparse) {
      args.push('--sparse');
    }

    if (opts?.pathspecFromFile) {
      args.push(`--pathspec-from-file=${opts.pathspecFromFile}`);
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

  private async stashList(opts?: ExecOpts): Promise<StashEntry[]> {
    const result = await this.runner.runOrThrow(
      this.context,
      ['stash', 'list', '-z', '--format=%gd%x00%H%x00%gs'],
      opts,
    );
    const fields = parseRecords(result.stdout);
    if (fields.length % 3 !== 0) {
      throw new GitError('ParseError', 'Invalid stash record');
    }
    const entries: StashEntry[] = [];
    for (let i = 0; i < fields.length; i += 3) {
      const index = fields[i]?.match(/^stash@\{(\d+)\}$/)?.[1];
      if (index === undefined || !fields[i + 1]) {
        throw new GitError('ParseError', 'Invalid stash metadata');
      }
      const subject = fields[i + 2]!;
      const context = subject.match(/^(?:WIP on|On) (.*?): ([\s\S]*)$/);
      entries.push({
        index: Number(index),
        commit: fields[i + 1]!,
        message: context?.[2] ?? subject,
        ...(context ? { branch: context[1] } : {}),
      });
    }
    return entries;
  }

  private async stashPush(opts?: StashPushOpts & ExecOpts): Promise<void> {
    validateOptions('stashPush', opts);
    const args = ['stash', 'push'];

    // Existing options
    if (opts?.message) {
      args.push('-m', opts.message);
    }

    if (opts?.includeUntracked) {
      args.push('--include-untracked');
    }

    if (opts?.keepIndex !== undefined) {
      args.push(opts.keepIndex ? '--keep-index' : '--no-keep-index');
    }

    // New options
    if (opts?.staged) {
      args.push('--staged');
    }

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.all) {
      args.push('--all');
    }

    if (opts?.pathspecFromFile) {
      args.push(`--pathspec-from-file=${opts.pathspecFromFile}`);
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

  public async switch(branch: string, opts?: SwitchOpts & ExecOpts): Promise<void> {
    validateOptions('switch', opts);
    const args = ['switch'];

    // Existing options
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

    // New options
    if (opts?.guess !== undefined) {
      args.push(opts.guess ? '--guess' : '--no-guess');
    }

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.recurseSubmodules) {
      args.push('--recurse-submodules');
    }

    if (opts?.merge) {
      args.push('--merge');
    }

    if (opts?.conflict) {
      args.push(`--conflict=${opts.conflict}`);
    }

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.orphan) {
      args.push('--orphan');
    }

    if (opts?.overwriteIgnore === false) {
      args.push('--no-overwrite-ignore');
    }

    if (opts?.ignoreOtherWorktrees) {
      args.push('--ignore-other-worktrees');
    }

    args.push(branch);

    if (opts?.startPoint) {
      args.push(opts.startPoint);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      env: this.lfsModeEnv(),
    });
  }

  // ==========================================================================
  // High-level API - Tag Operations
  // ==========================================================================

  private async tagList(opts?: TagListOpts & ExecOpts): Promise<string[]> {
    const args = ['tag', '--list'];

    // Existing options
    if (opts?.sort) {
      args.push(`--sort=${opts.sort}`);
    }

    // New options
    if (opts?.lines !== undefined) {
      args.push(`-n${opts.lines}`);
    }

    if (opts?.contains) {
      args.push(`--contains=${opts.contains}`);
    }

    if (opts?.noContains) {
      args.push(`--no-contains=${opts.noContains}`);
    }

    if (opts?.merged) {
      args.push(`--merged=${opts.merged}`);
    }

    if (opts?.noMerged) {
      args.push(`--no-merged=${opts.noMerged}`);
    }

    if (opts?.pointsAt) {
      args.push(`--points-at=${opts.pointsAt}`);
    }

    if (opts?.ignoreCase) {
      args.push('--ignore-case');
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
    validateOptions('tagCreate', opts);
    const args = ['tag'];

    // Existing options
    if (opts?.sign) {
      args.push('-s');
    }

    if (opts?.message !== undefined) {
      // If signing with -s, we don't need -a (signed tags are always annotated)
      if (!opts.sign) {
        args.push('-a');
      }
      args.push('-m', opts.message);
    }

    if (opts?.force) {
      args.push('--force');
    }

    // New options
    if (opts?.file !== undefined) {
      // If using file, we need -a for annotated tag (unless signing)
      if (!(opts.sign || opts.message)) {
        args.push('-a');
      }
      args.push('--file', opts.file);
    }

    if (opts?.trailer) {
      const trailers = Array.isArray(opts.trailer) ? opts.trailer : [opts.trailer];
      for (const trailer of trailers) {
        args.push('--trailer', trailer);
      }
    }

    if (opts?.cleanup) {
      args.push(`--cleanup=${opts.cleanup}`);
    }

    if (opts?.localUser) {
      args.push(`--local-user=${opts.localUser}`);
    }

    if (opts?.createReflog) {
      args.push('--create-reflog');
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
      const messageLines: string[] = [];
      let inMessage = false;

      for (const line of lines) {
        if (line.startsWith('object ')) {
          commit = line.slice(7);
        } else if (line.startsWith('tagger ')) {
          const match = line.match(/^tagger (.+?) <(.+?)> (\d+)/);
          if (match) {
            const matchedName = match[1];
            const matchedEmail = match[2];
            const matchedTimestamp = match[3];
            if (
              matchedName !== undefined &&
              matchedEmail !== undefined &&
              matchedTimestamp !== undefined
            ) {
              taggerName = matchedName;
              taggerEmail = matchedEmail;
              taggerDate = new Date(Number.parseInt(matchedTimestamp, 10) * 1000);
            }
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
        tagger:
          taggerName && taggerDate
            ? {
                name: taggerName,
                email: taggerEmail,
                date: taggerDate,
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

  public async cherryPick(
    commits: string | string[],
    opts?: CherryPickOpts & ExecOpts,
  ): Promise<void> {
    validateOptions('cherryPick', opts);
    const args = ['cherry-pick'];
    const control = opts?.abort || opts?.continue || opts?.skip;
    if (opts?.abort) {
      args.push('--abort');
    }
    if (opts?.continue) {
      args.push('--continue');
    }
    if (opts?.skip) {
      args.push('--skip');
    }

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
      args.push('--strategy', opts.strategy);
    }

    // New options
    if (opts?.cleanup) {
      args.push('--cleanup', opts.cleanup);
    }

    if (opts?.rerereAutoupdate === true) {
      args.push('--rerere-autoupdate');
    } else if (opts?.rerereAutoupdate === false) {
      args.push('--no-rerere-autoupdate');
    }

    if (opts?.strategyOption) {
      const strategyOptions = Array.isArray(opts.strategyOption)
        ? opts.strategyOption
        : [opts.strategyOption];
      for (const so of strategyOptions) {
        args.push('-X', so);
      }
    }

    if (opts?.gpgSign === true) {
      args.push('-S');
    } else if (typeof opts?.gpgSign === 'string') {
      args.push(`-S${opts.gpgSign}`);
    }

    if (opts?.appendCommitName) {
      args.push('-x');
    }

    if (opts?.ff) {
      args.push('--ff');
    }

    if (opts?.allowEmpty) {
      args.push('--allow-empty');
    }

    if (opts?.allowEmptyMessage) {
      args.push('--allow-empty-message');
    }

    if (opts?.empty) {
      args.push('--empty', opts.empty);
    }

    if (!control) {
      const commitList = Array.isArray(commits) ? commits : [commits];
      args.push(...commitList);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // Medium Priority - clean
  // ==========================================================================

  public async clean(opts?: CleanOpts & ExecOpts): Promise<string[]> {
    validateOptions('clean', opts);
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

    // New options
    if (opts?.quiet) {
      args.push('-q');
    }

    if (opts?.exclude) {
      const excludes = Array.isArray(opts.exclude) ? opts.exclude : [opts.exclude];
      for (const pattern of excludes) {
        args.push('-e', pattern);
      }
    }

    if (opts?.paths && opts.paths.length > 0) {
      args.push('--', ...opts.paths);
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    // Parse cleaned/would-be-cleaned paths from output
    const cleaned: string[] = [];
    for (const line of parseLines(result.stdout)) {
      // Output is like "Removing file.txt" or "Would remove file.txt"
      const match = line.match(/^(?:Removing|Would remove) (.+)$/);
      const matchedPath = match?.[1];
      if (matchedPath !== undefined) {
        cleaned.push(matchedPath);
      }
    }

    return cleaned;
  }

  // ==========================================================================
  // Medium Priority - mv
  // ==========================================================================

  public async mv(source: string, destination: string, opts?: MvOpts & ExecOpts): Promise<void> {
    const args = ['mv'];

    if (opts?.force) {
      args.push('-f');
    }

    if (opts?.dryRun) {
      args.push('-n');
    }

    // New options
    if (opts?.verbose) {
      args.push('-v');
    }

    if (opts?.skipErrors) {
      args.push('-k');
    }

    if (opts?.sparse) {
      args.push('--sparse');
    }

    args.push(source, destination);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // Medium Priority - rebase
  // ==========================================================================

  public async rebase(opts?: RebaseOpts & ExecOpts): Promise<void> {
    validateOptions('rebase', opts);
    const args = ['rebase'];
    if (opts?.abort) {
      args.push('--abort');
    }
    if (opts?.continue) {
      args.push('--continue');
    }
    if (opts?.skip) {
      args.push('--skip');
    }

    if (opts?.onto) {
      args.push('--onto', opts.onto);
    }

    if (opts?.rebaseMerges) {
      args.push('--rebase-merges');
    }

    if (opts?.noVerify) {
      args.push('--no-verify');
    }

    // New options
    if (opts?.keepBase) {
      args.push('--keep-base');
    }

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.verbose) {
      args.push('--verbose');
    }

    if (opts?.signoff) {
      args.push('--signoff');
    }

    if (opts?.committerDateIsAuthorDate) {
      args.push('--committer-date-is-author-date');
    }

    if (opts?.resetAuthorDate) {
      args.push('--reset-author-date');
    }

    if (opts?.ignoreWhitespace) {
      args.push('--ignore-whitespace');
    }

    if (opts?.whitespace) {
      args.push('--whitespace', opts.whitespace);
    }

    if (opts?.forceRebase) {
      args.push('--force-rebase');
    }

    if (opts?.noFf) {
      args.push('--no-ff');
    }

    if (opts?.apply) {
      args.push('--apply');
    }

    if (opts?.rerereAutoupdate === true) {
      args.push('--rerere-autoupdate');
    } else if (opts?.rerereAutoupdate === false) {
      args.push('--no-rerere-autoupdate');
    }

    if (opts?.empty) {
      args.push('--empty', opts.empty);
    }

    if (opts?.autosquash === true) {
      args.push('--autosquash');
    } else if (opts?.autosquash === false) {
      args.push('--no-autosquash');
    }

    if (opts?.updateRefs === true) {
      args.push('--update-refs');
    } else if (opts?.updateRefs === false) {
      args.push('--no-update-refs');
    }

    if (opts?.gpgSign === true) {
      args.push('-S');
    } else if (typeof opts?.gpgSign === 'string') {
      args.push(`-S${opts.gpgSign}`);
    }

    if (opts?.autostash === true) {
      args.push('--autostash');
    } else if (opts?.autostash === false) {
      args.push('--no-autostash');
    }

    if (opts?.exec) {
      const execs = Array.isArray(opts.exec) ? opts.exec : [opts.exec];
      for (const cmd of execs) {
        args.push('--exec', cmd);
      }
    }

    if (opts?.forkPoint === true) {
      args.push('--fork-point');
    } else if (opts?.forkPoint === false) {
      args.push('--no-fork-point');
    }

    if (opts?.strategy) {
      args.push('--strategy', opts.strategy);
    }

    if (opts?.strategyOption) {
      const strategyOptions = Array.isArray(opts.strategyOption)
        ? opts.strategyOption
        : [opts.strategyOption];
      for (const so of strategyOptions) {
        args.push('-X', so);
      }
    }

    if (opts?.root) {
      args.push('--root');
    }

    if (opts?.rescheduleFailedExec === true) {
      args.push('--reschedule-failed-exec');
    } else if (opts?.rescheduleFailedExec === false) {
      args.push('--no-reschedule-failed-exec');
    }

    if (opts?.reapplyCherryPicks === true) {
      args.push('--reapply-cherry-picks');
    } else if (opts?.reapplyCherryPicks === false) {
      args.push('--no-reapply-cherry-picks');
    }

    if (opts?.upstream) {
      args.push(opts.upstream);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      env: this.lfsModeEnv(),
    });
  }

  // ==========================================================================
  // Medium Priority - restore
  // ==========================================================================

  public restore(
    paths: [],
    opts: RestoreOpts & { pathspecFromFile: string } & ExecOpts,
  ): Promise<void>;
  public restore(
    paths: string | string[],
    opts?: RestoreOpts & { pathspecFromFile?: never } & ExecOpts,
  ): Promise<void>;
  public async restore(paths: string | string[], opts?: RestoreOpts & ExecOpts): Promise<void> {
    validatePathInput('restore', paths, opts);
    validateOptions('restore', opts);
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
    }
    if (opts?.theirs) {
      args.push('--theirs');
    }

    // New options
    if (opts?.ignoreUnmerged) {
      args.push('--ignore-unmerged');
    }

    if (opts?.overlay === true) {
      args.push('--overlay');
    } else if (opts?.overlay === false) {
      args.push('--no-overlay');
    }

    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.recurseSubmodules === true) {
      args.push('--recurse-submodules');
    } else if (opts?.recurseSubmodules === false) {
      args.push('--no-recurse-submodules');
    }

    if (opts?.progress === true) {
      args.push('--progress');
    } else if (opts?.progress === false) {
      args.push('--no-progress');
    }

    if (opts?.merge) {
      args.push('--merge');
    }

    if (opts?.conflict) {
      args.push('--conflict', opts.conflict);
    }

    if (opts?.ignoreSkipWorktreeBits) {
      args.push('--ignore-skip-worktree-bits');
    }

    if (opts?.pathspecFromFile) {
      args.push('--pathspec-from-file', opts.pathspecFromFile);
    }

    const pathList = Array.isArray(paths) ? paths : [paths];
    args.push('--', ...pathList);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
      env: this.lfsModeEnv(),
    });
  }

  // ==========================================================================
  // Medium Priority - revert
  // ==========================================================================

  public async revert(commits: string | string[], opts?: RevertOpts & ExecOpts): Promise<void> {
    validateOptions('revert', opts);
    const args = ['revert'];
    const control = opts?.abort || opts?.continue || opts?.skip;
    if (opts?.abort) {
      args.push('--abort');
    }
    if (opts?.continue) {
      args.push('--continue');
    }
    if (opts?.skip) {
      args.push('--skip');
    }

    if (opts?.edit) {
      args.push('-e');
    }

    if (opts?.noCommit) {
      args.push('-n');
    }

    if (opts?.mainline !== undefined) {
      args.push('-m', opts.mainline.toString());
    }

    // New options
    if (opts?.cleanup) {
      args.push('--cleanup', opts.cleanup);
    }

    if (opts?.signoff) {
      args.push('--signoff');
    }

    if (opts?.rerereAutoupdate === true) {
      args.push('--rerere-autoupdate');
    } else if (opts?.rerereAutoupdate === false) {
      args.push('--no-rerere-autoupdate');
    }

    if (opts?.strategy) {
      args.push('--strategy', opts.strategy);
    }

    if (opts?.strategyOption) {
      const strategyOptions = Array.isArray(opts.strategyOption)
        ? opts.strategyOption
        : [opts.strategyOption];
      for (const so of strategyOptions) {
        args.push('-X', so);
      }
    }

    if (opts?.gpgSign === true) {
      args.push('-S');
    } else if (typeof opts?.gpgSign === 'string') {
      args.push(`-S${opts.gpgSign}`);
    }

    if (opts?.reference) {
      args.push('--reference');
    }

    if (!control) {
      const commitList = Array.isArray(commits) ? commits : [commits];
      args.push(...commitList);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // Medium Priority - show
  // ==========================================================================

  public async show(object: string, opts?: ShowOpts & ExecOpts): Promise<string> {
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

    // New options
    if (opts?.quiet) {
      args.push('--quiet');
    }

    if (opts?.source) {
      args.push('--source');
    }

    if (opts?.useMailmap) {
      args.push('--use-mailmap');
    }

    if (opts?.decorateRefs) {
      args.push('--decorate-refs', opts.decorateRefs);
    }

    if (opts?.decorateRefsExclude) {
      args.push('--decorate-refs-exclude', opts.decorateRefsExclude);
    }

    if (opts?.decorate) {
      args.push(`--decorate=${opts.decorate}`);
    }

    args.push(object);

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    return result.stdout;
  }

  // ==========================================================================
  // Plumbing Operations
  // ==========================================================================

  /**
   * Parse revision specification and return information about the repository
   *
   * Overloaded implementation handling all rev-parse variants.
   */
  public revParse(ref: string, opts?: RevParseRefOpts & ExecOpts): Promise<string>;
  public revParse(opts: RevParsePathQuery & RevParsePathOpts & ExecOpts): Promise<string>;
  public revParse(opts: RevParseBooleanQuery & ExecOpts): Promise<boolean>;
  public revParse(opts: RevParseListQuery & ExecOpts): Promise<string[]>;
  public revParse(
    opts: ExclusiveQuery<{ showObjectFormat: true | 'storage' | 'input' | 'output' }> & ExecOpts,
  ): Promise<string>;
  public revParse(opts: ExclusiveQuery<{ showRefFormat: true }> & ExecOpts): Promise<string>;
  public revParse(opts: ExclusiveQuery<{ localEnvVars: true }> & ExecOpts): Promise<string[]>;
  public async revParse(
    refOrOpts:
      | string
      | (RevParsePathQuery & RevParsePathOpts & ExecOpts)
      | (RevParseBooleanQuery & ExecOpts)
      | (RevParseListQuery & ExecOpts)
      | (ExclusiveQuery<{ showObjectFormat: true | 'storage' | 'input' | 'output' }> & ExecOpts)
      | (ExclusiveQuery<{ showRefFormat: true }> & ExecOpts)
      | (ExclusiveQuery<{ localEnvVars: true }> & ExecOpts),
    opts?: RevParseRefOpts & ExecOpts,
  ): Promise<string | boolean | string[]> {
    const args: string[] = ['rev-parse'];

    // Handle ref string case (first overload)
    if (typeof refOrOpts === 'string') {
      // Add ref resolution options
      if (opts?.verify) {
        args.push('--verify');
      }
      if (opts?.short !== undefined) {
        if (typeof opts.short === 'number') {
          args.push(`--short=${opts.short}`);
        } else if (opts.short) {
          args.push('--short');
        }
      }
      if (opts?.abbrevRef !== undefined) {
        if (opts.abbrevRef === 'strict') {
          args.push('--abbrev-ref=strict');
        } else if (opts.abbrevRef === 'loose') {
          args.push('--abbrev-ref=loose');
        } else if (opts.abbrevRef) {
          args.push('--abbrev-ref');
        }
      }
      if (opts?.symbolic) {
        args.push('--symbolic');
      }
      if (opts?.symbolicFullName) {
        args.push('--symbolic-full-name');
      }
      if (opts?.quiet) {
        args.push('--quiet');
      }

      args.push(refOrOpts);

      const result = await this.runner.runOrThrow(this.context, args, {
        signal: opts?.signal,
      });
      return result.stdout.trim();
    }

    validateRevParseQuery(refOrOpts);
    if ('pathFormat' in refOrOpts && refOrOpts.pathFormat) {
      args.push(`--path-format=${refOrOpts.pathFormat}`);
    }

    // Handle options object cases
    const queryOpts = refOrOpts;

    // Path queries
    if ('gitDir' in queryOpts && queryOpts.gitDir) {
      args.push('--git-dir');
    } else if ('absoluteGitDir' in queryOpts && queryOpts.absoluteGitDir) {
      args.push('--absolute-git-dir');
    } else if ('gitCommonDir' in queryOpts && queryOpts.gitCommonDir) {
      args.push('--git-common-dir');
    } else if ('showToplevel' in queryOpts && queryOpts.showToplevel) {
      args.push('--show-toplevel');
    } else if ('showCdup' in queryOpts && queryOpts.showCdup) {
      args.push('--show-cdup');
    } else if ('showPrefix' in queryOpts && queryOpts.showPrefix) {
      args.push('--show-prefix');
    } else if (
      'showSuperprojectWorkingTree' in queryOpts &&
      queryOpts.showSuperprojectWorkingTree
    ) {
      args.push('--show-superproject-working-tree');
    } else if ('sharedIndexPath' in queryOpts && queryOpts.sharedIndexPath) {
      args.push('--shared-index-path');
    } else if ('gitPath' in queryOpts && typeof queryOpts.gitPath === 'string') {
      args.push('--git-path', queryOpts.gitPath);
    } else if ('resolveGitDir' in queryOpts && typeof queryOpts.resolveGitDir === 'string') {
      args.push('--resolve-git-dir', queryOpts.resolveGitDir);
    }
    // Boolean queries
    else if ('isInsideGitDir' in queryOpts && queryOpts.isInsideGitDir) {
      args.push('--is-inside-git-dir');
    } else if ('isInsideWorkTree' in queryOpts && queryOpts.isInsideWorkTree) {
      args.push('--is-inside-work-tree');
    } else if ('isBareRepository' in queryOpts && queryOpts.isBareRepository) {
      args.push('--is-bare-repository');
    } else if ('isShallowRepository' in queryOpts && queryOpts.isShallowRepository) {
      args.push('--is-shallow-repository');
    }
    // List queries
    else if ('all' in queryOpts && queryOpts.all) {
      if ('exclude' in queryOpts && queryOpts.exclude) {
        args.push(`--exclude=${queryOpts.exclude}`);
      }
      if ('excludeHidden' in queryOpts && queryOpts.excludeHidden) {
        args.push(`--exclude-hidden=${queryOpts.excludeHidden}`);
      }
      args.push('--all');
    } else if ('branches' in queryOpts && queryOpts.branches) {
      if ('exclude' in queryOpts && queryOpts.exclude) {
        args.push(`--exclude=${queryOpts.exclude}`);
      }
      if ('excludeHidden' in queryOpts && queryOpts.excludeHidden) {
        args.push(`--exclude-hidden=${queryOpts.excludeHidden}`);
      }
      if (typeof queryOpts.branches === 'string') {
        args.push(`--branches=${queryOpts.branches}`);
      } else {
        args.push('--branches');
      }
    } else if ('tags' in queryOpts && queryOpts.tags) {
      if ('exclude' in queryOpts && queryOpts.exclude) {
        args.push(`--exclude=${queryOpts.exclude}`);
      }
      if ('excludeHidden' in queryOpts && queryOpts.excludeHidden) {
        args.push(`--exclude-hidden=${queryOpts.excludeHidden}`);
      }
      if (typeof queryOpts.tags === 'string') {
        args.push(`--tags=${queryOpts.tags}`);
      } else {
        args.push('--tags');
      }
    } else if ('remotes' in queryOpts && queryOpts.remotes) {
      if ('exclude' in queryOpts && queryOpts.exclude) {
        args.push(`--exclude=${queryOpts.exclude}`);
      }
      if ('excludeHidden' in queryOpts && queryOpts.excludeHidden) {
        args.push(`--exclude-hidden=${queryOpts.excludeHidden}`);
      }
      if (typeof queryOpts.remotes === 'string') {
        args.push(`--remotes=${queryOpts.remotes}`);
      } else {
        args.push('--remotes');
      }
    } else if ('glob' in queryOpts && typeof queryOpts.glob === 'string') {
      if ('exclude' in queryOpts && queryOpts.exclude) {
        args.push(`--exclude=${queryOpts.exclude}`);
      }
      if ('excludeHidden' in queryOpts && queryOpts.excludeHidden) {
        args.push(`--exclude-hidden=${queryOpts.excludeHidden}`);
      }
      args.push(`--glob=${queryOpts.glob}`);
    } else if ('disambiguate' in queryOpts && typeof queryOpts.disambiguate === 'string') {
      args.push(`--disambiguate=${queryOpts.disambiguate}`);
    }
    // Other queries
    else if ('showObjectFormat' in queryOpts && queryOpts.showObjectFormat) {
      if (queryOpts.showObjectFormat === true) {
        args.push('--show-object-format');
      } else {
        args.push(`--show-object-format=${queryOpts.showObjectFormat}`);
      }
    } else if ('showRefFormat' in queryOpts && queryOpts.showRefFormat) {
      args.push('--show-ref-format');
    } else if ('localEnvVars' in queryOpts && queryOpts.localEnvVars) {
      args.push('--local-env-vars');
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: queryOpts.signal,
    });

    const output = result.stdout.trim();

    // Boolean queries
    if (
      ('isInsideGitDir' in queryOpts && queryOpts.isInsideGitDir) ||
      ('isInsideWorkTree' in queryOpts && queryOpts.isInsideWorkTree) ||
      ('isBareRepository' in queryOpts && queryOpts.isBareRepository) ||
      ('isShallowRepository' in queryOpts && queryOpts.isShallowRepository)
    ) {
      return output === 'true';
    }

    // List queries
    if (
      ('all' in queryOpts && queryOpts.all) ||
      ('branches' in queryOpts && queryOpts.branches) ||
      ('tags' in queryOpts && queryOpts.tags) ||
      ('remotes' in queryOpts && queryOpts.remotes) ||
      ('glob' in queryOpts && queryOpts.glob) ||
      ('disambiguate' in queryOpts && queryOpts.disambiguate) ||
      ('localEnvVars' in queryOpts && queryOpts.localEnvVars)
    ) {
      return output ? output.split('\n').filter((line) => line.length > 0) : [];
    }

    // Path and other queries return string
    return output;
  }

  /**
   * Count the number of commits reachable from a ref
   */
  public async revListCount(ref?: string, opts?: ExecOpts): Promise<number> {
    const args = ['rev-list', '--count'];

    if (ref) {
      args.push(ref);
    } else {
      args.push('HEAD');
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    return Number.parseInt(result.stdout.trim(), 10);
  }

  /**
   * Read or modify symbolic refs
   */
  public async symbolicRef(
    name: string,
    newRef?: string,
    opts?: ExecOpts,
  ): Promise<string | undefined> {
    if (newRef !== undefined) {
      // Set the symbolic ref
      await this.runner.runOrThrow(this.context, ['symbolic-ref', name, newRef], {
        signal: opts?.signal,
      });
      return undefined;
    }

    // Read the symbolic ref
    const result = await this.runner.runOrThrow(this.context, ['symbolic-ref', name], {
      signal: opts?.signal,
    });

    return result.stdout.trim();
  }

  // ==========================================================================
  // Medium Priority - Submodule Operations
  // ==========================================================================

  private async submoduleList(opts?: ExecOpts): Promise<SubmoduleInfo[]> {
    const result = await this.runner.run(this.context, ['submodule', 'status'], {
      signal: opts?.signal,
    });

    if (result.exitCode !== 0) {
      return [];
    }

    const submodules: SubmoduleInfo[] = [];
    for (const line of parseLines(result.stdout)) {
      // Format: [+-U ]<sha1> <path> (<describe>)
      const match = line.match(/^[ +-U]?([a-f0-9]+) (.+?)(?: \((.+)\))?$/);
      if (match) {
        const commit = match[1];
        const path = match[2];
        if (commit === undefined || path === undefined) {
          continue;
        }
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
          name: path,
          path: path,
          url,
          branch,
          commit: commit,
        });
      }
    }

    return submodules;
  }

  private async submoduleInit(paths?: string[], opts?: ExecOpts): Promise<void> {
    const args = ['submodule', 'init'];

    if (paths && paths.length > 0) {
      args.push('--', ...paths);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async submoduleUpdate(opts?: SubmoduleOpts & ExecOpts): Promise<void> {
    validateOptions('submoduleUpdate', opts);
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

    // New options
    if (opts?.noFetch) {
      args.push('--no-fetch');
    }

    if (opts?.checkout) {
      args.push('--checkout');
    }

    if (opts?.merge) {
      args.push('--merge');
    }

    if (opts?.rebase) {
      args.push('--rebase');
    }

    if (opts?.recommendShallow) {
      args.push('--recommend-shallow');
    }

    if (opts?.reference) {
      args.push(`--reference=${opts.reference}`);
    }

    if (opts?.singleBranch) {
      args.push('--single-branch');
    }

    if (opts?.filter) {
      args.push(`--filter=${opts.filter}`);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async submoduleAdd(
    url: string,
    path: string,
    opts?: SubmoduleAddOpts & ExecOpts,
  ): Promise<void> {
    const args = ['submodule', 'add'];

    if (opts?.branch) {
      args.push('-b', opts.branch);
    }

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.name) {
      args.push('--name', opts.name);
    }

    if (opts?.reference) {
      args.push('--reference', opts.reference);
    }

    if (opts?.depth !== undefined) {
      args.push('--depth', String(opts.depth));
    }

    args.push(url, path);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async submoduleDeinit(
    path: string,
    opts?: SubmoduleDeinitOpts & ExecOpts,
  ): Promise<void> {
    const args = ['submodule', 'deinit'];

    if (opts?.force) {
      args.push('--force');
    }

    if (opts?.all) {
      args.push('--all');
    } else {
      args.push(path);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async submoduleStatus(
    paths?: string[],
    opts?: SubmoduleStatusOpts & ExecOpts,
  ): Promise<string> {
    const args = ['submodule', 'status'];

    if (opts?.recursive) {
      args.push('--recursive');
    }

    if (paths && paths.length > 0) {
      args.push('--', ...paths);
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    return result.stdout;
  }

  private async submoduleSummary(opts?: SubmoduleSummaryOpts & ExecOpts): Promise<string> {
    const args = ['submodule', 'summary'];

    if (opts?.limit !== undefined) {
      args.push('-n', String(opts.limit));
    }

    if (opts?.files) {
      args.push('--files');
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    return result.stdout;
  }

  private async submoduleForeach(
    command: string,
    opts?: SubmoduleForeachOpts & ExecOpts,
  ): Promise<string> {
    const args = ['submodule', 'foreach'];

    if (opts?.recursive) {
      args.push('--recursive');
    }

    args.push(command);

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    return result.stdout;
  }

  private async submoduleSync(
    paths?: string[],
    opts?: SubmoduleSyncOpts & ExecOpts,
  ): Promise<void> {
    const args = ['submodule', 'sync'];

    if (opts?.recursive) {
      args.push('--recursive');
    }

    if (paths && paths.length > 0) {
      args.push('--', ...paths);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async submoduleAbsorbGitDirs(opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow(this.context, ['submodule', 'absorbgitdirs'], {
      signal: opts?.signal,
    });
  }

  private async submoduleSetBranch(
    path: string,
    branch: string,
    opts?: SubmoduleSetBranchOpts & ExecOpts,
  ): Promise<void> {
    const args = ['submodule', 'set-branch'];

    if (opts?.default) {
      args.push('--default');
    } else {
      args.push('--branch', branch);
    }

    args.push('--', path);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async submoduleSetUrl(path: string, url: string, opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow(this.context, ['submodule', 'set-url', '--', path, url], {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // Remote Operations
  // ==========================================================================

  private async remoteList(opts?: ExecOpts): Promise<RemoteInfo[]> {
    const result = await this.runner.runOrThrow(this.context, ['remote', '-v'], {
      signal: opts?.signal,
    });

    const remotes = new Map<string, RemoteInfo>();

    for (const line of parseLines(result.stdout)) {
      // Format: origin	https://github.com/user/repo.git (fetch)
      // Format: origin	https://github.com/user/repo.git (push)
      const match = line.match(/^(\S+)\t(.+?)\s+\((fetch|push)\)$/);
      if (match) {
        const name = match[1];
        const url = match[2];
        const type = match[3];
        if (name !== undefined && url !== undefined) {
          const existing = remotes.get(name);
          if (existing) {
            if (type === 'fetch') {
              existing.fetchUrl = url;
            } else if (type === 'push') {
              existing.pushUrl = url;
            }
          } else {
            remotes.set(name, {
              name,
              fetchUrl: type === 'fetch' ? url : '',
              pushUrl: type === 'push' ? url : '',
            });
          }
        }
      }
    }

    // Fill in missing URLs (they're often the same)
    for (const remote of remotes.values()) {
      if (!remote.fetchUrl && remote.pushUrl) {
        remote.fetchUrl = remote.pushUrl;
      }
      if (!remote.pushUrl && remote.fetchUrl) {
        remote.pushUrl = remote.fetchUrl;
      }
    }

    return Array.from(remotes.values());
  }

  private async remoteAdd(
    name: string,
    url: string,
    opts?: RemoteAddOpts & ExecOpts,
  ): Promise<void> {
    validateOptions('remoteAdd', opts);
    const args = ['remote', 'add'];

    if (opts?.track) {
      args.push('-t', opts.track);
    }

    if (opts?.fetch) {
      args.push('-f');
    }

    if (opts?.mirror === 'fetch') {
      args.push('--mirror=fetch');
    } else if (opts?.mirror === 'push') {
      args.push('--mirror=push');
    }

    // New option
    if (opts?.tags === true) {
      args.push('--tags');
    } else if (opts?.tags === false) {
      args.push('--no-tags');
    }

    args.push(name, url);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async remoteRemove(name: string, opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow(this.context, ['remote', 'remove', name], {
      signal: opts?.signal,
    });
  }

  private async remoteRename(oldName: string, newName: string, opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow(this.context, ['remote', 'rename', oldName, newName], {
      signal: opts?.signal,
    });
  }

  private async remoteGetUrl(name: string, opts?: RemoteUrlOpts & ExecOpts): Promise<string> {
    const args = ['remote', 'get-url'];

    if (opts?.push) {
      args.push('--push');
    }

    args.push(name);

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    return result.stdout.trim();
  }

  private async remoteSetUrl(
    name: string,
    url: string,
    opts?: RemoteUrlOpts & ExecOpts,
  ): Promise<void> {
    const args = ['remote', 'set-url'];

    if (opts?.push) {
      args.push('--push');
    }

    args.push(name, url);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async remoteSetHead(
    remote: string,
    branch?: string,
    opts?: RemoteSetHeadOpts & ExecOpts,
  ): Promise<void> {
    validateOptions('remoteSetHead', opts);
    const args = ['remote', 'set-head'];

    if (opts?.auto) {
      args.push('--auto');
    } else if (opts?.delete) {
      args.push('--delete');
    }

    args.push(remote);

    if (branch && !opts?.auto && !opts?.delete) {
      args.push(branch);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async remoteShow(remote: string, opts?: RemoteShowOpts & ExecOpts): Promise<string> {
    const args = ['remote', 'show'];

    if (opts?.noQuery) {
      args.push('-n');
    }

    args.push(remote);

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    return result.stdout;
  }

  private async remotePrune(remote: string, opts?: RemotePruneOpts & ExecOpts): Promise<string[]> {
    const args = ['remote', 'prune'];

    if (opts?.dryRun) {
      args.push('--dry-run');
    }

    args.push(remote);

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    // Parse pruned refs from output
    const pruned: string[] = [];
    for (const line of parseLines(result.stdout)) {
      // Output is like " * [pruned] origin/some-branch"
      const match = line.match(/\* \[pruned\] (.+)/);
      const ref = match?.[1];
      if (ref) {
        pruned.push(ref);
      }
    }

    return pruned;
  }

  private async remoteUpdate(
    remotes?: string[],
    opts?: RemoteUpdateOpts & ExecOpts,
  ): Promise<void> {
    const args = ['remote', 'update'];

    if (opts?.prune) {
      args.push('--prune');
    }

    if (remotes && remotes.length > 0) {
      args.push(...remotes);
    }

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  private async remoteSetBranches(
    remote: string,
    branches: string[],
    opts?: RemoteSetBranchesOpts & ExecOpts,
  ): Promise<void> {
    const args = ['remote', 'set-branches'];

    if (opts?.add) {
      args.push('--add');
    }

    args.push(remote, ...branches);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  // ==========================================================================
  // Config Operations (Repository-level)
  // ==========================================================================

  /**
   * Get a typed config value
   */
  private async configGet<K extends ConfigKey>(
    key: K,
    opts?: ExecOpts,
  ): Promise<ConfigSchema[K] | undefined> {
    const values = await readTypedConfig(this.runner, this.context, key, opts);
    return values.at(-1);
  }

  /**
   * Get all values for a typed multi-valued config key
   */
  private async configGetAll<K extends ConfigKey>(
    key: K,
    opts?: ExecOpts,
  ): Promise<ConfigSchema[K][]> {
    return readTypedConfig(this.runner, this.context, key, opts, true);
  }

  /**
   * Set a typed config value
   */
  private async configSet<K extends ConfigKey>(
    key: K,
    value: ConfigSchema[K],
    opts?: ExecOpts,
  ): Promise<void> {
    await this.runner.runOrThrow(this.context, ['config', key, String(value)], {
      signal: opts?.signal,
    });
  }

  /**
   * Add a value to a typed multi-valued config key
   */
  private async configAdd<K extends ConfigKey>(
    key: K,
    value: ConfigSchema[K],
    opts?: ExecOpts,
  ): Promise<void> {
    await this.runner.runOrThrow(this.context, ['config', '--add', key, String(value)], {
      signal: opts?.signal,
    });
  }

  /**
   * Unset a typed config value
   */
  private async configUnset<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow(this.context, ['config', '--unset', key], {
      signal: opts?.signal,
    });
  }

  /**
   * Get a raw config value (for arbitrary keys)
   */
  private configGetRaw(
    key: string,
    opts: ConfigGetOpts & { all: true } & ExecOpts,
  ): Promise<string[]>;
  private configGetRaw(
    key: string,
    opts?: ConfigGetOpts & { all?: false } & ExecOpts,
  ): Promise<string | undefined>;
  private configGetRaw(
    key: string,
    opts?: ConfigGetOpts & ExecOpts,
  ): Promise<string | string[] | undefined>;
  private async configGetRaw(
    key: string,
    opts?: ConfigGetOpts & ExecOpts,
  ): Promise<string | string[] | undefined> {
    return readConfig(this.runner, this.context, key, opts);
  }

  /**
   * Set a raw config value (for arbitrary keys)
   */
  private async configSetRaw(
    key: string,
    value: string,
    opts?: ConfigSetOpts & ExecOpts,
  ): Promise<void> {
    const args = ['config'];

    if (opts?.add) {
      args.push('--add');
    }

    args.push(key, value);

    await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });
  }

  /**
   * Unset a raw config value (for arbitrary keys)
   */
  private async configUnsetRaw(key: string, opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow(this.context, ['config', '--unset', key], {
      signal: opts?.signal,
    });
  }

  /**
   * List all config values
   */
  private async configList(opts?: ConfigListOpts & ExecOpts): Promise<ConfigEntry[]> {
    return listConfig(this.runner, this.context, opts);
  }

  private async configRenameSection(
    oldName: string,
    newName: string,
    opts?: ExecOpts,
  ): Promise<void> {
    await this.runner.runOrThrow(this.context, ['config', '--rename-section', oldName, newName], {
      signal: opts?.signal,
    });
  }

  private async configRemoveSection(name: string, opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow(this.context, ['config', '--remove-section', name], {
      signal: opts?.signal,
    });
  }
}

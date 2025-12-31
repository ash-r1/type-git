/**
 * Backend-based WorktreeRepo implementation
 *
 * This module provides a WorktreeRepo implementation that uses GitBackend
 * for all operations, allowing the use of alternative Git implementations.
 */

import type { GitBackend } from '../core/backend.js';
import type {
  AddOpts,
  BranchInfo,
  BranchOpts,
  CheckoutBranchOpts,
  CheckoutPathOpts,
  Commit,
  CommitOpts,
  CommitResult,
  ConfigOperations,
  DiffOpts,
  DiffResult,
  FetchOpts,
  LfsExtraOperations,
  LogOpts,
  LsTreeEntry,
  LsTreeOpts,
  MergeOpts,
  MergeResult,
  PullOpts,
  PushOpts,
  RepoLsRemoteOpts,
  RepoLsRemoteResult,
  ResetOpts,
  RevParseBooleanQuery,
  RevParseListQuery,
  RevParsePathOpts,
  RevParsePathQuery,
  RevParseRefOpts,
  StashApplyOpts,
  StashEntry,
  StashPushOpts,
  StatusOpts,
  StatusPorcelain,
  TagCreateOpts,
  TagListOpts,
  WorktreeRepo,
} from '../core/repo.js';
import type { ExecOpts, LfsMode, RawResult } from '../core/types.js';
import { GitError } from '../core/types.js';
import type { LsRemoteRef } from '../parsers/index.js';

/**
 * Backend-based WorktreeRepo implementation
 *
 * This is a minimal implementation that supports the MVP operations.
 * Many advanced operations throw CapabilityMissing errors.
 */
export class BackendWorktreeRepoImpl implements WorktreeRepo {
  private readonly backend: GitBackend;
  public readonly workdir: string;

  public readonly branch: WorktreeRepo['branch'];
  public readonly stash: WorktreeRepo['stash'];
  public readonly remote: WorktreeRepo['remote'];
  public readonly config: ConfigOperations;
  public readonly tag: WorktreeRepo['tag'];
  public readonly submodule: WorktreeRepo['submodule'];
  public readonly worktree: WorktreeRepo['worktree'];
  public readonly lfs: WorktreeRepo['lfs'];
  public readonly lfsExtra: LfsExtraOperations;

  public constructor(backend: GitBackend, workdir: string) {
    this.backend = backend;
    this.workdir = workdir;

    // Initialize branch operations
    this.branch = {
      list: this.branchList.bind(this),
      current: this.branchCurrent.bind(this),
      create: this.branchCreate.bind(this),
      delete: this.unsupportedOp.bind(this, 'branch.delete'),
      rename: this.unsupportedOp.bind(this, 'branch.rename'),
    };

    // Initialize stash operations (delegate to backend if supported)
    this.stash = {
      list: this.stashList.bind(this),
      push: this.stashPush.bind(this),
      pop: this.stashPop.bind(this),
      apply: this.unsupportedOp.bind(this, 'stash.apply'),
      drop: this.unsupportedOp.bind(this, 'stash.drop'),
      clear: this.unsupportedOp.bind(this, 'stash.clear'),
    };

    // Initialize remote operations (not supported)
    this.remote = {
      list: this.unsupportedOp.bind(this, 'remote.list'),
      add: this.unsupportedOp.bind(this, 'remote.add'),
      remove: this.unsupportedOp.bind(this, 'remote.remove'),
      rename: this.unsupportedOp.bind(this, 'remote.rename'),
      getUrl: this.unsupportedOp.bind(this, 'remote.getUrl'),
      setUrl: this.unsupportedOp.bind(this, 'remote.setUrl'),
      setHead: this.unsupportedOp.bind(this, 'remote.setHead'),
      show: this.unsupportedOp.bind(this, 'remote.show'),
      prune: this.unsupportedOp.bind(this, 'remote.prune'),
      update: this.unsupportedOp.bind(this, 'remote.update'),
      setBranches: this.unsupportedOp.bind(this, 'remote.setBranches'),
    };

    // Initialize config operations (not supported)
    this.config = {
      get: this.unsupportedOp.bind(this, 'config.get'),
      getAll: this.unsupportedOp.bind(this, 'config.getAll'),
      set: this.unsupportedOp.bind(this, 'config.set'),
      add: this.unsupportedOp.bind(this, 'config.add'),
      unset: this.unsupportedOp.bind(this, 'config.unset'),
      getRaw: this.unsupportedOp.bind(this, 'config.getRaw'),
      setRaw: this.unsupportedOp.bind(this, 'config.setRaw'),
      unsetRaw: this.unsupportedOp.bind(this, 'config.unsetRaw'),
      list: this.unsupportedOp.bind(this, 'config.list'),
      renameSection: this.unsupportedOp.bind(this, 'config.renameSection'),
      removeSection: this.unsupportedOp.bind(this, 'config.removeSection'),
    };

    // Initialize tag operations (delegate to backend if supported)
    this.tag = {
      list: this.tagList.bind(this),
      create: this.tagCreate.bind(this),
      delete: this.unsupportedOp.bind(this, 'tag.delete'),
      show: this.unsupportedOp.bind(this, 'tag.show'),
    };

    // Initialize submodule operations (not supported)
    this.submodule = {
      list: this.unsupportedOp.bind(this, 'submodule.list'),
      init: this.unsupportedOp.bind(this, 'submodule.init'),
      update: this.unsupportedOp.bind(this, 'submodule.update'),
      add: this.unsupportedOp.bind(this, 'submodule.add'),
      deinit: this.unsupportedOp.bind(this, 'submodule.deinit'),
      status: this.unsupportedOp.bind(this, 'submodule.status'),
      summary: this.unsupportedOp.bind(this, 'submodule.summary'),
      foreach: this.unsupportedOp.bind(this, 'submodule.foreach'),
      sync: this.unsupportedOp.bind(this, 'submodule.sync'),
      absorbGitDirs: this.unsupportedOp.bind(this, 'submodule.absorbGitDirs'),
      setBranch: this.unsupportedOp.bind(this, 'submodule.setBranch'),
      setUrl: this.unsupportedOp.bind(this, 'submodule.setUrl'),
    };

    // Initialize worktree operations (not supported)
    this.worktree = {
      list: this.unsupportedOp.bind(this, 'worktree.list'),
      add: this.unsupportedOp.bind(this, 'worktree.add'),
      remove: this.unsupportedOp.bind(this, 'worktree.remove'),
      prune: this.unsupportedOp.bind(this, 'worktree.prune'),
      lock: this.unsupportedOp.bind(this, 'worktree.lock'),
      unlock: this.unsupportedOp.bind(this, 'worktree.unlock'),
      move: this.unsupportedOp.bind(this, 'worktree.move'),
      repair: this.unsupportedOp.bind(this, 'worktree.repair'),
    };

    // Initialize LFS operations (not supported)
    this.lfs = {
      pull: this.unsupportedOp.bind(this, 'lfs.pull'),
      push: this.unsupportedOp.bind(this, 'lfs.push'),
      status: this.unsupportedOp.bind(this, 'lfs.status'),
      prune: this.unsupportedOp.bind(this, 'lfs.prune'),
      fetch: this.unsupportedOp.bind(this, 'lfs.fetch'),
      install: this.unsupportedOp.bind(this, 'lfs.install'),
      uninstall: this.unsupportedOp.bind(this, 'lfs.uninstall'),
      lsFiles: this.unsupportedOp.bind(this, 'lfs.lsFiles'),
      track: this.unsupportedOp.bind(this, 'lfs.track'),
      trackList: this.unsupportedOp.bind(this, 'lfs.trackList'),
      untrack: this.unsupportedOp.bind(this, 'lfs.untrack'),
      lock: this.unsupportedOp.bind(this, 'lfs.lock'),
      unlock: this.unsupportedOp.bind(this, 'lfs.unlock'),
      locks: this.unsupportedOp.bind(this, 'lfs.locks'),
      checkout: this.unsupportedOp.bind(this, 'lfs.checkout'),
      migrateInfo: this.unsupportedOp.bind(this, 'lfs.migrateInfo'),
      migrateImport: this.unsupportedOp.bind(this, 'lfs.migrateImport'),
      migrateExport: this.unsupportedOp.bind(this, 'lfs.migrateExport'),
      env: this.unsupportedOp.bind(this, 'lfs.env'),
      version: this.unsupportedOp.bind(this, 'lfs.version'),
    };

    // Initialize LFS extra operations (not supported)
    this.lfsExtra = {
      preUpload: this.unsupportedOp.bind(this, 'lfsExtra.preUpload'),
      preDownload: this.unsupportedOp.bind(this, 'lfsExtra.preDownload'),
    };
  }

  // ===========================================================================
  // LFS Mode
  // ===========================================================================

  public setLfsMode(_mode: LfsMode): void {
    // LFS mode is not relevant for backend implementations
    // since they don't support LFS operations
  }

  // ===========================================================================
  // RepoBase Operations
  // ===========================================================================

  public async raw(argv: string[], opts?: ExecOpts): Promise<RawResult> {
    if (!this.backend.raw) {
      throw new GitError(
        'CapabilityMissing',
        'Raw git commands are not supported by this backend.',
        {},
      );
    }

    return this.backend.raw({ type: 'worktree', workdir: this.workdir }, argv, opts);
  }

  public async isWorktree(): Promise<boolean> {
    return true;
  }

  public async isBare(): Promise<boolean> {
    return false;
  }

  public async lsRemote(
    remote: string,
    opts?: RepoLsRemoteOpts & ExecOpts,
  ): Promise<RepoLsRemoteResult> {
    if (!this.backend.raw) {
      throw new GitError('CapabilityMissing', 'lsRemote is not supported by this backend.', {});
    }

    const args = ['ls-remote'];

    if (opts?.heads) {
      args.push('--heads');
    }

    if (opts?.tags) {
      args.push('--tags');
    }

    args.push(remote);

    const result = await this.backend.raw({ type: 'worktree', workdir: this.workdir }, args, opts);

    const refs: LsRemoteRef[] = result.stdout
      .trim()
      .split('\n')
      .filter((line) => line)
      .map((line) => {
        const [hash, name] = line.split('\t');
        return { hash: hash ?? '', name: name ?? '' };
      });

    return { refs };
  }

  public async lsTree(treeish: string, opts?: LsTreeOpts & ExecOpts): Promise<LsTreeEntry[]> {
    if (!this.backend.raw) {
      throw new GitError('CapabilityMissing', 'lsTree is not supported by this backend.', {});
    }

    const args = ['ls-tree'];

    if (opts?.recursive) {
      args.push('-r');
    }

    if (opts?.long) {
      args.push('-l');
    }

    args.push(treeish);

    if (opts?.paths) {
      args.push(...opts.paths);
    }

    const result = await this.backend.raw({ type: 'worktree', workdir: this.workdir }, args, opts);

    const entries: LsTreeEntry[] = [];

    for (const line of result.stdout.trim().split('\n')) {
      if (!line) {
        continue;
      }

      const match = line.match(/^(\d+)\s+(\w+)\s+(\w+)\s+(?:(\d+)\s+)?(.+)$/);
      if (!match) {
        continue;
      }

      const [, mode, type, hash, size, path] = match;
      const entry: LsTreeEntry = {
        mode: mode ?? '',
        type: type as 'blob' | 'tree' | 'commit',
        hash: hash ?? '',
        path: path ?? '',
      };

      if (size) {
        entry.size = Number.parseInt(size, 10);
      }

      entries.push(entry);
    }

    return entries;
  }

  // ===========================================================================
  // MVP Operations
  // ===========================================================================

  public async status(opts?: StatusOpts & ExecOpts): Promise<StatusPorcelain> {
    return this.backend.status(this.workdir, opts);
  }

  public async log(opts?: LogOpts & ExecOpts): Promise<Commit[]> {
    return this.backend.log(this.workdir, opts);
  }

  public async commit(opts?: CommitOpts & ExecOpts): Promise<CommitResult> {
    const message = opts?.message ?? '';
    if (!(message || opts?.allowEmptyMessage)) {
      throw new GitError('NonZeroExit', 'Commit message is required', {});
    }

    return this.backend.commit(this.workdir, message, opts);
  }

  public async add(paths: string | string[], opts?: AddOpts & ExecOpts): Promise<void> {
    const pathArray = Array.isArray(paths) ? paths : [paths];
    return this.backend.add(this.workdir, pathArray, opts);
  }

  // ===========================================================================
  // Branch Operations
  // ===========================================================================

  private async branchList(opts?: BranchOpts & ExecOpts): Promise<BranchInfo[]> {
    return this.backend.branchList(this.workdir, opts);
  }

  private async branchCurrent(opts?: ExecOpts): Promise<string | null> {
    const branches = await this.backend.branchList(this.workdir, opts);
    const current = branches.find((b) => b.current);
    return current?.name ?? null;
  }

  private async branchCreate(
    name: string,
    opts?: { startPoint?: string; force?: boolean } & ExecOpts,
  ): Promise<void> {
    return this.backend.branchCreate(this.workdir, name, opts);
  }

  // ===========================================================================
  // Extended Operations (delegate to backend if supported)
  // ===========================================================================

  public async fetch(opts?: FetchOpts & ExecOpts): Promise<void> {
    if (!this.backend.fetch) {
      return this.unsupportedOp('fetch');
    }
    return this.backend.fetch(this.workdir, opts);
  }

  public async push(opts?: PushOpts & ExecOpts): Promise<void> {
    if (!this.backend.push) {
      return this.unsupportedOp('push');
    }
    return this.backend.push(this.workdir, opts);
  }

  public async pull(opts?: PullOpts & ExecOpts): Promise<void> {
    if (!this.backend.pull) {
      return this.unsupportedOp('pull');
    }
    return this.backend.pull(this.workdir, opts);
  }

  public checkout(target: string, opts?: CheckoutBranchOpts & ExecOpts): Promise<void>;
  public checkout(paths: string[], opts?: CheckoutPathOpts & ExecOpts): Promise<void>;
  public async checkout(
    targetOrPaths: string | string[],
    opts?: (CheckoutBranchOpts | CheckoutPathOpts) & ExecOpts,
  ): Promise<void> {
    if (Array.isArray(targetOrPaths)) {
      // Path-based checkout
      if (!this.backend.checkoutPaths) {
        return this.unsupportedOp('checkout (paths)');
      }
      return this.backend.checkoutPaths(this.workdir, targetOrPaths, opts as CheckoutPathOpts);
    }
    // Branch/commit checkout
    if (!this.backend.checkout) {
      return this.unsupportedOp('checkout');
    }
    return this.backend.checkout(this.workdir, targetOrPaths, opts as CheckoutBranchOpts);
  }

  public async switch(): Promise<void> {
    return this.unsupportedOp('switch');
  }

  public async merge(branch: string, opts?: MergeOpts & ExecOpts): Promise<MergeResult> {
    if (!this.backend.merge) {
      return this.unsupportedOp('merge');
    }
    return this.backend.merge(this.workdir, branch, opts);
  }

  public async rebase(): Promise<void> {
    return this.unsupportedOp('rebase');
  }

  public async cherryPick(): Promise<void> {
    return this.unsupportedOp('cherryPick');
  }

  public async revert(): Promise<void> {
    return this.unsupportedOp('revert');
  }

  public async reset(target?: string, opts?: ResetOpts & ExecOpts): Promise<void> {
    if (!this.backend.reset) {
      return this.unsupportedOp('reset');
    }
    return this.backend.reset(this.workdir, target, opts);
  }

  public async clean(): Promise<string[]> {
    return this.unsupportedOp('clean');
  }

  public async rm(): Promise<void> {
    return this.unsupportedOp('rm');
  }

  public async mv(): Promise<void> {
    return this.unsupportedOp('mv');
  }

  public async restore(): Promise<void> {
    return this.unsupportedOp('restore');
  }

  public async diff(target?: string, opts?: DiffOpts & ExecOpts): Promise<DiffResult> {
    if (!this.backend.diff) {
      return this.unsupportedOp('diff');
    }
    return this.backend.diff(this.workdir, target, opts);
  }

  public async show(): Promise<string> {
    return this.unsupportedOp('show');
  }

  // ===========================================================================
  // Stash Operations
  // ===========================================================================

  private async stashList(opts?: ExecOpts): Promise<StashEntry[]> {
    if (!this.backend.stashList) {
      return this.unsupportedOp('stash.list');
    }
    return this.backend.stashList(this.workdir, opts);
  }

  private async stashPush(opts?: StashPushOpts & ExecOpts): Promise<void> {
    if (!this.backend.stashPush) {
      return this.unsupportedOp('stash.push');
    }
    return this.backend.stashPush(this.workdir, opts);
  }

  private async stashPop(opts?: StashApplyOpts & ExecOpts): Promise<void> {
    if (!this.backend.stashPop) {
      return this.unsupportedOp('stash.pop');
    }
    return this.backend.stashPop(this.workdir, opts);
  }

  // ===========================================================================
  // Tag Operations
  // ===========================================================================

  private async tagList(opts?: TagListOpts & ExecOpts): Promise<string[]> {
    if (!this.backend.tagList) {
      return this.unsupportedOp('tag.list');
    }
    return this.backend.tagList(this.workdir, opts);
  }

  private async tagCreate(name: string, opts?: TagCreateOpts & ExecOpts): Promise<void> {
    if (!this.backend.tagCreate) {
      return this.unsupportedOp('tag.create');
    }
    return this.backend.tagCreate(this.workdir, name, opts);
  }

  // ===========================================================================
  // Unsupported Operations
  // ===========================================================================

  public revParse(ref: string, opts?: RevParseRefOpts & ExecOpts): Promise<string>;
  public revParse(opts: RevParsePathQuery & RevParsePathOpts & ExecOpts): Promise<string>;
  public revParse(opts: RevParseBooleanQuery & ExecOpts): Promise<boolean>;
  public revParse(opts: RevParseListQuery & ExecOpts): Promise<string[]>;
  public revParse(
    opts: { showObjectFormat: true | 'storage' | 'input' | 'output' } & ExecOpts,
  ): Promise<string>;
  public revParse(opts: { showRefFormat: true } & ExecOpts): Promise<string>;
  public revParse(opts: { localEnvVars: true } & ExecOpts): Promise<string[]>;
  public async revParse(
    _refOrOpts:
      | string
      | (RevParsePathQuery & RevParsePathOpts & ExecOpts)
      | (RevParseBooleanQuery & ExecOpts)
      | (RevParseListQuery & ExecOpts)
      | ({ showObjectFormat: true | 'storage' | 'input' | 'output' } & ExecOpts)
      | ({ showRefFormat: true } & ExecOpts)
      | ({ localEnvVars: true } & ExecOpts),
    _opts?: RevParseRefOpts & ExecOpts,
  ): Promise<string | boolean | string[]> {
    return this.unsupportedOp('revParse');
  }

  public async revListCount(): Promise<number> {
    return this.unsupportedOp('revListCount');
  }

  public async symbolicRef(): Promise<string | undefined> {
    return this.unsupportedOp('symbolicRef');
  }

  private async unsupportedOp(name: string): Promise<never> {
    const caps = this.backend.getCapabilities();
    throw new GitError(
      'CapabilityMissing',
      `${name} is not supported by ${caps.type} backend in MVP mode.`,
      {},
    );
  }
}

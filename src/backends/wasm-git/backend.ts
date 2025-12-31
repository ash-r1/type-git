/**
 * wasm-git Backend Implementation
 *
 * WebAssembly-based libgit2 implementation.
 * Works in browsers and Node.js with predictable cross-platform behavior.
 * Does NOT support LFS operations.
 *
 * Note: This implementation is experimental and uses wasm-git or similar
 * WebAssembly libgit2 bindings. The actual API may vary depending on
 * the specific WASM build used.
 */

import type {
  BackendAddOpts,
  BackendBranchCreateOpts,
  BackendCapabilities,
  BackendExecOpts,
  GitBackend,
  WasmGitBackendOptions,
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
  StatusOpts,
  StatusPorcelain,
  TagCreateOpts,
  TagListOpts,
} from '../../core/repo.js';
import { GitError } from '../../core/types.js';
import {
  convertBranches,
  convertCommits,
  convertStatus,
  type WasmGitBranchData,
  type WasmGitCommitData,
  type WasmGitStatusEntry,
} from './converters.js';

/**
 * wasm-git module interface
 *
 * This is a simplified interface that abstracts over different wasm-git implementations.
 * The actual wasm-git library exposes a lower-level API that mirrors libgit2.
 */
interface WasmGitModule {
  /** File system provided by Emscripten */
  FS: {
    mkdir(path: string): void;
    writeFile(path: string, content: string | Uint8Array): void;
    readFile(path: string, options?: { encoding?: string }): string | Uint8Array;
    readdir(path: string): string[];
    stat(path: string): { isDirectory(): boolean };
    unlink(path: string): void;
    rmdir(path: string): void;
    analyzePath(path: string): { exists: boolean };
  };

  /** libgit2 functions */
  callMain(args: string[]): number;

  /** Repository operations */
  lg: {
    Repository: {
      open(path: string): WasmGitRepository;
      init(path: string, isBare: boolean): WasmGitRepository;
      clone(url: string, path: string): WasmGitRepository;
    };
    Signature: {
      now(name: string, email: string): WasmGitSignature;
    };
    // Extended operations - may not be present in all wasm-git builds
    Remote?: {
      lookup(repo: WasmGitRepository, name: string): WasmGitRemote;
    };
    Checkout?: {
      head(repo: WasmGitRepository, options?: unknown): void;
      tree(repo: WasmGitRepository, treeish: unknown, options?: unknown): void;
    };
    Reset?: {
      reset(repo: WasmGitRepository, commit: WasmGitCommit, resetType: number): void;
      SOFT: 1;
      MIXED: 2;
      HARD: 3;
    };
    Merge?: {
      merge(repo: WasmGitRepository, theirHead: unknown, options?: unknown): WasmGitMergeResult;
    };
    Stash?: {
      save(repo: WasmGitRepository, stasher: WasmGitSignature, message: string, flags: number): string;
      pop(repo: WasmGitRepository, index: number, options?: unknown): void;
      foreach(repo: WasmGitRepository, callback: (index: number, message: string, oid: string) => number): void;
      INCLUDE_UNTRACKED: 1;
      KEEP_INDEX: 2;
    };
    Tag?: {
      list(repo: WasmGitRepository): string[];
      create(repo: WasmGitRepository, name: string, target: unknown, tagger: WasmGitSignature, message: string, force: boolean): string;
      createLightweight(repo: WasmGitRepository, name: string, target: unknown, force: boolean): string;
    };
  };

  /** Ready promise */
  ready?: Promise<void>;
}

interface WasmGitRemote {
  fetch(refspecs: string[], options?: unknown): void;
  push(refspecs: string[], options?: unknown): void;
}

interface WasmGitMergeResult {
  isUpToDate: boolean;
  isFastForward: boolean;
  hasConflicts: boolean;
  conflictedFiles?: string[];
}

interface WasmGitRepository {
  free(): void;
  isBare(): boolean;
  head(): WasmGitReference;
  statusList(): WasmGitStatusEntry[];
  index(): WasmGitIndex;
  createCommit(
    updateRef: string,
    author: WasmGitSignature,
    committer: WasmGitSignature,
    message: string,
    tree: unknown,
    parents: unknown[],
  ): string;
  headCommit(): WasmGitCommit;
  branches(): WasmGitBranchData[];
  createBranch(name: string, commit: WasmGitCommit, force: boolean): void;
  // Extended operations
  getRemote?(name: string): WasmGitRemote;
  checkoutBranch?(branch: string, options?: unknown): void;
  getCommit?(oid: string): WasmGitCommit;
  getBranchCommit?(name: string): WasmGitCommit;
  tags?(): string[];
  diff?(options?: unknown): WasmGitDiffList;
  diffTreeToTree?(oldTree: unknown, newTree: unknown, options?: unknown): WasmGitDiffList;
  diffTreeToIndex?(tree: unknown, options?: unknown): WasmGitDiffList;
  diffIndexToWorkdir?(options?: unknown): WasmGitDiffList;
}

interface WasmGitDiffList {
  deltas(): WasmGitDiffDelta[];
}

interface WasmGitDiffDelta {
  oldFile(): { path(): string };
  newFile(): { path(): string };
  status(): number;
}

interface WasmGitReference {
  shorthand(): string;
  target(): string;
}

interface WasmGitIndex {
  addByPath(path: string): void;
  addAll(): void;
  write(): void;
  writeTree(): unknown;
}

interface WasmGitSignature {
  name: string;
  email: string;
  time: number;
}

interface WasmGitCommit {
  oid(): string;
  message(): string;
  parents(): WasmGitCommit[];
  author(): WasmGitSignature;
  committer(): WasmGitSignature;
}

/**
 * wasm-git Backend
 *
 * This backend provides a WebAssembly-based Git implementation using libgit2 compiled to WASM.
 */
export class WasmGitBackend implements GitBackend {
  private wasmModule: WasmGitModule | null = null;
  private initialized = false;

  public constructor(_options?: WasmGitBackendOptions) {
    // wasmPath option is reserved for future use
  }

  /**
   * Initialize and get the wasm-git module
   */
  private async getWasmGit(): Promise<WasmGitModule> {
    if (this.wasmModule && this.initialized) {
      return this.wasmModule;
    }

    try {
      // Try to import wasm-git or lg2 (common names for wasm-git libraries)
      let module: WasmGitModule;

      try {
        // Try @aspect-build/aspect-git-wasm first
        const imported = await import('@aspect-build/aspect-git-wasm');
        module = imported.default ?? imported;
      } catch {
        try {
          // Try wasm-git
          const imported = await import('wasm-git');
          module = imported.default ?? imported;
        } catch {
          try {
            // Try lg2 (another common name)
            const imported = await import('lg2');
            module = imported.default ?? imported;
          } catch {
            throw new Error('No wasm-git module found');
          }
        }
      }

      // Wait for WASM to be ready
      if (module.ready) {
        await module.ready;
      }

      this.wasmModule = module;
      this.initialized = true;
      return module;
    } catch (_error) {
      throw new GitError(
        'SpawnFailed',
        'Failed to load wasm-git. Make sure a compatible WASM Git library is installed.',
        {},
        'unknown',
      );
    }
  }

  public getCapabilities(): BackendCapabilities {
    return {
      type: 'wasm-git',
      supportsLfs: false,
      supportsProgress: false, // Limited progress support in WASM
      supportsAbort: false, // WASM operations are synchronous
      supportsBareRepo: true,
      supportsBrowser: true,
    };
  }

  // ===========================================================================
  // Repository Operations
  // ===========================================================================

  public async checkRepository(path: string): Promise<{ isBare: boolean } | null> {
    const wasm = await this.getWasmGit();

    try {
      const repo = wasm.lg.Repository.open(path);
      const isBare = repo.isBare();
      repo.free();
      return { isBare };
    } catch {
      return null;
    }
  }

  public async init(path: string, opts?: InitOpts & BackendExecOpts): Promise<void> {
    const wasm = await this.getWasmGit();

    try {
      // Ensure directory exists
      try {
        wasm.FS.mkdir(path);
      } catch {
        // Directory may already exist
      }

      const repo = wasm.lg.Repository.init(path, opts?.bare ?? false);
      repo.free();
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async clone(
    url: string,
    path: string,
    _opts?: CloneOpts & BackendExecOpts,
  ): Promise<void> {
    const wasm = await this.getWasmGit();

    try {
      // Ensure directory exists
      try {
        wasm.FS.mkdir(path);
      } catch {
        // Directory may already exist
      }

      const repo = wasm.lg.Repository.clone(url, path);
      repo.free();
    } catch (error) {
      throw this.mapError(error);
    }
  }

  // ===========================================================================
  // Repository-Scoped Operations
  // ===========================================================================

  public async status(
    workdir: string,
    _opts?: StatusOpts & BackendExecOpts,
  ): Promise<StatusPorcelain> {
    const wasm = await this.getWasmGit();

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        const statusList = repo.statusList();
        const entries = convertStatus(statusList);

        // Get current branch
        let branch: string | undefined;
        try {
          const head = repo.head();
          branch = head.shorthand();
        } catch {
          // Ignore errors getting branch
        }

        return {
          entries,
          branch,
          upstream: undefined,
          ahead: undefined,
          behind: undefined,
        };
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async log(workdir: string, opts?: LogOpts & BackendExecOpts): Promise<Commit[]> {
    const wasm = await this.getWasmGit();

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        const maxCount = opts?.maxCount ?? 100;
        const commits: WasmGitCommitData[] = [];

        let current: WasmGitCommit | null = null;
        try {
          current = repo.headCommit();
        } catch {
          // No commits yet
          return [];
        }

        let count = 0;
        while (current && count < maxCount) {
          commits.push({
            oid: current.oid(),
            message: current.message(),
            parentOids: current.parents().map((p) => p.oid()),
            author: {
              name: current.author().name,
              email: current.author().email,
              time: current.author().time,
            },
            committer: {
              name: current.committer().name,
              email: current.committer().email,
              time: current.committer().time,
            },
          });

          count++;

          // Get first parent
          const parents = current.parents();
          current = parents.length > 0 ? (parents[0] ?? null) : null;
        }

        return convertCommits(commits);
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async commit(
    workdir: string,
    message: string,
    opts?: CommitOpts & BackendExecOpts,
  ): Promise<CommitResult> {
    const wasm = await this.getWasmGit();

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        // Parse author or use default
        let authorName = 'Unknown';
        let authorEmail = 'unknown@unknown.com';

        if (opts?.author) {
          const match = opts.author.match(/^(.+?)\s*<(.+?)>$/);
          if (match?.[1] && match[2]) {
            authorName = match[1].trim();
            authorEmail = match[2].trim();
          }
        }

        const signature = wasm.lg.Signature.now(authorName, authorEmail);

        // Get index and write tree
        const index = repo.index();
        index.write();
        const tree = index.writeTree();

        // Get parents
        const parents: WasmGitCommit[] = [];
        try {
          parents.push(repo.headCommit());
        } catch {
          // Initial commit, no parents
        }

        // Create commit
        const hash = repo.createCommit('HEAD', signature, signature, message, tree, parents);

        // Get current branch
        let branch = 'HEAD';
        try {
          const head = repo.head();
          branch = head.shorthand();
        } catch {
          // Ignore errors
        }

        return {
          hash,
          branch,
          summary: message.split('\n')[0] ?? message,
          filesChanged: 0,
          insertions: 0,
          deletions: 0,
        };
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async add(
    workdir: string,
    paths: string[],
    opts?: BackendAddOpts & BackendExecOpts,
  ): Promise<void> {
    const wasm = await this.getWasmGit();

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        const index = repo.index();

        if (opts?.all || paths.includes('.')) {
          index.addAll();
        } else {
          for (const filepath of paths) {
            index.addByPath(filepath);
          }
        }

        index.write();
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async branchList(
    workdir: string,
    _opts?: BranchOpts & BackendExecOpts,
  ): Promise<BranchInfo[]> {
    const wasm = await this.getWasmGit();

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        const branches = repo.branches();
        return convertBranches(branches);
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async branchCreate(
    workdir: string,
    name: string,
    opts?: BackendBranchCreateOpts & BackendExecOpts,
  ): Promise<void> {
    const wasm = await this.getWasmGit();

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        const commit = repo.headCommit();
        repo.createBranch(name, commit, opts?.force ?? false);
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  // ===========================================================================
  // Extended Operations (Tier 1 + Tier 2)
  // Note: wasm-git support varies by build. These methods check for capability.
  // ===========================================================================

  public async fetch(workdir: string, opts?: FetchOpts & BackendExecOpts): Promise<void> {
    const wasm = await this.getWasmGit();

    if (!wasm.lg.Remote) {
      throw new GitError('CapabilityMissing', 'Fetch is not supported by this wasm-git build.', {});
    }

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        const remoteName = opts?.remote ?? 'origin';
        const remote = wasm.lg.Remote.lookup(repo, remoteName);
        remote.fetch([]);
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async push(workdir: string, opts?: PushOpts & BackendExecOpts): Promise<void> {
    const wasm = await this.getWasmGit();

    if (!wasm.lg.Remote) {
      throw new GitError('CapabilityMissing', 'Push is not supported by this wasm-git build.', {});
    }

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        const remoteName = opts?.remote ?? 'origin';
        const remote = wasm.lg.Remote.lookup(repo, remoteName);

        // Build refspecs
        const refSpecs: string[] = [];
        if (opts?.refspec) {
          const specs = Array.isArray(opts.refspec) ? opts.refspec : [opts.refspec];
          for (const spec of specs) {
            if (opts?.force && !spec.startsWith('+')) {
              refSpecs.push(`+${spec}`);
            } else {
              refSpecs.push(spec);
            }
          }
        } else {
          // Default: push current branch
          const head = repo.head();
          const branch = head.shorthand();
          if (opts?.force) {
            refSpecs.push(`+refs/heads/${branch}:refs/heads/${branch}`);
          } else {
            refSpecs.push(`refs/heads/${branch}:refs/heads/${branch}`);
          }
        }

        remote.push(refSpecs);
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async checkout(
    workdir: string,
    target: string,
    opts?: CheckoutBranchOpts & BackendExecOpts,
  ): Promise<void> {
    const wasm = await this.getWasmGit();

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        if (opts?.createBranch || opts?.forceCreateBranch) {
          // Create new branch and checkout
          let startCommit: WasmGitCommit;
          if (opts?.startPoint && repo.getCommit) {
            startCommit = repo.getCommit(opts.startPoint);
          } else {
            startCommit = repo.headCommit();
          }
          repo.createBranch(target, startCommit, opts?.forceCreateBranch ?? false);
        }

        // Checkout the branch
        if (repo.checkoutBranch) {
          repo.checkoutBranch(target, opts?.force ? { force: true } : undefined);
        } else if (wasm.lg.Checkout) {
          wasm.lg.Checkout.head(repo, opts?.force ? { force: true } : undefined);
        } else {
          throw new GitError('CapabilityMissing', 'Checkout is not supported by this wasm-git build.', {});
        }
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async checkoutPaths(
    workdir: string,
    paths: string[],
    opts?: CheckoutPathOpts & BackendExecOpts,
  ): Promise<void> {
    const wasm = await this.getWasmGit();

    if (!wasm.lg.Checkout) {
      throw new GitError('CapabilityMissing', 'CheckoutPaths is not supported by this wasm-git build.', {});
    }

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        const checkoutOpts = { paths };

        if (opts?.source && repo.getCommit) {
          const commit = repo.getCommit(opts.source);
          wasm.lg.Checkout.tree(repo, commit, checkoutOpts);
        } else {
          wasm.lg.Checkout.head(repo, checkoutOpts);
        }
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async diff(
    workdir: string,
    target?: string,
    opts?: DiffOpts & BackendExecOpts,
  ): Promise<DiffResult> {
    const wasm = await this.getWasmGit();

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        let diffList: WasmGitDiffList | undefined;

        if (target && repo.diffTreeToTree && repo.getCommit) {
          // Diff between target and HEAD
          const targetCommit = repo.getCommit(target);
          const headCommit = repo.headCommit();
          // Get trees from commits (simplified - actual API may differ)
          const targetTree = (targetCommit as unknown as { tree(): unknown }).tree?.();
          const headTree = (headCommit as unknown as { tree(): unknown }).tree?.();
          if (targetTree && headTree) {
            diffList = repo.diffTreeToTree(targetTree, headTree);
          }
        } else if (opts?.staged && repo.diffTreeToIndex) {
          // Diff of staged changes
          const headCommit = repo.headCommit();
          const tree = (headCommit as unknown as { tree(): unknown }).tree?.();
          if (tree) {
            diffList = repo.diffTreeToIndex(tree);
          }
        } else if (repo.diffIndexToWorkdir) {
          // Diff of unstaged changes
          diffList = repo.diffIndexToWorkdir();
        }

        if (!diffList) {
          throw new GitError('CapabilityMissing', 'Diff is not supported by this wasm-git build.', {});
        }

        // Convert diff deltas to file entries
        // libgit2 status values: GIT_DELTA_ADDED=1, DELETED=2, MODIFIED=3, RENAMED=4, etc.
        const files = diffList.deltas().map((delta) => {
          const statusNum = delta.status();
          let status: 'A' | 'D' | 'M' | 'R' | 'T' | 'U' = 'M';
          if (statusNum === 1) status = 'A';
          else if (statusNum === 2) status = 'D';
          else if (statusNum === 4) status = 'R';

          return {
            path: delta.newFile().path() || delta.oldFile().path(),
            status,
            oldPath: statusNum === 4 ? delta.oldFile().path() : undefined,
          };
        });

        return { files };
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async reset(
    workdir: string,
    target?: string,
    opts?: ResetOpts & BackendExecOpts,
  ): Promise<void> {
    const wasm = await this.getWasmGit();

    if (!wasm.lg.Reset) {
      throw new GitError('CapabilityMissing', 'Reset is not supported by this wasm-git build.', {});
    }

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        // Get target commit
        let commit: WasmGitCommit;
        if (target && repo.getCommit) {
          commit = repo.getCommit(target);
        } else {
          commit = repo.headCommit();
        }

        // Determine reset type
        // libgit2 reset types: SOFT=1, MIXED=2, HARD=3
        const RESET_SOFT = 1;
        const RESET_MIXED = 2;
        const RESET_HARD = 3;

        let resetType = RESET_MIXED; // default
        if (opts?.mode === 'soft') {
          resetType = RESET_SOFT;
        } else if (opts?.mode === 'hard') {
          resetType = RESET_HARD;
        }

        wasm.lg.Reset.reset(repo, commit, resetType);
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async merge(
    workdir: string,
    branch: string,
    opts?: MergeOpts & BackendExecOpts,
  ): Promise<MergeResult> {
    const wasm = await this.getWasmGit();

    if (!wasm.lg.Merge) {
      throw new GitError('CapabilityMissing', 'Merge is not supported by this wasm-git build.', {});
    }

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        // Get the branch commit
        let theirCommit: WasmGitCommit | undefined;
        if (repo.getBranchCommit) {
          theirCommit = repo.getBranchCommit(branch);
        } else if (repo.getCommit) {
          // Try to resolve as a ref
          theirCommit = repo.getCommit(branch);
        }

        if (!theirCommit) {
          throw new GitError('NonZeroExit', `Branch '${branch}' not found.`, {});
        }

        const mergeOpts = {
          ffOnly: opts?.ff === 'only',
          noFf: opts?.ff === 'no' || opts?.ff === false,
        };

        const result = wasm.lg.Merge.merge(repo, theirCommit, mergeOpts);

        if (result.hasConflicts) {
          return {
            success: false,
            conflicts: result.conflictedFiles ?? [],
          };
        }

        return { success: true, conflicts: [] };
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async pull(workdir: string, opts?: PullOpts & BackendExecOpts): Promise<void> {
    // Pull is composed as fetch + merge
    await this.fetch(workdir, {
      remote: opts?.remote,
      signal: opts?.signal,
    });

    // Get remote tracking branch
    const wasm = await this.getWasmGit();
    const repo = wasm.lg.Repository.open(workdir);

    try {
      const head = repo.head();
      const branchName = head.shorthand();
      const remote = opts?.remote ?? 'origin';

      await this.merge(workdir, `${remote}/${branchName}`, {
        ff: opts?.ff,
      });
    } finally {
      repo.free();
    }
  }

  public async stashPush(workdir: string, opts?: StashPushOpts & BackendExecOpts): Promise<void> {
    const wasm = await this.getWasmGit();

    if (!wasm.lg.Stash) {
      throw new GitError('CapabilityMissing', 'Stash is not supported by this wasm-git build.', {});
    }

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        const signature = wasm.lg.Signature.now('type-git', 'type-git@localhost');
        const message = opts?.message ?? '';
        let flags = 0;

        if (opts?.includeUntracked) {
          flags |= wasm.lg.Stash.INCLUDE_UNTRACKED;
        }
        if (opts?.keepIndex) {
          flags |= wasm.lg.Stash.KEEP_INDEX;
        }

        wasm.lg.Stash.save(repo, signature, message, flags);
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async stashPop(workdir: string, opts?: StashApplyOpts & BackendExecOpts): Promise<void> {
    const wasm = await this.getWasmGit();

    if (!wasm.lg.Stash) {
      throw new GitError('CapabilityMissing', 'Stash is not supported by this wasm-git build.', {});
    }

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        const index = opts?.index ?? 0;
        wasm.lg.Stash.pop(repo, index);
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async stashList(workdir: string, _opts?: BackendExecOpts): Promise<StashEntry[]> {
    const wasm = await this.getWasmGit();

    if (!wasm.lg.Stash) {
      throw new GitError('CapabilityMissing', 'Stash is not supported by this wasm-git build.', {});
    }

    try {
      const repo = wasm.lg.Repository.open(workdir);
      const entries: StashEntry[] = [];

      try {
        wasm.lg.Stash.foreach(repo, (index, message, oid) => {
          entries.push({
            index,
            message,
            commit: oid.substring(0, 7),
            branch: undefined,
          });
          return 0; // Continue iteration
        });

        return entries;
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async tagList(workdir: string, opts?: TagListOpts & BackendExecOpts): Promise<string[]> {
    const wasm = await this.getWasmGit();

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        let tags: string[];

        if (repo.tags) {
          tags = repo.tags();
        } else if (wasm.lg.Tag) {
          tags = wasm.lg.Tag.list(repo);
        } else {
          throw new GitError('CapabilityMissing', 'Tag is not supported by this wasm-git build.', {});
        }

        // Apply pattern filter if specified
        if (opts?.pattern) {
          const regex = new RegExp(
            opts.pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
          );
          tags = tags.filter((tag) => regex.test(tag));
        }

        return tags;
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async tagCreate(
    workdir: string,
    name: string,
    opts?: TagCreateOpts & BackendExecOpts,
  ): Promise<void> {
    const wasm = await this.getWasmGit();

    if (!wasm.lg.Tag) {
      throw new GitError('CapabilityMissing', 'Tag is not supported by this wasm-git build.', {});
    }

    try {
      const repo = wasm.lg.Repository.open(workdir);

      try {
        // Get target commit
        let targetCommit: WasmGitCommit;
        if (opts?.commit && repo.getCommit) {
          targetCommit = repo.getCommit(opts.commit);
        } else {
          targetCommit = repo.headCommit();
        }

        if (opts?.message) {
          // Annotated tag
          const signature = wasm.lg.Signature.now('type-git', 'type-git@localhost');
          wasm.lg.Tag.create(repo, name, targetCommit, signature, opts.message, opts?.force ?? false);
        } else {
          // Lightweight tag
          wasm.lg.Tag.createLightweight(repo, name, targetCommit, opts?.force ?? false);
        }
      } finally {
        repo.free();
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private mapError(error: unknown): GitError {
    if (error instanceof GitError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    // Detect error category from message
    let category: 'auth' | 'network' | 'conflict' | 'permission' | 'unknown' = 'unknown';

    if (message.includes('authentication') || message.includes('401')) {
      category = 'auth';
    } else if (message.includes('network') || message.includes('fetch')) {
      category = 'network';
    } else if (message.includes('conflict')) {
      category = 'conflict';
    } else if (message.includes('permission')) {
      category = 'permission';
    }

    return new GitError('NonZeroExit', message, {}, category);
  }
}

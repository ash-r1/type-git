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
  Commit,
  CommitOpts,
  CommitResult,
  LogOpts,
  StatusOpts,
  StatusPorcelain,
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
  };

  /** Ready promise */
  ready?: Promise<void>;
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

/**
 * Backend-based BareRepo implementation
 *
 * This module provides a BareRepo implementation that uses GitBackend
 * for all operations, allowing the use of alternative Git implementations.
 */

import type { GitBackend } from '../core/backend.js';
import type {
  BareRepo,
  ConfigOperations,
  LsTreeEntry,
  LsTreeOpts,
  RemoteOperations,
  RepoLsRemoteOpts,
  RepoLsRemoteResult,
  RevParseBooleanQuery,
  RevParseListQuery,
  RevParsePathOpts,
  RevParsePathQuery,
  RevParseRefOpts,
} from '../core/repo.js';
import type { ExecOpts, RawResult } from '../core/types.js';
import { GitError } from '../core/types.js';
import type { LsRemoteRef } from '../parsers/index.js';

/**
 * Backend-based BareRepo implementation
 *
 * This is a minimal implementation that supports the MVP operations.
 * Many advanced operations throw CapabilityMissing errors.
 */
export class BackendBareRepoImpl implements BareRepo {
  private readonly backend: GitBackend;
  public readonly gitDir: string;

  public readonly remote: RemoteOperations;
  public readonly config: ConfigOperations;

  public constructor(backend: GitBackend, gitDir: string) {
    this.backend = backend;
    this.gitDir = gitDir;

    // Initialize remote operations (not supported in MVP)
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

    // Initialize config operations (not supported in MVP)
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

    return this.backend.raw({ type: 'bare', gitDir: this.gitDir }, argv, opts);
  }

  public async isWorktree(): Promise<boolean> {
    return false;
  }

  public async isBare(): Promise<boolean> {
    return true;
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

    const result = await this.backend.raw({ type: 'bare', gitDir: this.gitDir }, args, opts);

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

    const result = await this.backend.raw({ type: 'bare', gitDir: this.gitDir }, args, opts);

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
  // Unsupported Operations
  // ===========================================================================

  public async fetch(): Promise<void> {
    return this.unsupportedOp('fetch');
  }

  public async push(): Promise<void> {
    return this.unsupportedOp('push');
  }

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

  private async unsupportedOp(name: string): Promise<never> {
    const caps = this.backend.getCapabilities();
    throw new GitError(
      'CapabilityMissing',
      `${name} is not supported by ${caps.type} backend in MVP mode.`,
      {},
    );
  }
}

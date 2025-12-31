/**
 * BareRepo implementation - repository without working directory
 */

import type {
  BareRepo,
  ConfigEntry,
  ConfigGetOpts,
  ConfigKey,
  ConfigListOpts,
  ConfigOperations,
  ConfigSchema,
  ConfigSetOpts,
  FetchOpts,
  PushOpts,
  RemoteAddOpts,
  RemoteInfo,
  RemoteOperations,
  RemotePruneOpts,
  RemoteSetBranchesOpts,
  RemoteSetHeadOpts,
  RemoteShowOpts,
  RemoteUpdateOpts,
  RemoteUrlOpts,
  RevParseBooleanQuery,
  RevParseListQuery,
  RevParsePathOpts,
  RevParsePathQuery,
  RevParseRefOpts,
} from '../core/repo.js';
import type { ExecOpts, ExecutionContext, RawResult } from '../core/types.js';
import { parseLines } from '../parsers/index.js';
import type { CliRunner } from '../runner/cli-runner.js';

/**
 * BareRepo implementation
 */
export class BareRepoImpl implements BareRepo {
  public readonly gitDir: string;
  private readonly runner: CliRunner;
  public readonly remote: RemoteOperations;
  public readonly config: ConfigOperations;

  public constructor(runner: CliRunner, gitDir: string, _options?: unknown) {
    this.runner = runner;
    this.gitDir = gitDir;

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
    return { type: 'bare', gitDir: this.gitDir };
  }

  /**
   * Execute a raw git command in this repository context
   */
  public raw(argv: Array<string>, opts?: ExecOpts): Promise<RawResult> {
    return this.runner.run(this.context, argv, opts);
  }

  /**
   * Check if this repository is a worktree repository (has working directory)
   *
   * For BareRepoImpl, this queries git and returns the actual state.
   */
  public async isWorktree(): Promise<boolean> {
    const result = await this.runner.run(this.context, ['rev-parse', '--is-inside-work-tree']);
    return result.exitCode === 0 && result.stdout.trim() === 'true';
  }

  /**
   * Check if this repository is a bare repository (no working directory)
   *
   * For BareRepoImpl, this returns the actual state from git.
   */
  public async isBare(): Promise<boolean> {
    const result = await this.runner.run(this.context, ['rev-parse', '--is-bare-repository']);
    return result.exitCode === 0 && result.stdout.trim() === 'true';
  }

  /**
   * Parse revision specification and return information about the repository
   */
  public revParse(ref: string, opts?: RevParseRefOpts & ExecOpts): Promise<string>;
  public revParse(opts: RevParsePathQuery & RevParsePathOpts & ExecOpts): Promise<string>;
  public revParse(opts: RevParseBooleanQuery & ExecOpts): Promise<boolean>;
  public revParse(opts: RevParseListQuery & ExecOpts): Promise<Array<string>>;
  public revParse(
    opts: { showObjectFormat: true | 'storage' | 'input' | 'output' } & ExecOpts,
  ): Promise<string>;
  public revParse(opts: { showRefFormat: true } & ExecOpts): Promise<string>;
  public revParse(opts: { localEnvVars: true } & ExecOpts): Promise<Array<string>>;
  public async revParse(
    refOrOpts:
      | string
      | (RevParsePathQuery & RevParsePathOpts & ExecOpts)
      | (RevParseBooleanQuery & ExecOpts)
      | (RevParseListQuery & ExecOpts)
      | ({ showObjectFormat: true | 'storage' | 'input' | 'output' } & ExecOpts)
      | ({ showRefFormat: true } & ExecOpts)
      | ({ localEnvVars: true } & ExecOpts),
    opts?: RevParseRefOpts & ExecOpts,
  ): Promise<string | boolean | Array<string>> {
    const args: Array<string> = ['rev-parse'];

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

    // Add path format option if present
    if ('pathFormat' in queryOpts && queryOpts.pathFormat) {
      args.push(`--path-format=${queryOpts.pathFormat}`);
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

  // ==========================================================================
  // Remote Operations
  // ==========================================================================

  private async remoteList(opts?: ExecOpts): Promise<Array<RemoteInfo>> {
    const result = await this.runner.runOrThrow(this.context, ['remote', '-v'], {
      signal: opts?.signal,
    });

    const remotes = new Map<string, RemoteInfo>();

    for (const line of parseLines(result.stdout)) {
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

  private async remotePrune(
    remote: string,
    opts?: RemotePruneOpts & ExecOpts,
  ): Promise<Array<string>> {
    const args = ['remote', 'prune'];

    if (opts?.dryRun) {
      args.push('--dry-run');
    }

    args.push(remote);

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    // Parse pruned refs from output
    const pruned: Array<string> = [];
    for (const line of parseLines(result.stdout)) {
      const match = line.match(/\* \[pruned\] (.+)/);
      const ref = match?.[1];
      if (ref) {
        pruned.push(ref);
      }
    }

    return pruned;
  }

  private async remoteUpdate(
    remotes?: Array<string>,
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
    branches: Array<string>,
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
    const result = await this.runner.run(this.context, ['config', '--get', key], {
      signal: opts?.signal,
    });

    if (result.exitCode !== 0) {
      return undefined;
    }

    return result.stdout.trim() as ConfigSchema[K];
  }

  /**
   * Get all values for a typed multi-valued config key
   */
  private async configGetAll<K extends ConfigKey>(
    key: K,
    opts?: ExecOpts,
  ): Promise<Array<ConfigSchema[K]>> {
    const result = await this.runner.run(this.context, ['config', '--get-all', key], {
      signal: opts?.signal,
    });

    if (result.exitCode !== 0) {
      return [];
    }

    return parseLines(result.stdout) as Array<ConfigSchema[K]>;
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
  private async configGetRaw(
    key: string,
    opts?: ConfigGetOpts & ExecOpts,
  ): Promise<string | Array<string> | undefined> {
    const args = ['config'];

    if (opts?.all) {
      args.push('--get-all');
    } else {
      args.push('--get');
    }

    args.push(key);

    const result = await this.runner.run(this.context, args, {
      signal: opts?.signal,
    });

    if (result.exitCode !== 0) {
      return undefined;
    }

    if (opts?.all) {
      return parseLines(result.stdout);
    }

    return result.stdout.trim();
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
  private async configList(opts?: ConfigListOpts & ExecOpts): Promise<Array<ConfigEntry>> {
    const args = ['config', '--list'];

    if (opts?.showOrigin) {
      args.push('--show-origin');
    }

    if (opts?.showScope) {
      args.push('--show-scope');
    }

    if (opts?.includes) {
      args.push('--includes');
    }

    if (opts?.nameOnly) {
      args.push('--name-only');
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: opts?.signal,
    });

    const entries: Array<ConfigEntry> = [];
    for (const line of parseLines(result.stdout)) {
      let keyValue = line;
      if (opts?.showOrigin || opts?.showScope) {
        const tabIndex = line.lastIndexOf('\t');
        if (tabIndex !== -1) {
          keyValue = line.slice(tabIndex + 1);
        }
      }

      if (opts?.nameOnly) {
        entries.push({
          key: keyValue,
          value: '',
        });
      } else {
        const eqIndex = keyValue.indexOf('=');
        if (eqIndex !== -1) {
          entries.push({
            key: keyValue.slice(0, eqIndex),
            value: keyValue.slice(eqIndex + 1),
          });
        }
      }
    }

    return entries;
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

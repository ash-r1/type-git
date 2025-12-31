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
  LsTreeEntry,
  LsTreeOpts,
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
  RepoLsRemoteOpts,
  RepoLsRemoteResult,
  RevParseBooleanQuery,
  RevParseListQuery,
  RevParsePathOpts,
  RevParsePathQuery,
  RevParseRefOpts,
} from '../core/repo.js';
import type { ExecOpts, ExecutionContext, RawResult } from '../core/types.js';
import { parseLines, parseLsRemote, parseLsTree } from '../parsers/index.js';
import type { CliRunner } from '../runner/cli-runner.js';

// =============================================================================
// Regex patterns
// =============================================================================

/** Pattern for parsing remote -v output: name<tab>url (fetch|push) */
const REMOTE_LINE_PATTERN = /^(\S+)\t(.+?)\s+\((fetch|push)\)$/;

/** Pattern for parsing pruned refs from remote prune output */
const PRUNED_REF_PATTERN = /\* \[pruned\] (.+)/;

// =============================================================================
// remote list helper functions
// =============================================================================

/**
 * Parse a single line from 'git remote -v' output and update the remotes map
 */
function parseRemoteLine(line: string, remotes: Map<string, RemoteInfo>): void {
  const match = line.match(REMOTE_LINE_PATTERN);
  if (!match) {
    return;
  }

  const name = match[1];
  const url = match[2];
  const type = match[3];

  if (name === undefined || url === undefined) {
    return;
  }

  const existing = remotes.get(name);
  if (existing) {
    updateRemoteUrl(existing, type, url);
  } else {
    remotes.set(name, {
      name,
      fetchUrl: type === 'fetch' ? url : '',
      pushUrl: type === 'push' ? url : '',
    });
  }
}

/**
 * Update fetch or push URL on an existing remote entry
 */
function updateRemoteUrl(remote: RemoteInfo, type: string | undefined, url: string): void {
  if (type === 'fetch') {
    remote.fetchUrl = url;
  } else if (type === 'push') {
    remote.pushUrl = url;
  }
}

/**
 * Normalize remote URLs by filling in missing fetch/push with the other value
 */
function normalizeRemoteUrls(remotes: Map<string, RemoteInfo>): void {
  for (const remote of remotes.values()) {
    if (!remote.fetchUrl && remote.pushUrl) {
      remote.fetchUrl = remote.pushUrl;
    }
    if (!remote.pushUrl && remote.fetchUrl) {
      remote.pushUrl = remote.fetchUrl;
    }
  }
}

// =============================================================================
// rev-parse helper functions
// =============================================================================

/**
 * Add ref resolution options to args
 */
function addRefOptions(args: string[], opts?: RevParseRefOpts): void {
  if (!opts) {
    return;
  }

  if (opts.verify) {
    args.push('--verify');
  }

  if (opts.short !== undefined) {
    if (typeof opts.short === 'number') {
      args.push(`--short=${opts.short}`);
    } else if (opts.short) {
      args.push('--short');
    }
  }

  if (opts.abbrevRef !== undefined) {
    if (opts.abbrevRef === 'strict') {
      args.push('--abbrev-ref=strict');
    } else if (opts.abbrevRef === 'loose') {
      args.push('--abbrev-ref=loose');
    } else if (opts.abbrevRef) {
      args.push('--abbrev-ref');
    }
  }

  if (opts.symbolic) {
    args.push('--symbolic');
  }

  if (opts.symbolicFullName) {
    args.push('--symbolic-full-name');
  }

  if (opts.quiet) {
    args.push('--quiet');
  }
}

// Path query mappings: key -> flag
const PATH_QUERY_FLAGS: [string, string][] = [
  ['gitDir', '--git-dir'],
  ['absoluteGitDir', '--absolute-git-dir'],
  ['gitCommonDir', '--git-common-dir'],
  ['showToplevel', '--show-toplevel'],
  ['showCdup', '--show-cdup'],
  ['showPrefix', '--show-prefix'],
  ['showSuperprojectWorkingTree', '--show-superproject-working-tree'],
  ['sharedIndexPath', '--shared-index-path'],
];

// Path query mappings with values: key -> flag (value is appended)
const PATH_QUERY_VALUE_FLAGS: [string, string][] = [
  ['gitPath', '--git-path'],
  ['resolveGitDir', '--resolve-git-dir'],
];

// Boolean query mappings: key -> flag
const BOOLEAN_QUERY_FLAGS: [string, string][] = [
  ['isInsideGitDir', '--is-inside-git-dir'],
  ['isInsideWorkTree', '--is-inside-work-tree'],
  ['isBareRepository', '--is-bare-repository'],
  ['isShallowRepository', '--is-shallow-repository'],
];

// List query mappings: key -> flag (some have optional pattern value)
const LIST_QUERY_FLAGS: [string, string][] = [
  ['all', '--all'],
  ['branches', '--branches'],
  ['tags', '--tags'],
  ['remotes', '--remotes'],
];

/**
 * Add exclude options to args (for list queries)
 */
function addExcludeOptions(args: string[], opts: Record<string, unknown>): void {
  if ('exclude' in opts && opts.exclude) {
    args.push(`--exclude=${opts.exclude}`);
  }
  if ('excludeHidden' in opts && opts.excludeHidden) {
    args.push(`--exclude-hidden=${opts.excludeHidden}`);
  }
}

/**
 * Try to add path query flag to args
 * @returns true if a path query was matched
 */
function tryAddPathQuery(args: string[], opts: Record<string, unknown>): boolean {
  // Simple boolean path queries
  for (const [key, flag] of PATH_QUERY_FLAGS) {
    if (key in opts && opts[key]) {
      args.push(flag);
      return true;
    }
  }

  // Path queries with values
  for (const [key, flag] of PATH_QUERY_VALUE_FLAGS) {
    if (key in opts && typeof opts[key] === 'string') {
      args.push(flag, opts[key] as string);
      return true;
    }
  }

  return false;
}

/**
 * Try to add boolean query flag to args
 * @returns true if a boolean query was matched
 */
function tryAddBooleanQuery(args: string[], opts: Record<string, unknown>): boolean {
  for (const [key, flag] of BOOLEAN_QUERY_FLAGS) {
    if (key in opts && opts[key]) {
      args.push(flag);
      return true;
    }
  }
  return false;
}

/**
 * Try to add list query flag to args
 * @returns true if a list query was matched
 */
function tryAddListQuery(args: string[], opts: Record<string, unknown>): boolean {
  // Standard list queries with optional pattern
  for (const [key, flag] of LIST_QUERY_FLAGS) {
    if (key in opts && opts[key]) {
      addExcludeOptions(args, opts);
      if (typeof opts[key] === 'string') {
        args.push(`${flag}=${opts[key]}`);
      } else {
        args.push(flag);
      }
      return true;
    }
  }

  // glob query
  if ('glob' in opts && typeof opts.glob === 'string') {
    addExcludeOptions(args, opts);
    args.push(`--glob=${opts.glob}`);
    return true;
  }

  // disambiguate query
  if ('disambiguate' in opts && typeof opts.disambiguate === 'string') {
    args.push(`--disambiguate=${opts.disambiguate}`);
    return true;
  }

  return false;
}

/**
 * Try to add other query flag to args
 * @returns true if another query was matched
 */
function tryAddOtherQuery(args: string[], opts: Record<string, unknown>): boolean {
  if ('showObjectFormat' in opts && opts.showObjectFormat) {
    if (opts.showObjectFormat === true) {
      args.push('--show-object-format');
    } else {
      args.push(`--show-object-format=${opts.showObjectFormat}`);
    }
    return true;
  }

  if ('showRefFormat' in opts && opts.showRefFormat) {
    args.push('--show-ref-format');
    return true;
  }

  if ('localEnvVars' in opts && opts.localEnvVars) {
    args.push('--local-env-vars');
    return true;
  }

  return false;
}

/**
 * Check if options represent a boolean query
 */
function isBooleanQuery(opts: Record<string, unknown>): boolean {
  for (const [key] of BOOLEAN_QUERY_FLAGS) {
    if (key in opts && opts[key]) {
      return true;
    }
  }
  return false;
}

/**
 * Check if options represent a list query
 */
function isListQuery(opts: Record<string, unknown>): boolean {
  for (const [key] of LIST_QUERY_FLAGS) {
    if (key in opts && opts[key]) {
      return true;
    }
  }
  return (
    ('glob' in opts && !!opts.glob) ||
    ('disambiguate' in opts && !!opts.disambiguate) ||
    ('localEnvVars' in opts && !!opts.localEnvVars)
  );
}

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
  public raw(argv: string[], opts?: ExecOpts): Promise<RawResult> {
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
   * List references in a remote repository
   */
  public async lsRemote(
    remote: string,
    opts?: RepoLsRemoteOpts & ExecOpts,
  ): Promise<RepoLsRemoteResult> {
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
    if (opts?.getUrl) {
      args.push('--get-url');
    }

    if (opts?.sort) {
      args.push('--sort', opts.sort);
    }

    if (opts?.symref) {
      args.push('--symref');
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
  public async lsTree(treeish: string, opts?: LsTreeOpts & ExecOpts): Promise<LsTreeEntry[]> {
    const args: string[] = ['ls-tree'];

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

    if (opts?.nameOnly) {
      args.push('--name-only');
    }

    if (opts?.objectOnly) {
      args.push('--object-only');
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

    return parseLsTree(result.stdout, {
      nameOnly: opts?.nameOnly,
      objectOnly: opts?.objectOnly,
      long: opts?.long,
    });
  }

  /**
   * Parse revision specification and return information about the repository
   */
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
    refOrOpts:
      | string
      | (RevParsePathQuery & RevParsePathOpts & ExecOpts)
      | (RevParseBooleanQuery & ExecOpts)
      | (RevParseListQuery & ExecOpts)
      | ({ showObjectFormat: true | 'storage' | 'input' | 'output' } & ExecOpts)
      | ({ showRefFormat: true } & ExecOpts)
      | ({ localEnvVars: true } & ExecOpts),
    opts?: RevParseRefOpts & ExecOpts,
  ): Promise<string | boolean | string[]> {
    const args: string[] = ['rev-parse'];

    // Handle ref string case (first overload)
    if (typeof refOrOpts === 'string') {
      addRefOptions(args, opts);
      args.push(refOrOpts);

      const result = await this.runner.runOrThrow(this.context, args, {
        signal: opts?.signal,
      });
      return result.stdout.trim();
    }

    // Handle options object cases
    const queryOpts = refOrOpts as Record<string, unknown>;

    // Try each query type in order (mutually exclusive)
    tryAddPathQuery(args, queryOpts) ||
      tryAddBooleanQuery(args, queryOpts) ||
      tryAddListQuery(args, queryOpts) ||
      tryAddOtherQuery(args, queryOpts);

    // Add path format option if present (applies to path queries)
    if ('pathFormat' in queryOpts && queryOpts.pathFormat) {
      args.push(`--path-format=${queryOpts.pathFormat}`);
    }

    const result = await this.runner.runOrThrow(this.context, args, {
      signal: refOrOpts.signal,
    });

    const output = result.stdout.trim();

    // Determine return type based on query type
    if (isBooleanQuery(queryOpts)) {
      return output === 'true';
    }

    if (isListQuery(queryOpts)) {
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

  private async remoteList(opts?: ExecOpts): Promise<RemoteInfo[]> {
    const result = await this.runner.runOrThrow(this.context, ['remote', '-v'], {
      signal: opts?.signal,
    });

    const remotes = new Map<string, RemoteInfo>();

    for (const line of parseLines(result.stdout)) {
      parseRemoteLine(line, remotes);
    }

    normalizeRemoteUrls(remotes);

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
      const match = line.match(PRUNED_REF_PATTERN);
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
  ): Promise<ConfigSchema[K][]> {
    const result = await this.runner.run(this.context, ['config', '--get-all', key], {
      signal: opts?.signal,
    });

    if (result.exitCode !== 0) {
      return [];
    }

    return parseLines(result.stdout) as ConfigSchema[K][];
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
  ): Promise<string | string[] | undefined> {
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
  private async configList(opts?: ConfigListOpts & ExecOpts): Promise<ConfigEntry[]> {
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

    const entries: ConfigEntry[] = [];
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

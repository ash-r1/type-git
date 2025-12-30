/**
 * Git implementation - repository-agnostic operations
 */

import type { RuntimeAdapters } from '../core/adapters.js';
import type {
  CloneOpts,
  Git,
  GlobalConfigListOpts,
  GlobalConfigOperations,
  InitOpts,
  LsRemoteOpts,
  LsRemoteResult,
} from '../core/git.js';
import type {
  BareRepo,
  ConfigEntry,
  ConfigGetOpts,
  ConfigKey,
  ConfigSchema,
  ConfigSetOpts,
  WorktreeRepo,
} from '../core/repo.js';
import type { ExecOpts, GitOpenOptions, RawResult } from '../core/types.js';
import { GitError } from '../core/types.js';
import { parseLines, parseLsRemote } from '../parsers/index.js';
import { CliRunner, type CliRunnerOptions } from '../runner/cli-runner.js';
import { BareRepoImpl } from './bare-repo-impl.js';
import { WorktreeRepoImpl } from './worktree-repo-impl.js';

/**
 * Options for creating a Git instance
 */
export type CreateGitOptions = CliRunnerOptions & {
  /** Runtime adapters (exec, fs) */
  adapters: RuntimeAdapters;
};

/**
 * Convert GitOpenOptions to CliRunnerOptions
 */
function toCliRunnerOptions(opts?: GitOpenOptions): CliRunnerOptions {
  if (!opts) {
    return {};
  }

  return {
    env: opts.env,
    pathPrefix: opts.pathPrefix,
    home: opts.home,
    credential: opts.credential
      ? {
          helper: opts.credential.helper,
          helperPath: opts.credential.helperPath,
        }
      : undefined,
  };
}

/**
 * Git implementation
 */
export class GitImpl implements Git {
  private readonly runner: CliRunner;
  public readonly config: GlobalConfigOperations;

  public constructor(options: CreateGitOptions) {
    this.runner = new CliRunner(options.adapters, options);

    // Initialize global config operations
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
    };
  }

  /**
   * Open an existing repository
   */
  public async open(path: string, opts?: GitOpenOptions): Promise<WorktreeRepo | BareRepo> {
    // Create a runner with custom options if provided
    const repoRunner = opts ? this.runner.withOptions(toCliRunnerOptions(opts)) : this.runner;

    // Check if it's a bare repository
    const result = await repoRunner.run({ type: 'worktree', workdir: path }, [
      'rev-parse',
      '--is-bare-repository',
    ]);

    if (result.exitCode !== 0) {
      // Try as git-dir directly
      const bareResult = await repoRunner.run({ type: 'bare', gitDir: path }, [
        'rev-parse',
        '--is-bare-repository',
      ]);

      if (bareResult.exitCode !== 0) {
        throw new GitError('NonZeroExit', `Not a git repository: ${path}`, {
          exitCode: bareResult.exitCode,
          stderr: bareResult.stderr,
        });
      }

      if (bareResult.stdout.trim() === 'true') {
        return new BareRepoImpl(repoRunner, path, opts);
      }
    }

    const isBare = result.stdout.trim() === 'true';

    if (isBare) {
      // Find the actual git-dir
      const gitDirResult = await repoRunner.run({ type: 'worktree', workdir: path }, [
        'rev-parse',
        '--git-dir',
      ]);
      const gitDir = gitDirResult.stdout.trim();
      return new BareRepoImpl(repoRunner, gitDir, opts);
    }

    return new WorktreeRepoImpl(repoRunner, path, opts);
  }

  /**
   * Clone a repository
   */
  public async clone(
    url: string,
    path: string,
    opts?: CloneOpts & ExecOpts,
  ): Promise<WorktreeRepo | BareRepo> {
    const args = ['clone'];

    // Add progress flag for progress tracking
    if (opts?.onProgress) {
      args.push('--progress');
    }

    if (opts?.bare) {
      args.push('--bare');
    }

    if (opts?.depth !== undefined) {
      args.push('--depth', String(opts.depth));
    }

    if (opts?.branch) {
      args.push('--branch', opts.branch);
    }

    if (opts?.singleBranch) {
      args.push('--single-branch');
    }

    if (opts?.mirror) {
      args.push('--mirror');
    }

    if (opts?.noCheckout) {
      args.push('--no-checkout');
    }

    if (opts?.recurseSubmodules) {
      args.push('--recurse-submodules');
    }

    if (opts?.separateGitDir) {
      args.push('--separate-git-dir', opts.separateGitDir);
    }

    args.push(url, path);

    await this.runner.runOrThrow({ type: 'global' }, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });

    // Return the appropriate repo type
    if (opts?.bare || opts?.mirror) {
      return new BareRepoImpl(this.runner, path);
    }

    return new WorktreeRepoImpl(this.runner, path);
  }

  /**
   * Initialize a new repository
   */
  public async init(path: string, opts?: InitOpts & ExecOpts): Promise<WorktreeRepo | BareRepo> {
    const args = ['init'];

    if (opts?.bare) {
      args.push('--bare');
    }

    if (opts?.initialBranch) {
      args.push('--initial-branch', opts.initialBranch);
    }

    if (opts?.separateGitDir) {
      args.push('--separate-git-dir', opts.separateGitDir);
    }

    args.push(path);

    await this.runner.runOrThrow({ type: 'global' }, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });

    if (opts?.bare) {
      return new BareRepoImpl(this.runner, path);
    }

    return new WorktreeRepoImpl(this.runner, path);
  }

  /**
   * List references in a remote repository
   */
  public async lsRemote(url: string, opts?: LsRemoteOpts & ExecOpts): Promise<LsRemoteResult> {
    const args = ['ls-remote'];

    if (opts?.heads) {
      args.push('--heads');
    }

    if (opts?.tags) {
      args.push('--tags');
    }

    if (opts?.refs) {
      args.push('--refs');
    }

    args.push(url);

    const result = await this.runner.runOrThrow({ type: 'global' }, args, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });

    const refs = parseLsRemote(result.stdout);

    return { refs };
  }

  /**
   * Get git version
   */
  public async version(opts?: ExecOpts): Promise<string> {
    const result = await this.runner.runOrThrow({ type: 'global' }, ['--version'], {
      signal: opts?.signal,
    });

    // Parse "git version X.Y.Z" format
    const match = result.stdout.match(/git version (\S+)/);
    const version = match?.[1];
    return version ?? result.stdout.trim();
  }

  /**
   * Execute a raw git command (repository-agnostic)
   */
  public async raw(argv: Array<string>, opts?: ExecOpts): Promise<RawResult> {
    return this.runner.run({ type: 'global' }, argv, opts);
  }

  // ==========================================================================
  // Global Config Operations
  // ==========================================================================

  /**
   * Get a typed global config value
   */
  private async configGet<K extends ConfigKey>(
    key: K,
    opts?: ExecOpts,
  ): Promise<ConfigSchema[K] | undefined> {
    const result = await this.runner.run({ type: 'global' }, ['config', '--global', '--get', key], {
      signal: opts?.signal,
    });

    if (result.exitCode !== 0) {
      return undefined;
    }

    return result.stdout.trim() as ConfigSchema[K];
  }

  /**
   * Get all values for a typed multi-valued global config key
   */
  private async configGetAll<K extends ConfigKey>(
    key: K,
    opts?: ExecOpts,
  ): Promise<Array<ConfigSchema[K]>> {
    const result = await this.runner.run(
      { type: 'global' },
      ['config', '--global', '--get-all', key],
      { signal: opts?.signal },
    );

    if (result.exitCode !== 0) {
      return [];
    }

    return parseLines(result.stdout) as Array<ConfigSchema[K]>;
  }

  /**
   * Set a typed global config value
   */
  private async configSet<K extends ConfigKey>(
    key: K,
    value: ConfigSchema[K],
    opts?: ExecOpts,
  ): Promise<void> {
    await this.runner.runOrThrow({ type: 'global' }, ['config', '--global', key, String(value)], {
      signal: opts?.signal,
    });
  }

  /**
   * Add a value to a typed multi-valued global config key
   */
  private async configAdd<K extends ConfigKey>(
    key: K,
    value: ConfigSchema[K],
    opts?: ExecOpts,
  ): Promise<void> {
    await this.runner.runOrThrow(
      { type: 'global' },
      ['config', '--global', '--add', key, String(value)],
      { signal: opts?.signal },
    );
  }

  /**
   * Unset a typed global config value
   */
  private async configUnset<K extends ConfigKey>(key: K, opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow({ type: 'global' }, ['config', '--global', '--unset', key], {
      signal: opts?.signal,
    });
  }

  /**
   * Get a raw global config value (for arbitrary keys)
   */
  private async configGetRaw(
    key: string,
    opts?: ConfigGetOpts & ExecOpts,
  ): Promise<string | Array<string> | undefined> {
    const args = ['config', '--global'];

    if (opts?.all) {
      args.push('--get-all');
    } else {
      args.push('--get');
    }

    args.push(key);

    const result = await this.runner.run({ type: 'global' }, args, {
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
   * Set a raw global config value (for arbitrary keys)
   */
  private async configSetRaw(
    key: string,
    value: string,
    opts?: ConfigSetOpts & ExecOpts,
  ): Promise<void> {
    const args = ['config', '--global'];

    if (opts?.add) {
      args.push('--add');
    }

    args.push(key, value);

    await this.runner.runOrThrow({ type: 'global' }, args, {
      signal: opts?.signal,
    });
  }

  /**
   * Unset a raw global config value (for arbitrary keys)
   */
  private async configUnsetRaw(key: string, opts?: ExecOpts): Promise<void> {
    await this.runner.runOrThrow({ type: 'global' }, ['config', '--global', '--unset', key], {
      signal: opts?.signal,
    });
  }

  /**
   * List all global config values
   */
  private async configList(opts?: GlobalConfigListOpts & ExecOpts): Promise<Array<ConfigEntry>> {
    const args = ['config', '--global', '--list'];

    if (opts?.showOrigin) {
      args.push('--show-origin');
    }

    if (opts?.showScope) {
      args.push('--show-scope');
    }

    const result = await this.runner.runOrThrow({ type: 'global' }, args, {
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

      const eqIndex = keyValue.indexOf('=');
      if (eqIndex !== -1) {
        entries.push({
          key: keyValue.slice(0, eqIndex),
          value: keyValue.slice(eqIndex + 1),
        });
      }
    }

    return entries;
  }
}

/**
 * Create a new Git instance
 *
 * @param options - Creation options including runtime adapters
 * @returns Git instance
 */
export function createGit(options: CreateGitOptions): Git {
  return new GitImpl(options);
}

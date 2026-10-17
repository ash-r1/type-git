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
  Commit,
  CommitOpts,
  CommitResult,
  LogOpts,
  StatusEntry,
  StatusOpts,
  StatusPorcelain,
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

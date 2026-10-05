import { validateOptions } from '../core/option-rules.js';
import type { FetchOpts, PushOpts } from '../core/repo.js';
import type { ExecOpts, ExecutionContext } from '../core/types.js';
import type { CliRunner } from '../runner/cli-runner.js';
export async function fetch(
  runner: CliRunner,
  context: ExecutionContext,
  opts?: FetchOpts & ExecOpts,
): Promise<void> {
  validateOptions('fetch', opts);
  const args = ['fetch'];

  // Progress tracking
  if (opts?.onProgress) {
    args.push('--progress');
  }

  // Verbosity options
  if (opts?.verbose) {
    args.push('--verbose');
  }

  if (opts?.quiet) {
    args.push('--quiet');
  }

  // Fetch from all remotes
  if (opts?.all) {
    args.push('--all');
  }

  // Set upstream tracking
  if (opts?.setUpstream) {
    args.push('--set-upstream');
  }

  // Append to FETCH_HEAD
  if (opts?.append) {
    args.push('--append');
  }

  // Atomic transaction
  if (opts?.atomic) {
    args.push('--atomic');
  }

  // Force update
  if (opts?.force) {
    args.push('--force');
  }

  // Multiple remotes

  // Prune options
  if (opts?.prune) {
    args.push('--prune');
  }

  if (opts?.pruneTags) {
    args.push('--prune-tags');
  }

  // Tag handling
  if (opts?.tags) {
    args.push('--tags');
  }
  if (opts?.noTags) {
    args.push('--no-tags');
  }

  // Parallel jobs for submodules
  if (opts?.jobs !== undefined) {
    args.push(`--jobs=${opts.jobs}`);
  }

  // Prefetch mode
  if (opts?.prefetch) {
    args.push('--prefetch');
  }

  // Submodule recursion
  if (opts?.recurseSubmodules !== undefined) {
    if (opts.recurseSubmodules === true || opts.recurseSubmodules === 'yes') {
      args.push('--recurse-submodules=yes');
    } else if (opts.recurseSubmodules === 'on-demand') {
      args.push('--recurse-submodules=on-demand');
    } else if (opts.recurseSubmodules === 'no' || opts.recurseSubmodules === false) {
      args.push('--recurse-submodules=no');
    }
  }

  // Dry run
  if (opts?.dryRun) {
    args.push('--dry-run');
  }

  // FETCH_HEAD writing
  if (opts?.writeFetchHead === false) {
    args.push('--no-write-fetch-head');
  }

  // Keep downloaded pack
  if (opts?.keep) {
    args.push('--keep');
  }

  // Update head
  if (opts?.updateHeadOk) {
    args.push('--update-head-ok');
  }

  // Shallow clone options
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

  // Refetch all objects
  if (opts?.refetch) {
    args.push('--refetch');
  }

  // Update shallow boundary
  if (opts?.updateShallow) {
    args.push('--update-shallow');
  }

  // Refmap override
  if (opts?.refmap) {
    args.push(`--refmap=${opts.refmap}`);
  }

  // Network options
  if (opts?.ipv4) {
    args.push('--ipv4');
  }

  if (opts?.ipv6) {
    args.push('--ipv6');
  }

  // Partial clone filter
  if (opts?.filter) {
    args.push(`--filter=${opts.filter}`);
  }

  // Show forced updates
  if (opts?.showForcedUpdates === false) {
    args.push('--no-show-forced-updates');
  }

  // Write commit graph
  if (opts?.writeCommitGraph) {
    args.push('--write-commit-graph');
  }

  // Remote and refspec (must be last)
  if (opts?.remote) {
    args.push(opts.remote);
  }

  if (opts?.refspec) {
    const refspecs = Array.isArray(opts.refspec) ? opts.refspec : [opts.refspec];
    args.push(...refspecs);
  }

  await runner.runOrThrow(context, args, {
    signal: opts?.signal,
    onProgress: opts?.onProgress,
  });
}

export async function push(
  runner: CliRunner,
  context: ExecutionContext,
  opts?: PushOpts & ExecOpts,
): Promise<void> {
  validateOptions('push', opts);
  const args = ['push'];

  // Progress tracking (git and/or LFS progress are streamed over stderr)
  if (opts?.onProgress || opts?.onLfsProgress) {
    args.push('--progress');
  }

  // Verbosity options
  if (opts?.verbose) {
    args.push('--verbose');
  }

  if (opts?.quiet) {
    args.push('--quiet');
  }

  // Repository override
  if (opts?.repo) {
    args.push(`--repo=${opts.repo}`);
  }

  // Push all branches
  if (opts?.all) {
    args.push('--all');
  } else if (opts?.branches) {
    args.push('--branches');
  }

  // Mirror mode
  if (opts?.mirror) {
    args.push('--mirror');
  }

  // Delete refs
  if (opts?.deleteRefs) {
    args.push('--delete');
  }

  // Force options
  if (opts?.force) {
    args.push('--force');
  }
  if (opts?.forceWithLease !== undefined && opts.forceWithLease !== false) {
    if (opts.forceWithLease === true) {
      args.push('--force-with-lease');
    } else {
      // ForceWithLeaseOpts: { refname: string; expect?: string }
      const leaseOpts = opts.forceWithLease;
      if (leaseOpts.expect !== undefined) {
        args.push(`--force-with-lease=${leaseOpts.refname}:${leaseOpts.expect}`);
      } else {
        args.push(`--force-with-lease=${leaseOpts.refname}`);
      }
    }
  }

  if (opts?.forceIfIncludes) {
    args.push('--force-if-includes');
  }

  // Dry run
  if (opts?.dryRun) {
    args.push('--dry-run');
  }

  // Submodule recursion
  if (opts?.recurseSubmodules) {
    args.push(`--recurse-submodules=${opts.recurseSubmodules}`);
  }

  // Thin pack
  if (opts?.thin === false) {
    args.push('--no-thin');
  }

  // Prune remote-tracking branches
  if (opts?.prune) {
    args.push('--prune');
  }

  // Tag handling
  if (opts?.tags) {
    args.push('--tags');
  }

  if (opts?.followTags) {
    args.push('--follow-tags');
  }

  // Atomic transaction
  if (opts?.atomic) {
    args.push('--atomic');
  }

  // Push options
  if (opts?.pushOption) {
    const pushOptions = Array.isArray(opts.pushOption) ? opts.pushOption : [opts.pushOption];
    for (const opt of pushOptions) {
      args.push('--push-option', opt);
    }
  }

  // Set upstream tracking
  if (opts?.setUpstream) {
    args.push('--set-upstream');
  }

  // Bypass pre-push hook
  if (opts?.noVerify) {
    args.push('--no-verify');
  }

  // GPG signing
  if (opts?.signed !== undefined) {
    if (opts.signed === true) {
      args.push('--signed');
    } else if (opts.signed === 'if-asked') {
      args.push('--signed=if-asked');
    }
  }

  // Network options
  if (opts?.ipv4) {
    args.push('--ipv4');
  }

  if (opts?.ipv6) {
    args.push('--ipv6');
  }

  // Remote and refspec (must be last)
  if (opts?.remote) {
    args.push(opts.remote);
  }

  if (opts?.refspec) {
    const refspecs = Array.isArray(opts.refspec) ? opts.refspec : [opts.refspec];
    args.push(...refspecs);
  }

  await runner.runOrThrow(context, args, {
    signal: opts?.signal,
    onProgress: opts?.onProgress,
    onLfsProgress: opts?.onLfsProgress,
  });
}

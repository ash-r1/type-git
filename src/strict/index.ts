/**
 * type-git/strict - grammar-checked `command()` for type-git clients and repositories.
 *
 * The main `type-git` entry point ships `raw()`, the high-level API, parsers, and the runtime
 * checks against argument injection. This entry point adds `command()`, which checks typed
 * argv against Git's option grammar both at compile time and at run time (including native
 * parser probes) before executing it. Its catalogue and types are loaded only when imported.
 *
 * @example
 * ```typescript
 * import { TypeGit } from 'type-git/node';
 * import { strict } from 'type-git/strict';
 *
 * const repo = strict(await (await TypeGit.create()).open('/path/to/repo'));
 * await repo.command('log', [['--oneline'], ['-n', '5']]);
 * await repo.status(); // every other method is still available
 * ```
 */

import type { GitCommandClient, GitCommandName } from '../commands/types.js';
import type { Git } from '../core/git.js';
import type { BareRepo, WorktreeRepo } from '../core/repo.js';
import { GitArgumentError, type GitOutputMode, type RawResult } from '../core/types.js';
import { type CommandHost, commandHostOf } from '../internal/command-host.js';
import type { CommandRunOptions } from '../runner/cli-runner.js';
import { StrictCommandRunner } from './command-runner.js';

export type {
  CheckedCommandArguments,
  GitCommandArgument,
  GitCommandClient,
  GitCommandExecOpts,
  GitCommandName,
} from '../commands/types.js';

/** A Git client, worktree repository, or bare repository extended with `command()`. */
export type Strict<T extends Git | WorktreeRepo | BareRepo> = T & GitCommandClient;
/** Repository-agnostic client with grammar-checked `command()`. */
export type StrictGit = Strict<Git>;
/** Worktree repository with grammar-checked `command()`. */
export type StrictWorktreeRepo = Strict<WorktreeRepo>;
/** Bare repository with grammar-checked `command()`. */
export type StrictBareRepo = Strict<BareRepo>;

const runners: WeakMap<CommandHost['runner'], StrictCommandRunner> = new WeakMap<
  CommandHost['runner'],
  StrictCommandRunner
>();

function strictRunner(host: CommandHost): StrictCommandRunner {
  let runner = runners.get(host.runner);
  if (runner === undefined) {
    runner = new StrictCommandRunner(host.runner);
    runners.set(host.runner, runner);
  }
  return runner;
}

/**
 * Add grammar-checked `command()` to a Git client or repository.
 *
 * Returns a view of `target` with every original member plus `command()`; state changes made
 * through the view reach `target`. Accepts objects created by type-git (`createGit`,
 * `TypeGit`, `open`, `openBare`, `init`, `clone`, and so on) and throws `GitArgumentError`
 * for anything else.
 */
export function strict<T extends Git | WorktreeRepo | BareRepo>(target: T): Strict<T> {
  const host = commandHostOf(target);
  if (host === undefined) {
    throw new GitArgumentError('strict() expects a Git client or repository created by type-git');
  }
  const command = (
    name: GitCommandName,
    args: readonly unknown[],
    opts?: CommandRunOptions & { stdout?: GitOutputMode },
  ): Promise<RawResult<string | Uint8Array>> => {
    const current = commandHostOf(target) ?? host;
    return strictRunner(current).runCommand(
      current.context,
      name,
      args,
      current.inRepository,
      opts,
    );
  };
  return new Proxy(target, {
    get(object, property, receiver): unknown {
      if (property === 'command') {
        return command;
      }
      return Reflect.get(object, property, receiver);
    },
    has(object, property): boolean {
      return property === 'command' || Reflect.has(object, property);
    },
  }) as Strict<T>;
}

import type { ExecutionContext } from '../core/types.js';
import type { CliRunner } from '../runner/cli-runner.js';

/**
 * Where a client runs grammar-checked commands: its runner, execution context, and whether
 * the command runs inside a repository. `type-git/strict` reads this to add `command()`.
 */
export type CommandHost = {
  runner: CliRunner;
  context: ExecutionContext;
  inRepository: boolean | undefined;
};

// A registry symbol rather than a module-local one, so the ESM and CJS builds (and the
// separate strict entry chunk) agree on the key even when loaded as distinct module copies.
const COMMAND_HOST: unique symbol = Symbol.for('type-git.command-host');

/** Attach a command host to a client without adding it to the client's public type. */
export function registerCommandHost(target: object, host: () => CommandHost | undefined): void {
  Object.defineProperty(target, COMMAND_HOST, { value: host });
}

/** Resolve the command host of a Git client or repository, if it has one. */
export function commandHostOf(target: unknown): CommandHost | undefined {
  if ((typeof target !== 'object' && typeof target !== 'function') || target === null) {
    return undefined;
  }
  const host = (target as { [COMMAND_HOST]?: unknown })[COMMAND_HOST];
  return typeof host === 'function' ? (host as () => CommandHost | undefined)() : undefined;
}

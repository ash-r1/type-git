import type { ExecutionContext, RawResult } from '../core/types.js';
import type { CliRunner } from '../runner/cli-runner.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import type { CommandSpec } from './spec.js';
import type { GitCommandExecOpts, GitCommandName } from './types.js';

export function executeCommand(
  runner: CliRunner,
  context: ExecutionContext,
  command: GitCommandName,
  args: readonly unknown[],
  opts?: GitCommandExecOpts,
): Promise<RawResult> {
  const argv = commandArguments(command, args, context.type === 'global' ? undefined : true);
  const spec: CommandSpec = COMMAND_SPECS[command];
  return spec.executable
    ? runner.runCompanion(context, spec.executable, argv.slice(1), opts)
    : runner.run(context, argv, opts);
}

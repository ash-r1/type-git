import { violations } from '../constraints/model.js';
import { GitArgumentError } from '../core/types.js';
import { COMMAND_SPECS } from './generated.js';
import type { CommandSpec } from './spec.js';
import type { GitCommandName } from './types.js';

/** Build argv without a shell, preserving repeated options and interleaved operands. */
export function commandArguments(
  command: GitCommandName,
  args: readonly unknown[],
  inRepository?: boolean,
): string[] {
  const spec: CommandSpec | undefined = Object.hasOwn(COMMAND_SPECS, command)
    ? COMMAND_SPECS[command]
    : undefined;
  if (!spec) {
    throw new GitArgumentError(`Unknown Git command: ${command}`);
  }
  if (!Array.isArray(args)) {
    throw new GitArgumentError('Command arguments must be an array');
  }
  const argv = [...spec.argv];
  const operands: string[] = [];
  const state: Record<string, unknown> = { operands, inRepository };
  let ended = false;
  const prefixCounts = new Map<number, number>();
  for (const arg of args) {
    if (!Array.isArray(arg)) {
      const operand =
        arg !== null && typeof arg === 'object' && 'operand' in arg ? arg.operand : undefined;
      if (typeof operand !== 'string' || operand.includes('\0')) {
        throw new GitArgumentError('Expected a string operand without NUL');
      }
      if (!ended && operand.startsWith('-') && operand !== '-') {
        throw new GitArgumentError(
          'Use an explicit ["--"] separator before an operand starting with a dash',
        );
      }
      argv.push(operand);
      operands.push(operand);
      continue;
    }
    if (arg[0] === '--' && arg.length === 1) {
      if (!spec.separator || ended) {
        throw new GitArgumentError(`${command}: unexpected end-of-options marker`);
      }
      ended = true;
      argv.push('--');
      continue;
    }
    if (ended) {
      throw new GitArgumentError(`${command}: options cannot follow the end-of-options marker`);
    }
    const flag = arg[0];
    if (typeof flag !== 'string') {
      throw new GitArgumentError(`${command}: option names must be strings`);
    }
    const option = Object.hasOwn(spec.options, flag) ? spec.options[flag] : undefined;
    if (!option) {
      throw new GitArgumentError(`${command}: unknown option ${flag}`);
    }
    if (arg.length > 2) {
      throw new GitArgumentError(`${command}: ${flag} accepts at most one value`);
    }
    const supplied = arg.length === 2 && arg[1] !== undefined;
    const value = option.clear ? undefined : supplied ? arg[1] : (option.set ?? true);
    const start = argv.length;
    if (option.value === 'flag') {
      if (supplied) {
        throw new GitArgumentError(`${flag}: this flag takes no value`);
      }
      argv.push(flag);
    } else if (option.value === 'boolean') {
      if (typeof value !== 'boolean') {
        throw new GitArgumentError(`${flag}: expected a boolean`);
      }
      argv.push(supplied ? `${flag}=${value}` : flag);
    } else {
      const optional = option.value.startsWith('optional-');
      if (!(supplied || optional)) {
        throw new GitArgumentError(`${flag}: missing option value`);
      }
      if (supplied) {
        if (option.value.endsWith('integer') && !Number.isSafeInteger(value)) {
          throw new GitArgumentError(`${flag}: expected a safe integer`);
        }
        if (option.value.endsWith('string') && typeof value !== 'string') {
          throw new GitArgumentError(`${flag}: expected a string`);
        }
        if (String(value).includes('\0')) {
          throw new GitArgumentError(`${flag}: NUL is not a valid CLI argument`);
        }
        // Long equals forms preserve empty values; short values are separate tokens.
        if (flag.startsWith('--')) {
          argv.push(`${flag}=${value}`);
        } else if (optional) {
          argv.push(`${flag}${value}`);
        } else {
          argv.push(flag, String(value));
        }
      } else {
        argv.push(flag);
      }
    }
    if (option.before !== undefined) {
      const emitted = argv.splice(start);
      const position = option.before + (prefixCounts.get(option.before) ?? 0);
      argv.splice(position, 0, ...emitted);
      prefixCounts.set(option.before, (prefixCounts.get(option.before) ?? 0) + emitted.length);
    }
    if (option.repeat) {
      const previous = state[option.key];
      state[option.key] =
        value === false || option.clear
          ? []
          : [
              ...(Array.isArray(previous) ? previous : []),
              ...(option.skipEmpty && value === '' ? [] : [value]),
            ];
    } else {
      state[option.key] = value;
    }
  }
  state.operand0 = operands[0];
  if (state.help !== true) {
    const errors = violations(spec.rules, state);
    if (errors.length > 0) {
      throw new GitArgumentError(
        `${command}: ${errors.map((rule) => `[${rule.id}] ${rule.reason}`).join('; ')}`,
      );
    }
  }
  return argv;
}

import { asciiLower, parseGitScalar } from '../constraints/git-scalars.js';
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
  const operandsBeforeSeparator: string[] = [];
  const pathsAfterSeparator: string[] = [];
  const state: Record<string, unknown> = {
    ...spec.initial,
    argumentTokens: args,
    operands,
    inRepository,
    operandsBeforeSeparator,
    pathsAfterSeparator,
  };
  let ended = false;
  const prefixCounts = new Map<number, number>();
  const modes = new Map<string, unknown>();
  for (const arg of args) {
    if (!Array.isArray(arg)) {
      const operand =
        arg !== null && typeof arg === 'object' && 'operand' in arg ? arg.operand : undefined;
      if (typeof operand !== 'string' || operand.includes('\0')) {
        throw new GitArgumentError('Expected a string operand without NUL');
      }
      if (
        !ended &&
        spec.optionParsing !== 'none' &&
        !(spec.optionParsing === 'stop-at-operand' && operands.length > 0) &&
        operand.startsWith('-') &&
        operand !== '-'
      ) {
        throw new GitArgumentError(
          'Use an explicit ["--"] separator before an operand starting with a dash',
        );
      }
      argv.push(operand);
      operands.push(operand);
      (ended ? pathsAfterSeparator : operandsBeforeSeparator).push(operand);
      continue;
    }
    if (spec.optionParsing === 'stop-at-operand' && operands.length > 0) {
      throw new GitArgumentError(
        `${command}: options must precede the first operand; use an operand object for literal words`,
      );
    }
    if (arg[0] === '--' && arg.length === 1) {
      if (!spec.separator || ended) {
        throw new GitArgumentError(`${command}: unexpected end-of-options marker`);
      }
      ended = true;
      state.hasSeparator = true;
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
    if (!option || arg.length > 2) {
      throw new GitArgumentError(`${command}: unknown option ${flag}`);
    }
    const supplied = arg.length === 2 && arg[1] !== undefined;
    const value = option.clear ? undefined : supplied ? arg[1] : (option.set ?? true);
    if (option.checks) {
      const inputState = { ...state };
      inputState.$value = value;
      const errors = violations(option.checks, inputState);
      if (errors.length > 0) {
        throw new GitArgumentError(
          `${flag}: ${errors.map((rule) => `[${rule.id}] ${rule.reason}`).join('; ')}`,
        );
      }
    }
    if (option.modeGroup) {
      const mode =
        value === false || value === undefined
          ? false
          : option.modeFromValue
            ? value
            : (option.modeValue ?? option.key);
      if (modes.has(option.modeGroup) && modes.get(option.modeGroup) !== mode) {
        throw new GitArgumentError(`${flag}: incompatible command mode`);
      }
      if (mode !== false) {
        modes.set(option.modeGroup, mode);
      }
    }
    if (
      supplied &&
      option.allowed &&
      !option.allowed.includes(
        (option.caseInsensitive && typeof value === 'string' ? asciiLower(value) : value) as
          | string
          | number
          | boolean,
      )
    ) {
      throw new GitArgumentError(`${flag}: unsupported option value ${String(value)}`);
    }
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
        if (option.separateValue) {
          argv.push(flag, String(value));
        } else if (flag.startsWith('--')) {
          argv.push(`${flag}=${value}`);
        } else if (optional || option.attachedValue) {
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
    const parsed = option.parser
      ? parseGitScalar(option.parser, value, state[option.key])
      : { valid: true, value };
    if (!parsed.valid) {
      throw new GitArgumentError(`${flag}: invalid ${option.parser} value ${String(value)}`);
    }
    if (option.ignore) {
      continue;
    }
    if (option.toggle) {
      state[option.key] = state[option.key] !== true;
    } else if (option.repeat) {
      const previous = state[option.key];
      state[option.key] =
        value === false || option.clear
          ? []
          : [
              ...(Array.isArray(previous) ? previous : []),
              ...(option.skipEmpty && value === '' ? [] : [value]),
            ];
    } else {
      state[option.key] =
        option.emptyIsUnset && value === ''
          ? undefined
          : option.caseInsensitive && typeof parsed.value === 'string'
            ? asciiLower(parsed.value)
            : parsed.value;
    }
    for (const effect of option.effects ?? []) {
      const previous = state[effect.key];
      if (
        !effect.when ||
        ('equals' in effect.when
          ? previous === effect.when.equals
          : previous !== effect.when.notEquals)
      ) {
        state[effect.key] = effect.set;
      }
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

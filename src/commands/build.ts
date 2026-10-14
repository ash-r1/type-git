import type { GitDecimalCallback, GitDecimalCallbacks } from '../constraints/git-decimal.js';
import type { GitIntegerProfile } from '../constraints/git-integer.js';
import { asciiLower, parseGitScalar } from '../constraints/git-scalars.js';
import { matches, violations } from '../constraints/model.js';
import {
  objectFilterUsesBinary,
  objectFilterUsesHighBytes,
  objectFilterUsesNegativeMagnitude,
} from '../constraints/object-filter.js';
import { GitArgumentError } from '../core/types.js';
import { COMMAND_SPECS } from './generated.js';
import {
  guiArguments,
  validateGuiArguments,
  type GuiGrammar,
  type GuiLaunch,
} from './gui-syntax.js';
import type { CommandSpec, OptionSpec } from './spec.js';
import type { GitCommandName } from './types.js';

/** Select a registered child grammar after the dispatcher's permitted global options. */
function dispatchArguments(
  spec: CommandSpec,
  args: readonly unknown[],
): { command: GitCommandName; args: readonly unknown[] } | undefined {
  if (!spec.dispatch) {
    return undefined;
  }
  let index = 0;
  while (index < args.length) {
    const token = args[index];
    if (!Array.isArray(token) || !spec.dispatchOptions?.includes(token[0])) {
      break;
    }
    index++;
  }
  const word = args[index];
  if (
    word !== null &&
    typeof word === 'object' &&
    !Array.isArray(word) &&
    'operand' in word &&
    typeof word.operand === 'string' &&
    Object.hasOwn(spec.dispatch, word.operand)
  ) {
    return {
      command: spec.dispatch[word.operand] as GitCommandName,
      args: [...args.slice(0, index), ...args.slice(index + 1)],
    };
  }
  return undefined;
}

/** Build argv without a shell, preserving repeated options and interleaved operands. */
export function commandArguments(
  command: GitCommandName,
  args: readonly unknown[],
  inRepository?: boolean,
  abi?: {
    longBits: 32 | 64;
    sizeTBits: 32 | 64;
    binaryIntegers?: boolean;
    integerProfile?: GitIntegerProfile;
    negativeMagnitudes?: boolean;
    decimalCallbacks?: GitDecimalCallbacks;
    unsignedChar?: boolean;
  },
  guiGrammar?: GuiGrammar,
  guiLaunch?: GuiLaunch,
): string[] {
  const spec: CommandSpec | undefined = Object.hasOwn(COMMAND_SPECS, command)
    ? COMMAND_SPECS[command]
    : undefined;
  if (!spec) {
    throw new GitArgumentError(`Unknown Git command: ${command}`);
  }
  if (spec.guiScript) {
    const rootOptions = Object.assign(
      {},
      ...Object.values(COMMAND_SPECS)
        .filter((s) => 'guiScript' in s)
        .map((s) => s.options),
    );
    const argv = guiArguments(spec, args, rootOptions);
    validateGuiArguments(argv, guiGrammar, guiLaunch);
    return argv;
  }
  if (!Array.isArray(args)) {
    throw new GitArgumentError('Command arguments must be an array');
  }
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandArguments(dispatched.command, dispatched.args, inRepository, abi);
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
  let literalOperands = false;
  const prefixCounts = new Map<number, number>();
  const modes = new Map<string, unknown>();
  for (const [index, arg] of args.entries()) {
    if (!Array.isArray(arg)) {
      const operand =
        arg !== null && typeof arg === 'object' && 'operand' in arg ? arg.operand : undefined;
      if (typeof operand !== 'string' || operand.includes('\0')) {
        throw new GitArgumentError('Expected a string operand without NUL');
      }
      if (
        !(ended || literalOperands) &&
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
    if (literalOperands || (spec.optionParsing === 'stop-at-operand' && operands.length > 0)) {
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
    const numeric =
      !Object.hasOwn(spec.options, flag) && spec.numericOption && /^-\d+$/.exec(flag)?.[0] === flag;
    const option: OptionSpec | undefined = Object.hasOwn(spec.options, flag)
      ? spec.options[flag]
      : numeric
        ? {
            ...spec.numericOption!,
            value: 'flag',
            set:
              typeof spec.numericOption!.parser === 'object'
                ? flag.slice(1)
                : Number(flag.slice(1)),
          }
        : undefined;
    if (!option) {
      throw new GitArgumentError(`${command}: unknown option ${flag}`);
    }
    if (option.firstOnly && index !== 0) {
      throw new GitArgumentError(`${command}: ${flag} must be the first argument`);
    }
    if (arg.length > 2) {
      throw new GitArgumentError(`${command}: ${flag} accepts at most one value`);
    }
    const supplied = arg.length === 2 && arg[1] !== undefined;
    const rawValue = option.clear ? undefined : supplied ? arg[1] : (option.set ?? true);
    if (typeof rawValue === 'string' && rawValue.includes('\0')) {
      throw new GitArgumentError(`${flag}: NUL is not a valid CLI argument`);
    }
    const integerParser = typeof option.parser === 'object';
    if (integerParser && supplied && !['string', 'number', 'bigint'].includes(typeof rawValue)) {
      throw new GitArgumentError(`${flag}: expected a number, bigint or numeric string`);
    }
    const integer = integerParser
      ? parseGitScalar(
          option.parser!,
          rawValue,
          state[option.key],
          abi?.longBits,
          abi?.sizeTBits,
          abi?.binaryIntegers,
          abi?.integerProfile,
          abi?.negativeMagnitudes,
          abi?.decimalCallbacks,
          abi?.unsignedChar,
        )
      : undefined;
    if (integer && !integer.valid) {
      throw new GitArgumentError(`${flag}: invalid integer value ${String(rawValue)}`);
    }
    const value = integer ? integer.value : rawValue;
    if (option.checks) {
      const inputState = { ...state };
      inputState.$value = value;
      inputState.$remaining = args.slice(index + 1);
      const errors = violations(option.checks, inputState, abi);
      if (errors.length > 0) {
        throw new GitArgumentError(
          `${flag}: ${errors.map((rule) => `[${rule.id}] ${rule.reason}`).join('; ')}`,
        );
      }
    }
    if (
      (supplied || numeric) &&
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
        const interpretedInteger = ['python-int', 'perl-int', 'perl-int-gnu'].includes(
          typeof option.parser === 'string' ? option.parser : '',
        );
        if (
          option.value.endsWith('integer') &&
          !integerParser &&
          (interpretedInteger
            ? !['number', 'string', 'bigint'].includes(typeof value)
            : !Number.isSafeInteger(value))
        ) {
          throw new GitArgumentError(
            `${flag}: expected ${interpretedInteger ? 'integer text, number or bigint' : 'a safe integer'}`,
          );
        }
        if (option.value.endsWith('string') && typeof value !== 'string') {
          throw new GitArgumentError(`${flag}: expected a string`);
        }
        if (String(value).includes('\0')) {
          throw new GitArgumentError(`${flag}: NUL is not a valid CLI argument`);
        }
        // Long equals forms preserve empty values; short values are separate tokens.
        if (optional && !flag.startsWith('--') && rawValue === '' && option.emptyValueFlag) {
          argv.push(`${option.emptyValueFlag}=`);
        } else if (option.separateValue) {
          argv.push(flag, String(rawValue));
        } else if (flag.startsWith('--')) {
          argv.push(`${flag}=${rawValue}`);
        } else if (option.attachedValue && !optional && value === '') {
          argv.push(flag, '');
        } else if (optional || option.attachedValue) {
          argv.push(`${flag}${rawValue}`);
        } else {
          argv.push(flag, String(rawValue));
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
    const parsed =
      integer ??
      (option.parser
        ? parseGitScalar(
            option.parser,
            value,
            state[option.key],
            abi?.longBits,
            abi?.sizeTBits,
            abi?.binaryIntegers,
            abi?.integerProfile,
            abi?.negativeMagnitudes,
            abi?.decimalCallbacks,
            abi?.unsignedChar,
          )
        : { valid: true, value });
    if (!parsed.valid) {
      throw new GitArgumentError(`${flag}: invalid ${option.parser} value ${String(value)}`);
    }
    if (option.consumesRest) {
      literalOperands = true;
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
              ...(option.skipEmpty && value === ''
                ? []
                : [option.parser === 'python-int' ? parsed.value : value]),
            ];
    } else {
      state[option.key] =
        option.emptyIsUnset && value === ''
          ? undefined
          : option.caseInsensitive && !option.preserveCase && typeof parsed.value === 'string'
            ? asciiLower(parsed.value)
            : parsed.value;
    }
    for (const effect of option.effects ?? []) {
      const previous = state[effect.key];
      if (
        !effect.when ||
        ('all' in effect.when
          ? effect.when.all.every((predicate) => matches(predicate, state))
          : 'equals' in effect.when
            ? previous === effect.when.equals
            : previous !== effect.when.notEquals)
      ) {
        state[effect.key] = effect.set;
      }
    }
  }
  state.operand0 = operands[0];
  state.operand1 = operands[1];
  if (state.help !== true) {
    const errors = violations(spec.rules, state, abi);
    if (errors.length > 0) {
      throw new GitArgumentError(
        `${command}: ${errors.map((rule) => `[${rule.id}] ${rule.reason}`).join('; ')}`,
      );
    }
  }
  return argv;
}

/** Whether emitted options need the selected executable's native integer widths. */
export function commandUsesNativeABI(command: GitCommandName, args: readonly unknown[]): boolean {
  if (!Array.isArray(args) || !Object.hasOwn(COMMAND_SPECS, command)) {
    return false;
  }
  const spec: CommandSpec = COMMAND_SPECS[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesNativeABI(dispatched.command, dispatched.args);
  }
  return args.some((arg) => {
    if (!Array.isArray(arg) || typeof arg[0] !== 'string') {
      return false;
    }
    const option = Object.hasOwn(spec.options, arg[0])
      ? spec.options[arg[0]]
      : spec.numericOption && /^-\d+$/.exec(arg[0])?.[0] === arg[0]
        ? spec.numericOption
        : undefined;
    return (
      typeof option?.parser === 'object' ||
      option?.parser === 'abbrev' ||
      option?.parser === 'mainline' ||
      option?.parser === 'object-filter' ||
      option?.parser === 'object-filter-auto' ||
      option?.parser === 'unsigned-size' ||
      option?.parser === 'shortlog-wrap'
    );
  });
}

/** Whether a filter uses a binary integer whose libc support must be observed. */
export function commandUsesObjectFilterBinary(
  command: GitCommandName,
  args: readonly unknown[],
): boolean {
  const spec: CommandSpec | undefined = Object.hasOwn(COMMAND_SPECS, command)
    ? COMMAND_SPECS[command]
    : undefined;
  if (!spec || !Array.isArray(args)) {
    return false;
  }
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesObjectFilterBinary(dispatched.command, dispatched.args);
  }
  return args.some((arg) => {
    if (!Array.isArray(arg) || typeof arg[0] !== 'string' || typeof arg[1] !== 'string') {
      return false;
    }
    const option = Object.hasOwn(spec.options, arg[0])
      ? spec.options[arg[0]]
      : spec.numericOption && /^-\d+$/.exec(arg[0])?.[0] === arg[0]
        ? spec.numericOption
        : undefined;
    return (
      (typeof option?.parser === 'object' &&
        option.parser.kind === 'integer' &&
        /^[ \t\r\n\v\f]*[+-]?0[bB]/.test(arg[1])) ||
      ((option?.parser === 'object-filter' || option?.parser === 'object-filter-auto') &&
        objectFilterUsesBinary(arg[1]))
    );
  });
}

/** Whether a schema integer used decimal int assignment in the older parser family. */
export function commandUsesIntegerProfile(
  command: GitCommandName,
  args: readonly unknown[],
): boolean {
  if (!Array.isArray(args) || !Object.hasOwn(COMMAND_SPECS, command)) {
    return false;
  }
  const spec: CommandSpec = COMMAND_SPECS[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesIntegerProfile(dispatched.command, dispatched.args);
  }
  return args.some((arg) => {
    if (!Array.isArray(arg) || typeof arg[0] !== 'string') {
      return false;
    }
    const parser = Object.hasOwn(spec.options, arg[0])
      ? spec.options[arg[0]]?.parser
      : spec.numericOption && /^-\d+$/.exec(arg[0])?.[0] === arg[0]
        ? spec.numericOption.parser
        : undefined;
    return (
      typeof parser === 'object' &&
      parser.kind === 'integer' &&
      parser.bits === 32 &&
      !parser.nativeWidth
    );
  });
}

/** Whether unsigned numeric input can depend on the selected strtoumax sign policy. */
export function commandUsesNegativeMagnitude(
  command: GitCommandName,
  args: readonly unknown[],
): boolean {
  if (!Array.isArray(args) || !Object.hasOwn(COMMAND_SPECS, command)) {
    return false;
  }
  const spec: CommandSpec = COMMAND_SPECS[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesNegativeMagnitude(dispatched.command, dispatched.args);
  }
  return args.some((arg) => {
    if (!Array.isArray(arg) || typeof arg[0] !== 'string') {
      return false;
    }
    const parser = Object.hasOwn(spec.options, arg[0])
      ? spec.options[arg[0]]?.parser
      : spec.numericOption && /^-\d+$/.exec(arg[0])?.[0] === arg[0]
        ? spec.numericOption.parser
        : undefined;
    return (
      (typeof parser === 'object' &&
        parser.kind === 'integer' &&
        !parser.signed &&
        /^[ \t\r\n\v\f]*-/.test(String(arg[1]))) ||
      ((parser === 'object-filter' || parser === 'object-filter-auto') &&
        typeof arg[1] === 'string' &&
        objectFilterUsesNegativeMagnitude(arg[1]))
    );
  });
}

/** Numeric callback traits used by this emitted tuple, following child dispatch. */
export function commandDecimalCallbacks(
  command: GitCommandName,
  args: readonly unknown[],
): GitDecimalCallback[] {
  const spec: CommandSpec = COMMAND_SPECS[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandDecimalCallbacks(dispatched.command, dispatched.args);
  }
  const callbacks = new Set<GitDecimalCallback>();
  for (const arg of args) {
    if (!Array.isArray(arg) || typeof arg[0] !== 'string') {
      continue;
    }
    const option = Object.hasOwn(spec.options, arg[0])
      ? spec.options[arg[0]]
      : spec.numericOption && /^-\d+$/.exec(arg[0])?.[0] === arg[0]
        ? spec.numericOption
        : undefined;
    if (
      typeof option?.parser === 'object' &&
      option.parser.kind === 'decimal' &&
      option.parser.nativeCallback
    ) {
      callbacks.add(option.parser.nativeCallback);
    }
  }
  return [...callbacks];
}

/** Decimal callback width can be delegated to native validation if build metadata is unavailable. */
export function commandUsesDecimalCallback(
  command: GitCommandName,
  args: readonly unknown[],
): boolean {
  const spec: CommandSpec = COMMAND_SPECS[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesDecimalCallback(dispatched.command, dispatched.args);
  }
  return args.some((arg) => {
    if (!Array.isArray(arg) || typeof arg[0] !== 'string') {
      return false;
    }
    const option = Object.hasOwn(spec.options, arg[0]) ? spec.options[arg[0]] : spec.numericOption;
    return typeof option?.parser === 'object' && option.parser.kind === 'decimal';
  });
}

/** Detect C char dependent combined-filter words after dispatcher selection. */
export function commandUsesObjectFilterCharProfile(
  command: GitCommandName,
  args: readonly unknown[],
): boolean {
  const spec: CommandSpec = COMMAND_SPECS[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesObjectFilterCharProfile(dispatched.command, dispatched.args);
  }
  return args.some((arg) => {
    if (!Array.isArray(arg) || typeof arg[0] !== 'string' || typeof arg[1] !== 'string') {
      return false;
    }
    const option = Object.hasOwn(spec.options, arg[0]) ? spec.options[arg[0]] : undefined;
    return (
      (option?.parser === 'object-filter' || option?.parser === 'object-filter-auto') &&
      objectFilterUsesHighBytes(arg[1])
    );
  });
}

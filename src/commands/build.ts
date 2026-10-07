import { asciiLower, parseGitScalar } from '../constraints/git-scalars.js';
import { matches, violations } from '../constraints/model.js';
import { GitArgumentError } from '../core/types.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import { partitionRemainingArguments, revisionParserPass } from './revision-parser-pass.js';
import { ARGV_STRING_CONSTRAINT, type CommandSpec, type OptionSpec } from './spec.js';
import type { GitCommandName } from './types.js';

/** Build argv without a shell, preserving repeated options and interleaved operands. */
export function commandArguments(
  command: GitCommandName,
  args: readonly unknown[],
  inRepository?: boolean,
): string[] {
  return buildArguments(command, args, inRepository);
}

function buildArguments(
  command: GitCommandName,
  args: readonly unknown[],
  inRepository?: boolean,
  evaluationMode: 'full' | 'shape' | 'first-pass' | 'pipeline' = 'full',
  replay?: {
    firstCount: number;
    options: Readonly<Record<string, OptionSpec>>;
    original: readonly unknown[];
    operandsOnly?: boolean;
    operandBoundary?: boolean;
    partitionState?: Readonly<Record<string, readonly string[]>>;
  },
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
  const first = args[0];
  if (
    spec.dispatch &&
    !spec.parserExit?.mandatorySubcommand &&
    first !== null &&
    typeof first === 'object' &&
    !Array.isArray(first) &&
    'operand' in first &&
    typeof first.operand === 'string' &&
    Object.hasOwn(spec.dispatch, first.operand)
  ) {
    return buildArguments(
      spec.dispatch[first.operand] as GitCommandName,
      args.slice(1),
      inRepository,
      evaluationMode,
      replay,
    );
  }
  if (evaluationMode === 'full' && spec.parserExit?.firstPassOptions) {
    const serialized = buildArguments(command, args, inRepository, 'shape');
    const pass = initialParserPass(spec, serialized.slice(spec.argv.length));
    if (pass.exited) {
      buildArguments(command, pass.tokens, inRepository, 'first-pass');
      return serialized;
    }
    if (pass.subcommand !== undefined) {
      buildArguments(command, pass.tokens, inRepository, 'first-pass');
      buildArguments(
        spec.dispatch![pass.subcommand] as GitCommandName,
        pass.remaining.map((operand) => ({ operand })),
        inRepository,
      );
      return serialized;
    }
    if (pass.delegated && spec.parserExit.mandatorySubcommand) {
      return serialized;
    }
    if (!pass.delegated) {
      if (spec.conditionalCommand) {
        // A missing ref returns success before the child parses any values.
        // Ref existence is unknown here; native Git evaluates its own gate
        // without an additional, potentially stale preflight in this builder.
        return serialized;
      }
      const partition = partitionRemainingArguments(spec, pass.remaining);
      const operandsOnly = spec.parserExit.remainingOperands !== undefined;
      const operandBoundary =
        spec.parserExit.remainingOperands === 'drop-leading-dashdash' &&
        partition.words[0] === '--';
      const words = operandBoundary ? partition.words.slice(1) : partition.words;
      const separatorIndex = spec.parserExit.remainingSeparator ? words.indexOf('--') : -1;
      const recognizedSeparator =
        separatorIndex >= 0 &&
        (spec.parserExit.remainingSeparator?.maxIndex === undefined ||
          separatorIndex <= spec.parserExit.remainingSeparator.maxIndex);
      const remaining = operandsOnly
        ? words.map((operand, index) =>
            recognizedSeparator && index === separatorIndex ? ['--'] : { operand },
          )
        : revisionParserPass(spec, words);
      buildArguments(command, [...pass.tokens, ...remaining], inRepository, 'pipeline', {
        firstCount: pass.tokens.length,
        options: spec.parserExit.remainingOptions!,
        original: args,
        operandsOnly,
        operandBoundary,
        partitionState: partition.state,
      });
      return serialized;
    }
  }
  const argv = [...spec.argv];
  const operands: string[] = [];
  const operandsBeforeSeparator: string[] = [];
  const pathsAfterSeparator: string[] = [];
  const state: Record<string, unknown> = {
    ...spec.initial,
    ...replay?.partitionState,
    argumentTokens: replay?.original ?? args,
    operands,
    inRepository,
    operandsBeforeSeparator,
    pathsAfterSeparator,
  };
  let ended = false;
  let literalOperands = false;
  let parserExited = evaluationMode === 'shape';
  const prefixCounts = new Map<number, number>();
  const modes = new Map<string, unknown>();
  for (const [index, arg] of args.entries()) {
    if (replay?.operandsOnly && index >= replay.firstCount) {
      literalOperands = true;
      if (replay.operandBoundary) {
        ended = true;
        state.hasSeparator = true;
      }
    }
    if (!Array.isArray(arg)) {
      const operand =
        arg !== null && typeof arg === 'object' && 'operand' in arg ? arg.operand : undefined;
      if (
        typeof operand !== 'string' ||
        operand.includes(ARGV_STRING_CONSTRAINT.forbiddenCharacter)
      ) {
        throw new GitArgumentError('Expected a string operand without NUL');
      }
      if (
        !(parserExited || ended || literalOperands) &&
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
    if (
      !(
        parserExited ||
        (replay && index >= replay.firstCount && arg[0] === '--' && arg.length === 1)
      ) &&
      (literalOperands || (spec.optionParsing === 'stop-at-operand' && operands.length > 0))
    ) {
      throw new GitArgumentError(
        `${command}: options must precede the first operand; use an operand object for literal words`,
      );
    }
    if (arg[0] === '--' && arg.length === 1) {
      if (!parserExited && (!spec.separator || ended)) {
        throw new GitArgumentError(`${command}: unexpected end-of-options marker`);
      }
      ended = true;
      state.hasSeparator = true;
      argv.push('--');
      continue;
    }
    if (!parserExited && ended) {
      throw new GitArgumentError(`${command}: options cannot follow the end-of-options marker`);
    }
    const flag = arg[0];
    if (typeof flag !== 'string') {
      throw new GitArgumentError(`${command}: option names must be strings`);
    }
    const activeOptions =
      evaluationMode === 'shape' && spec.parserExit?.argumentOptions
        ? spec.parserExit.argumentOptions
        : replay && index >= replay.firstCount
          ? replay.options
          : spec.options;
    const numeric =
      !Object.hasOwn(activeOptions, flag) &&
      spec.numericOption &&
      /^-\d+$/.exec(flag)?.[0] === flag;
    const option: OptionSpec | undefined = Object.hasOwn(activeOptions, flag)
      ? activeOptions[flag]
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
    if (!option || arg.length > 2) {
      throw new GitArgumentError(`${command}: unknown option ${flag}`);
    }
    const supplied = arg.length === 2 && arg[1] !== undefined;
    const rawValue = option.clear ? undefined : supplied ? arg[1] : (option.set ?? true);
    const integerParser = typeof option.parser === 'object';
    if (
      integerParser &&
      supplied &&
      typeof rawValue !== 'string' &&
      typeof rawValue !== 'number' &&
      typeof rawValue !== 'bigint'
    ) {
      throw new GitArgumentError(`${flag}: expected a number, bigint or numeric string`);
    }
    const integer =
      integerParser && !parserExited
        ? parseGitScalar(option.parser!, rawValue, state[option.key])
        : undefined;
    if (integer && !integer.valid) {
      throw new GitArgumentError(`${flag}: invalid integer value ${String(rawValue)}`);
    }
    const value = integer ? integer.value : rawValue;
    if (!parserExited && option.checks) {
      const inputState = { ...state };
      inputState.$value = value;
      inputState.$remaining = args.slice(index + 1);
      const errors = violations(option.checks, inputState);
      if (errors.length > 0) {
        throw new GitArgumentError(
          `${flag}: ${errors.map((rule) => `[${rule.id}] ${rule.reason}`).join('; ')}`,
        );
      }
    }
    if (!parserExited && option.modeGroup) {
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
      !parserExited &&
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
        if (option.value.endsWith('integer') && !integerParser && !Number.isSafeInteger(value)) {
          throw new GitArgumentError(`${flag}: expected a safe integer`);
        }
        if (option.value.endsWith('string') && typeof value !== 'string') {
          throw new GitArgumentError(`${flag}: expected a string`);
        }
        if (String(value).includes(ARGV_STRING_CONSTRAINT.forbiddenCharacter)) {
          throw new GitArgumentError(`${flag}: NUL is not a valid CLI argument`);
        }
        // Long equals forms preserve empty values; short values are separate tokens.
        if (optional && !flag.startsWith('--') && rawValue === '' && option.emptyValueFlag) {
          argv.push(`${option.emptyValueFlag}=`);
        } else if (option.separateValue) {
          argv.push(flag, String(rawValue));
        } else if (flag.startsWith('--')) {
          argv.push(`${flag}=${rawValue}`);
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
    if (parserExited) {
      continue;
    }
    if (
      evaluationMode !== 'pipeline' &&
      spec.parserExit?.flags.includes(flag) &&
      !(index === 0 && spec.parserExit.exceptFirst?.includes(flag))
    ) {
      parserExited = true;
      continue;
    }
    const parsed =
      integer ??
      (option.parser
        ? parseGitScalar(option.parser, value, state[option.key])
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
              ...(option.skipEmpty && value === '' ? [] : [value]),
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
  if (replay?.operandBoundary) {
    state.hasSeparator = true;
  }
  state.operand0 = operands[0];
  if (!parserExited && state.help !== true) {
    const errors = violations(spec.rules, state);
    if (errors.length > 0) {
      throw new GitArgumentError(
        `${command}: ${errors.map((rule) => `[${rule.id}] ${rule.reason}`).join('; ')}`,
      );
    }
  }
  return argv;
}

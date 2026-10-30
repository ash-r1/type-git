import { isCompoundDecimal } from '../constraints/compound-decimal.js';
import {
  type GitBooleanCapabilities,
  type GitBooleanSource,
  isBooleanCallback,
} from '../constraints/git-boolean.js';
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
import { commandSpecs } from './catalogue.js';
import {
  type GuiGrammar,
  type GuiLaunch,
  guiArguments,
  validateGuiArguments,
} from './gui-syntax.js';
import { initialParserInputs } from './initial-parser-inputs.js';
import { initialParserPass } from './initial-parser-pass.js';
import { partitionRemainingArguments, revisionParserPass } from './revision-parser-pass.js';
import {
  ARGV_STRING_CONSTRAINT,
  type CommandSpec,
  GLOBAL_HELP_DISPATCH_OPTIONS,
  type OptionSpec,
} from './spec.js';
import { svnDispatch, svnParserTokens, svnShapeOption } from './svn-dispatch.js';
import type { GitCommandName } from './types.js';

let documentationOptionTable: Readonly<Record<string, OptionSpec>> | undefined;

// git.c rewrites first-word --help before looking up any builtin or external command.
function documentationOptions(): Readonly<Record<string, OptionSpec>> {
  documentationOptionTable ??= {
    ...commandSpecs().help.options,
    ...GLOBAL_HELP_DISPATCH_OPTIONS,
  };
  return documentationOptionTable;
}

/** Native words a parent parser forwards to a child; they carry no operand-object provenance. */
const retainedWords = new WeakSet<object>();

/** Git dispatches a first --help before any primary command's local parser. */
export function isDocumentationDispatch(spec: CommandSpec, args: readonly unknown[]): boolean {
  return (
    spec.argv.length === 1 &&
    !spec.executable &&
    Array.isArray(args[0]) &&
    args[0].length === 1 &&
    args[0][0] === '--help'
  );
}

/** After documentation exits, retain recognized local shapes without interpreting callbacks. */
function ignoredDocumentationOption(
  specs: readonly CommandSpec[],
  flag: string,
  argument: readonly unknown[],
): OptionSpec | undefined {
  const documentation = documentationOptions();
  const alternatives = [
    Object.hasOwn(documentation, flag) ? documentation[flag] : undefined,
    ...specs.map((spec) => (Object.hasOwn(spec.options, flag) ? spec.options[flag] : undefined)),
  ].filter((option): option is OptionSpec => option !== undefined);
  const selected = svnShapeOption(alternatives, argument) ?? alternatives[0];
  if (selected) {
    // A local parent option must not move an ignored word before the help prefix.
    const { before: _before, ...shape } = selected;
    return shape;
  }
  // Native help ignores these words entirely. Unknown flags have no declared value
  // type, so their optional raw second word must be an explicit string.
  if (flag.startsWith('-') && (argument.length === 1 || argument.length === 2)) {
    return {
      key: 'ignored-documentation-word',
      value: argument.length === 1 ? 'flag' : 'string',
      separateValue: true,
    };
  }
  return undefined;
}

/** Retain local shapes and raw unknown words after a guaranteed native usage exit. */
function ignoredUsageOption(
  spec: CommandSpec,
  flag: string,
  argument: readonly unknown[],
): OptionSpec | undefined {
  if (Object.hasOwn(spec.options, flag)) {
    const { before: _before, ...shape } = spec.options[flag]!;
    return shape;
  }
  if (flag.startsWith('-') && (argument.length === 1 || argument.length === 2)) {
    return {
      key: 'ignored-usage-word',
      value: argument.length === 1 ? 'flag' : 'string',
      separateValue: true,
    };
  }
  return undefined;
}

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
    if (!(Array.isArray(token) && spec.dispatchOptions?.includes(token[0]))) {
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

/** Validate supplied argv words before interpreting commands or selecting native parser traits. */
export function validateArgvStrings(args: readonly unknown[]): void {
  if (!Array.isArray(args)) {
    throw new GitArgumentError('Command arguments must be an array');
  }
  for (const token of args) {
    if (Array.isArray(token)) {
      for (const word of token) {
        if (typeof word === 'string' && word.includes(ARGV_STRING_CONSTRAINT.forbiddenCharacter)) {
          throw new GitArgumentError('NUL is not a valid CLI argument');
        }
      }
    } else if (
      token &&
      typeof token === 'object' &&
      'operand' in token &&
      typeof token.operand === 'string' &&
      token.operand.includes(ARGV_STRING_CONSTRAINT.forbiddenCharacter)
    ) {
      throw new GitArgumentError('Expected a string operand without NUL');
    }
  }
}

/** Observed native OPTION_FILENAME pointer-update families. */
export type FilenameProfile = 'legacy' | 'intermediate' | 'optional';
/** Carry filename observations through every existing parser and ABI pass. */
export type FilenameContext = {
  filenameProfile?: FilenameProfile;
  ignoreOptionalFilename?: (key: string, value: string) => boolean;
  stopBeforeFilename?: number;
  deferFinalRules?: boolean;
};

/**
 * Validate argv representation before parser selection, then emit ordered words without a shell.
 * NUL in a supplied word is rejected before GUI, dispatch or native-profile lookup; stdin is separate.
 * Selected ABI and parser traits affect semantic checks while original numeric spellings are retained.
 */
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
    conflictStyle?: 'immediate' | 'deferred';
    repackMaxPackSize?: 'immediate' | 'deferred';
    readTreeExclude?: 'legacy' | 'modern';
    lsTreeModes?: 'bits' | 'cmdmode';
    booleanSource?: GitBooleanSource;
    booleanBinaryIntegers?: boolean;
    booleanCapabilities?: GitBooleanCapabilities;
    compoundNegatedOverflow?: boolean;
    depthAtoiBits?: 32 | 64;
    submoduleInitAlias?: boolean;
    emptyPickaxeRejected?: boolean;
    whatchangedOptInRequired?: boolean;
    packRedundantOptInRequired?: boolean;
    firstPassEmpty?: boolean;
  } & FilenameContext,
  guiGrammar?: GuiGrammar,
  guiLaunch?: GuiLaunch,
  filenameProfile?: FilenameProfile,
  ignoreOptionalFilename?: (key: string, value: string) => boolean,
  deferFinalRules?: boolean,
): string[] {
  const selected =
    filenameProfile === undefined && !ignoreOptionalFilename && !deferFinalRules
      ? abi
      : {
          longBits: 64 as const,
          sizeTBits: 64 as const,
          ...abi,
          ...(filenameProfile === undefined ? {} : { filenameProfile }),
          ...(ignoreOptionalFilename ? { ignoreOptionalFilename } : {}),
          ...(deferFinalRules ? { deferFinalRules } : {}),
        };
  return buildArguments(command, args, inRepository, selected, guiGrammar, guiLaunch);
}

/** Serialize shape or validate only the callbacks reached by one parser pass. */
function buildArguments(
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
    conflictStyle?: 'immediate' | 'deferred';
    repackMaxPackSize?: 'immediate' | 'deferred';
    readTreeExclude?: 'legacy' | 'modern';
    lsTreeModes?: 'bits' | 'cmdmode';
    booleanSource?: GitBooleanSource;
    booleanBinaryIntegers?: boolean;
    booleanCapabilities?: GitBooleanCapabilities;
    compoundNegatedOverflow?: boolean;
    depthAtoiBits?: 32 | 64;
    submoduleInitAlias?: boolean;
    emptyPickaxeRejected?: boolean;
    whatchangedOptInRequired?: boolean;
    packRedundantOptInRequired?: boolean;
    firstPassEmpty?: boolean;
  } & FilenameContext,
  guiGrammar?: GuiGrammar,
  guiLaunch?: GuiLaunch,
  evaluationMode: 'full' | 'shape' | 'first-pass' | 'pipeline' = 'full',
  replay?: {
    firstCount: number;
    options: Readonly<Record<string, OptionSpec>>;
    original: readonly unknown[];
    operandsOnly?: boolean;
    operandBoundary?: boolean;
    parserExited?: true;
    partitionState?: Readonly<Record<string, readonly string[]>>;
  },
  specOverride?: CommandSpec,
  shapeOptions?: Readonly<Record<string, readonly OptionSpec[]>>,
  operandIndexes?: number[],
  guard = false,
): string[] {
  let spec: CommandSpec | undefined =
    specOverride ?? (Object.hasOwn(commandSpecs(), command) ? commandSpecs()[command] : undefined);
  if (!spec) {
    throw new GitArgumentError(`Unknown Git command: ${command}`);
  }
  validateArgvStrings(args);
  const documentationDispatch = isDocumentationDispatch(spec, args);
  const documentationLocals: readonly CommandSpec[] = documentationDispatch
    ? [
        spec,
        ...Object.values(spec.dispatch ?? {}).map((name) => commandSpecs()[name as GitCommandName]),
      ]
    : [];
  if (documentationDispatch) {
    // Switch grammars before local dispatch, GUI parsing, or callback/profile selection.
    // Native help modes and installation availability stay with the selected Git.
    spec = {
      argv: spec.argv,
      options: documentationOptions(),
      rules: [],
      separator: true,
      source: 'git.c:handle_builtin; builtin/help.c',
      parserExit: {
        flags: ['--help'],
        origin: 'git',
        source: 'git.c:handle_builtin',
        reason: 'First-word --help delegates the full tail to the native documentation parser.',
      },
    };
  }
  if (spec.guiScript) {
    const rootOptions = Object.assign(
      {},
      ...Object.values(commandSpecs())
        .filter((s) => 'guiScript' in s)
        .map((s) => s.options),
    );
    const argv = guiArguments(spec, args, rootOptions);
    validateGuiArguments(argv, guiGrammar, guiLaunch);
    return argv;
  }
  if (
    !(documentationDispatch || specOverride) &&
    (command === 'svn' || command.startsWith('svn '))
  ) {
    const root: CommandSpec = commandSpecs().svn;
    const options: Record<string, OptionSpec> = {};
    const alternatives: Record<string, OptionSpec[]> = {};
    for (const [name, child] of Object.entries(commandSpecs())) {
      if (name === 'svn' || name.startsWith('svn ')) {
        for (const [flag, option] of Object.entries(child.options)) {
          const { before: _before, ...local } = option;
          options[flag] = local;
          alternatives[flag] ??= [];
          alternatives[flag].push(local);
        }
      }
    }
    // The source global declarations override local aliases (notably -i).
    for (const [flag, option] of Object.entries(root.options)) {
      const { before: _before, ...local } = option;
      options[flag] = local;
      alternatives[flag] = [local];
    }
    const original = buildArguments(
      command,
      args,
      inRepository,
      abi,
      guiGrammar,
      guiLaunch,
      'shape',
      undefined,
      {
        ...spec,
        dispatch: undefined,
        options,
      },
      alternatives,
      undefined,
      guard,
    );
    if (evaluationMode === 'shape') {
      return original;
    }
    const selected = svnDispatch(original.slice(1), root.dispatch!);
    if (selected.kind === 'help') {
      return original;
    }
    if (selected.kind === 'command') {
      const child = commandSpecs()[selected.command as GitCommandName];
      const tokens = svnParserTokens(selected.remaining, child.options);
      if (tokens !== undefined) {
        buildArguments(
          selected.command as GitCommandName,
          tokens,
          inRepository,
          abi,
          guiGrammar,
          guiLaunch,
          evaluationMode,
          undefined,
          child,
        );
        return original;
      }
    }
  }
  const dispatched = spec.parserExit?.mandatorySubcommand
    ? undefined
    : dispatchArguments(spec, args);
  if (dispatched) {
    return buildArguments(
      dispatched.command,
      dispatched.args,
      inRepository,
      abi,
      guiGrammar,
      guiLaunch,
      evaluationMode,
      replay,
      undefined,
      undefined,
      undefined,
      guard,
    );
  }
  // A guarded shape serialization repeats only the provenance decisions of a full evaluation.
  if ((evaluationMode === 'full' || guard) && spec.parserExit?.firstPassOptions) {
    const serializedOperands: number[] = [];
    const serialized = buildArguments(
      command,
      args,
      inRepository,
      abi,
      guiGrammar,
      guiLaunch,
      'shape',
      undefined,
      undefined,
      undefined,
      serializedOperands,
    );
    // The native passes below see flattened words; keep each operand object's provenance so
    // an executing command never receives one as an option or boundary marker.
    const literal = serialized.slice(spec.argv.length).map(() => false);
    for (const index of serializedOperands) {
      const word = serialized[index]!;
      if (index >= spec.argv.length && word.startsWith('-') && word !== '-') {
        literal[index - spec.argv.length] = true;
      }
    }
    const rejectLiteralOption = (): never => {
      throw new GitArgumentError(
        'Use an explicit ["--"] separator before an operand starting with a dash',
      );
    };
    const firstPass = () =>
      initialParserPass(
        spec,
        serialized.slice(spec.argv.length),
        abi?.firstPassEmpty ?? true,
        spec.parserExit,
        abi?.stopBeforeFilename === undefined
          ? undefined
          : (() => {
              let reached = 0;
              return (token: readonly string[]) => {
                const option = spec.options[token[0]!];
                return (
                  option?.emptyIsUnset === true &&
                  typeof token[1] === 'string' &&
                  token[1].startsWith(':(optional)') &&
                  reached++ === abi.stopBeforeFilename
                );
              };
            })(),
        literal,
      );
    let pass: ReturnType<typeof initialParserPass>;
    try {
      pass = firstPass();
    } catch (error) {
      // A first-pass usage error is a native exit before any later word is parsed.
      if (guard && error instanceof GitArgumentError) {
        return serialized;
      }
      throw error;
    }
    const initialTokens = initialParserInputs(spec, args, pass.tokens);
    if (pass.exited && guard) {
      return serialized;
    }
    if (pass.exited) {
      buildArguments(
        command,
        initialTokens,
        inRepository,
        abi,
        guiGrammar,
        guiLaunch,
        'first-pass',
      );
      return serialized;
    }
    const remainingLiteral = pass.remainingLiteral ?? [];
    if (pass.subcommand !== undefined) {
      if (pass.literalOption || pass.literalUnknown) {
        rejectLiteralOption();
      }
      if (!guard) {
        buildArguments(
          command,
          initialTokens,
          inRepository,
          abi,
          guiGrammar,
          guiLaunch,
          'first-pass',
        );
      }
      buildArguments(
        spec.dispatch![pass.subcommand] as GitCommandName,
        pass.remaining.map((operand, index) => {
          const word = { operand };
          if (remainingLiteral[index] !== true) {
            retainedWords.add(word);
          }
          return word;
        }),
        inRepository,
        abi,
        guiGrammar,
        guiLaunch,
        guard ? 'shape' : 'full',
        undefined,
        undefined,
        undefined,
        undefined,
        guard,
      );
      return serialized;
    }
    if (pass.delegated && spec.parserExit.mandatorySubcommand) {
      return serialized;
    }
    if (!pass.delegated) {
      if (spec.conditionalCommand) {
        // The child command parses every retained word again, after the dropped marker.
        if (pass.literalOption || remainingLiteral.includes(true)) {
          rejectLiteralOption();
        }
        // A missing ref returns success before the child parses any values.
        // Ref existence is unknown here; native Git evaluates its own gate
        // without an additional, potentially stale preflight in this builder.
        return serialized;
      }
      const partition = partitionRemainingArguments(spec, pass.remaining);
      const prefix = spec.parserExit.remainingPartition?.optionPrefix;
      const partitionLiteral =
        prefix === undefined
          ? remainingLiteral
          : remainingLiteral.filter((_, index) => pass.remaining[index]!.startsWith(prefix));
      const operandsOnly = spec.parserExit.remainingOperands !== undefined;
      const operandBoundary =
        spec.parserExit.remainingOperands === 'drop-leading-dashdash' &&
        partition.words[0] === '--';
      const words = operandBoundary ? partition.words.slice(1) : partition.words;
      const wordsLiteral = operandBoundary ? partitionLiteral.slice(1) : partitionLiteral;
      const separatorIndex = spec.parserExit.remainingSeparator ? words.indexOf('--') : -1;
      const recognizedSeparator =
        separatorIndex >= 0 &&
        (spec.parserExit.remainingSeparator?.maxIndex === undefined ||
          separatorIndex <= spec.parserExit.remainingSeparator.maxIndex);
      if (
        operandsOnly &&
        (pass.literalOption ||
          pass.literalUnknown ||
          (operandBoundary && partitionLiteral[0] === true) ||
          (recognizedSeparator && wordsLiteral[separatorIndex] === true))
      ) {
        rejectLiteralOption();
      }
      const revision = operandsOnly ? undefined : revisionParserPass(spec, words, wordsLiteral);
      // A native exit in the retained stream still happens before execution.
      if (revision && !revision.exited && (pass.literalOption || revision.literalOption)) {
        rejectLiteralOption();
      }
      if (guard) {
        return serialized;
      }
      const remaining = operandsOnly
        ? words.map((operand, index) =>
            recognizedSeparator && index === separatorIndex ? ['--'] : { operand },
          )
        : revision!.tokens;
      buildArguments(
        command,
        [...initialTokens, ...remaining],
        inRepository,
        abi,
        guiGrammar,
        guiLaunch,
        'pipeline',
        {
          firstCount: pass.tokens.length,
          options: spec.parserExit.remainingOptions!,
          original: args,
          operandsOnly,
          operandBoundary,
          parserExited: revision?.exited,
          partitionState: partition.state,
        },
      );
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
  let readTreeExcludeSeen = false;
  let documentationTailExited = false;
  let usageExited = false;
  let ended = false;
  let literalOperands = false;
  const soleFlag =
    args.length === 1 && Array.isArray(args[0]) && args[0].length === 1 ? args[0][0] : undefined;
  const first = args[0];
  const firstWord = Array.isArray(first)
    ? first.length === 1
      ? first[0]
      : undefined
    : first !== null && typeof first === 'object' && 'operand' in first
      ? first.operand
      : undefined;
  const firstWordExited =
    typeof firstWord === 'string' && spec.parserExit?.firstWordExits?.includes(firstWord) === true;
  let parserExited =
    evaluationMode === 'shape' ||
    firstWordExited ||
    (evaluationMode === 'full' &&
      !spec.parserExit?.firstPassOptions &&
      typeof soleFlag === 'string' &&
      spec.parserExit?.singleWordExits?.includes(soleFlag) === true);
  // A guarded shape pass tracks the exits, boundaries and literal tails of a full evaluation
  // while still serializing without semantic checks.
  let guardExited =
    firstWordExited ||
    (!spec.parserExit?.firstPassOptions &&
      typeof soleFlag === 'string' &&
      spec.parserExit?.singleWordExits?.includes(soleFlag) === true);
  let guardEnded = false;
  let guardLiteral = false;
  const prefixCounts = new Map<number, number>();
  const modes = new Map<string, unknown>();
  for (const [index, arg] of args.entries()) {
    if (documentationDispatch && index > 0) {
      const word =
        Array.isArray(arg) && arg.length === 1
          ? arg[0]
          : arg !== null && typeof arg === 'object' && 'operand' in arg
            ? arg.operand
            : undefined;
      if (word === '-h' || word === '--help' || word === '--help-all' || word === '--') {
        documentationTailExited = true;
      }
    }
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
        (guard
          ? !(guardExited || guardEnded || guardLiteral)
          : !(parserExited || ended || literalOperands)) &&
        spec.optionParsing !== 'none' &&
        !(spec.optionParsing === 'stop-at-operand' && operands.length > 0) &&
        operand.startsWith('-') &&
        operand !== '-'
      ) {
        throw new GitArgumentError(
          'Use an explicit ["--"] separator before an operand starting with a dash',
        );
      }
      if (!retainedWords.has(arg as object)) {
        operandIndexes?.push(argv.length);
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
      if (spec.separator) {
        guardEnded = true;
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
    let option: OptionSpec | undefined = usageExited
      ? ignoredUsageOption(spec, flag, arg)
      : documentationDispatch && documentationTailExited
        ? ignoredDocumentationOption(documentationLocals, flag, arg)
        : Object.hasOwn(activeOptions, flag)
          ? ((evaluationMode === 'shape' && shapeOptions && Object.hasOwn(shapeOptions, flag)
              ? svnShapeOption(shapeOptions[flag]!, arg)
              : undefined) ?? activeOptions[flag])
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
    if (
      evaluationMode !== 'shape' &&
      !parserExited &&
      option.nativeCapability === 'submodule-init-alias' &&
      abi?.submoduleInitAlias !== true
    ) {
      throw new GitArgumentError(`${command}: ${flag} is unavailable in the selected helper`);
    }
    if (
      !parserExited &&
      option.nativeReadTreeExclude &&
      abi?.readTreeExclude === 'legacy' &&
      commandUsesReadTreeExclude(command, args)
    ) {
      if (readTreeExcludeSeen) {
        throw new GitArgumentError('--exclude-per-directory: repeated legacy callback');
      }
      readTreeExcludeSeen = true;
      option = { ...option, checks: undefined, allowed: undefined };
    }
    if (!parserExited && abi?.lsTreeModes === 'bits' && commandUsesLsTreeModes(command, args)) {
      if (option.nativeLsTreeModern) {
        throw new GitArgumentError(`${flag}: unavailable in the selected legacy ls-tree parser`);
      }
      if (option.nativeLsTreeMode) {
        option = { ...option, modeGroup: undefined };
      }
    }
    // git.c transfers a first-word --help to git-help before the local parser.
    // Later help spellings belong to that dispatcher, whose usage exit varies
    // with the selected Git; preserve its result instead of imposing local position rules.
    const documentationHelp =
      option.key === 'help' &&
      spec.argv.length === 1 &&
      Array.isArray(args[0]) &&
      args[0].length === 1 &&
      args[0][0] === '--help';
    if (option.firstOnly && index !== 0 && !documentationHelp && !firstWordExited) {
      throw new GitArgumentError(`${command}: ${flag} must be the first argument`);
    }
    if (arg.length > 2) {
      throw new GitArgumentError(`${command}: ${flag} accepts at most one value`);
    }
    const supplied = arg.length === 2 && arg[1] !== undefined;
    const rawValue = option.clear ? undefined : supplied ? arg[1] : (option.set ?? true);
    if (
      typeof rawValue === 'string' &&
      rawValue.includes(ARGV_STRING_CONSTRAINT.forbiddenCharacter)
    ) {
      throw new GitArgumentError(`${flag}: NUL is not a valid CLI argument`);
    }
    if (
      !parserExited &&
      option.nativeEnumCallback === 'conflict-style' &&
      Array.isArray(args[0]) &&
      args[0].length === 1 &&
      spec.parserExit?.exceptFirst?.includes(args[0][0])
    ) {
      throw new GitArgumentError(`${flag}: not an option of Git's help dispatcher`);
    }
    const deferredInteger =
      option.nativeIntegerTiming === 'repack-max-pack-size' &&
      abi?.repackMaxPackSize === 'deferred' &&
      commandUsesRepackMaxPackSize(command, args);
    const integerParser = typeof option.parser === 'object';
    if (integerParser && supplied && !['string', 'number', 'bigint'].includes(typeof rawValue)) {
      throw new GitArgumentError(`${flag}: expected a number, bigint or numeric string`);
    }
    const integer =
      integerParser && !parserExited && !deferredInteger
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
            abi?.booleanSource,
            abi?.booleanBinaryIntegers,
            abi?.booleanCapabilities,
            abi?.compoundNegatedOverflow,
            abi?.depthAtoiBits,
          )
        : undefined;
    if (integer && !integer.valid) {
      throw new GitArgumentError(`${flag}: invalid integer value ${String(rawValue)}`);
    }
    const value = integer ? integer.value : rawValue;
    if (!parserExited && option.checks) {
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
      !parserExited &&
      (supplied || numeric) &&
      !(option.nativeEnumCallback === 'conflict-style' && abi?.conflictStyle === 'deferred') &&
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
        const interpretedInteger = [
          'python-int',
          'perl-int',
          'perl-int-gnu',
          'fast-import-active-branches',
          'fast-import-depth',
          'fast-import-cat-blob-fd',
        ].includes(typeof option.parser === 'string' ? option.parser : '');
        if (
          option.value.endsWith('integer') &&
          !integerParser &&
          (interpretedInteger
            ? !['number', 'string', 'bigint'].includes(typeof value)
            : parserExited
              ? typeof value !== 'number'
              : !Number.isSafeInteger(value))
        ) {
          throw new GitArgumentError(
            `${flag}: expected ${interpretedInteger ? 'integer text, number or bigint' : parserExited ? 'a number' : 'a safe integer'}`,
          );
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
      if (operandIndexes) {
        for (const [slot, operandIndex] of operandIndexes.entries()) {
          if (operandIndex >= position) {
            operandIndexes[slot] = operandIndex + emitted.length;
          }
        }
      }
      prefixCounts.set(option.before, (prefixCounts.get(option.before) ?? 0) + emitted.length);
    }
    if (
      !ended &&
      spec.usageExit?.flags.includes(flag) &&
      !(index === 0 && spec.usageExit.exceptFirst?.includes(flag))
    ) {
      usageExited = true;
      parserExited = true;
      guardExited = true;
      continue;
    }
    if (guard && !guardExited) {
      if (option.consumesRest) {
        guardLiteral = true;
      }
      if (
        spec.parserExit?.flags.includes(flag) &&
        !(index === 0 && spec.parserExit.exceptFirst?.includes(flag))
      ) {
        guardExited = true;
      }
    }
    if (parserExited) {
      continue;
    }
    if (option.rejectedWhenReached) {
      throw new GitArgumentError(`${flag}: ${option.rejectedWhenReached.reason}`);
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
      (deferredInteger ? { valid: true, value } : undefined) ??
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
            abi?.booleanSource,
            abi?.booleanBinaryIntegers,
            abi?.booleanCapabilities,
            abi?.compoundNegatedOverflow,
            abi?.depthAtoiBits,
          )
        : { valid: true, value });
    if (!parsed.valid) {
      if (option.parserErrorKey) {
        state[option.parserErrorKey] = true;
      } else {
        throw new GitArgumentError(`${flag}: invalid ${option.parser} value ${String(value)}`);
      }
    }
    if (option.consumesRest) {
      literalOperands = true;
    }
    if (option.ignore) {
      if (option.emptyIsUnset && abi?.filenameProfile && abi.filenameProfile !== 'optional') {
        state[option.key] = undefined;
      }
      continue;
    }
    if (option.emptyIsUnset && typeof value === 'string') {
      if (value.startsWith(':(optional)') && abi?.stopBeforeFilename !== undefined) {
        // The runner supplies one counter across parser replay passes.
        if (abi.stopBeforeFilename === 0) {
          return argv;
        }
        abi.stopBeforeFilename--;
      }
    }
    if (!parsed.valid && option.parserErrorKey) {
      // Getopt leaves the destination unchanged on an invalid value; its rc remains false.
    } else if (option.toggle) {
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
    } else if (
      option.emptyIsUnset &&
      abi?.filenameProfile === 'optional' &&
      typeof value === 'string' &&
      value.startsWith(':(optional)') &&
      abi.ignoreOptionalFilename?.(option.key, value)
    ) {
      // A missing optional file retains the prior pointer, including an earlier assignment.
    } else {
      state[option.key] =
        option.emptyIsUnset && value === '' && abi?.filenameProfile !== 'legacy'
          ? undefined
          : option.caseInsensitive && !option.preserveCase && typeof parsed.value === 'string'
            ? asciiLower(parsed.value)
            : parsed.value;
    }
    for (const effect of option.nativeEnumCallback === 'conflict-style' &&
    abi?.conflictStyle === 'deferred'
      ? []
      : (option.effects ?? [])) {
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
  state.operand1 = operands[1];
  if (!(abi?.deferFinalRules || parserExited || replay?.parserExited) && state.help !== true) {
    if (abi?.conflictStyle === 'deferred') {
      if (state.conflict !== undefined) {
        state.merge = true;
      }
      for (const option of Object.values(spec.options)) {
        if (
          option.nativeEnumCallback === 'conflict-style' &&
          state[option.key] !== undefined &&
          !option.allowed?.includes(state[option.key] as string)
        ) {
          throw new GitArgumentError(
            `--conflict: unsupported final option value ${String(state[option.key])}`,
          );
        }
      }
    }
    if (abi?.submoduleInitAlias && spec.argv.join(' ') === 'submodule update') {
      state['short-init'] = false;
    }
    const errors = violations(spec.rules, state, abi);
    if (errors.length > 0) {
      throw new GitArgumentError(
        `${command}: ${errors.map((rule) => `[${rule.id}] ${rule.reason}`).join('; ')}`,
      );
    }
    if (readTreeExcludeSeen && state.u !== true) {
      throw new GitArgumentError('--exclude-per-directory: legacy callback requires -u');
    }
  }
  return argv;
}

/** Serialize only the representation guards; unknown native parser responses retain this original argv. */
export function commandShapeArguments(
  command: GitCommandName,
  args: readonly unknown[],
  inRepository?: boolean,
): string[] {
  return buildArguments(command, args, inRepository, undefined, undefined, undefined, 'shape');
}

/**
 * Serialize shape for execution by a native parser whose profile is unknown. Semantic checks
 * stay with the selected Git, but an operand object that a full evaluation would refuse as a
 * live option or boundary is refused here too; both first-pass `--empty` arities are checked.
 */
export function commandExecutableShapeArguments(
  command: GitCommandName,
  args: readonly unknown[],
  inRepository?: boolean,
): string[] {
  for (const firstPassEmpty of [true, false]) {
    buildArguments(
      command,
      args,
      inRepository,
      { longBits: 64, sizeTBits: 64, firstPassEmpty },
      undefined,
      undefined,
      'shape',
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );
  }
  return commandShapeArguments(command, args, inRepository);
}

/** Observe the legacy stash parent's help exit without executing any child semantics. */
export function commandHasLegacyStashHelp(
  command: GitCommandName,
  args: readonly unknown[],
  inRepository?: boolean,
): boolean {
  if (command !== 'stash' && !command.startsWith('stash ')) {
    return false;
  }
  const spec: CommandSpec = commandSpecs()[command];
  const words = commandShapeArguments(command, args, inRepository).slice(1);
  return initialParserPass(spec, words, true, {
    origin: 'git',
    reason: 'Legacy stash parses help in an empty parent pass before child dispatch.',
    source: 'Git 2.25.1 builtin/stash.c:cmd_stash',
    flags: ['-h', '--help'],
    firstPassOptions: [],
    firstPassLongNames: [],
    keepDashDash: true,
  }).exited;
}

/** Detect an actually reached modern --empty callback, including a split value that becomes an option. */
export function commandUsesFirstPassEmpty(
  command: GitCommandName,
  args: readonly unknown[],
): boolean {
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesFirstPassEmpty(dispatched.command, dispatched.args);
  }
  if (!spec.parserExit?.firstPassOptions?.includes('--empty')) {
    return false;
  }
  const words = commandShapeArguments(command, args, true).slice(spec.argv.length);
  const modern = initialParserPass(spec, words, true);
  const legacy = initialParserPass(spec, words, false);
  return (modern.exited || legacy.exited) && modern.tokens.some((token) => token[0] === '--empty');
}

/** Stop trait discovery where an audited parser exits; later words are only serialized. */
function interpretedArguments(
  spec: CommandSpec,
  args: readonly unknown[],
  emptyRegistered = true,
): readonly unknown[] {
  if (!spec.parserExit) {
    return args;
  }
  if (spec.parserExit.firstPassOptions) {
    const command = spec.argv.join(' ') as GitCommandName;
    const words = commandShapeArguments(command, args, true);
    const pass = initialParserPass(spec, words.slice(spec.argv.length), emptyRegistered);
    if (spec.conditionalCommand) {
      return pass.tokens;
    }
    if (pass.exited) {
      return pass.tokens;
    }
    if (!pass.delegated) {
      // Terminal operands are never candidates for child option capability probes.
      if (spec.parserExit.remainingOperands !== undefined) {
        return pass.tokens;
      }
      const partition = partitionRemainingArguments(spec, pass.remaining);
      return [...pass.tokens, ...revisionParserPass(spec, partition.words).tokens];
    }
  }
  for (const [index, token] of args.entries()) {
    if (token && typeof token === 'object' && !Array.isArray(token) && 'operand' in token) {
      if (spec.optionParsing === 'stop-at-operand' || spec.optionParsing === 'none') {
        return args;
      }
      continue;
    }
    if (!Array.isArray(token) || typeof token[0] !== 'string') {
      continue;
    }
    const flag = token[0];
    if ((flag === '--' && token.length === 1) || spec.options[flag]?.consumesRest) {
      return args;
    }
    if (
      token.length === 1 &&
      spec.parserExit.flags.includes(flag) &&
      !(index === 0 && spec.parserExit.exceptFirst?.includes(flag))
    ) {
      return args.slice(0, index);
    }
  }
  return args;
}

/** Detect the alias actually forwarded before a boundary or helper help exit. */
export function commandUsesSubmoduleInitAlias(
  command: GitCommandName,
  args: readonly unknown[],
): boolean {
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesSubmoduleInitAlias(dispatched.command, dispatched.args);
  }
  if (command !== 'submodule update' && command !== 'submodule--helper update') {
    return false;
  }
  let short = false;
  for (const token of args) {
    if (!Array.isArray(token) || token[0] === '--') {
      break;
    }
    if (token[0] === '-h' || token[0] === '--help') {
      return command === 'submodule update' ? false : short;
    }
    if (token[0] === '-i') {
      short = true;
    }
    if (command === 'submodule update' && token[0] === '--init') {
      short = false;
    }
  }
  return short;
}

/** Detect a final depth conversion without a help exit or a subsequent reset. */
export function commandUsesDepthAtoi(command: GitCommandName, args: readonly unknown[]): boolean {
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesDepthAtoi(dispatched.command, dispatched.args);
  }
  if (!spec.rules.some((rule) => rule.kind === 'scalar' && rule.parser === 'depth-initial')) {
    return false;
  }
  let depth = false;
  for (const [index, token] of args.entries()) {
    if (!Array.isArray(token)) {
      continue;
    }
    if (token.length === 1 && token[0] === '--') {
      break;
    }
    if (
      token.length === 1 &&
      spec.parserExit?.flags.includes(token[0]) &&
      !(index === 0 && spec.parserExit.exceptFirst?.includes(token[0]))
    ) {
      return false;
    }
    const option = spec.options[token[0]];
    if (option?.key === 'depth') {
      depth = token[0] !== '--no-depth';
    }
  }
  return depth;
}

/** Whether emitted options need the selected executable's native integer widths. */
export function commandUsesNativeABI(
  command: GitCommandName,
  args: readonly unknown[],
  emptyRegistered = true,
): boolean {
  if (!(Array.isArray(args) && Object.hasOwn(commandSpecs(), command))) {
    return false;
  }
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesNativeABI(dispatched.command, dispatched.args, emptyRegistered);
  }
  return interpretedArguments(spec, args, emptyRegistered).some((arg) => {
    if (!Array.isArray(arg) || typeof arg[0] !== 'string') {
      return false;
    }
    const option = Object.hasOwn(spec.options, arg[0])
      ? spec.options[arg[0]]
      : spec.numericOption && /^-\d+$/.exec(arg[0])?.[0] === arg[0]
        ? spec.numericOption
        : undefined;
    const remaining = spec.parserExit?.remainingOptions;
    const parser =
      option?.parser ??
      (remaining && Object.hasOwn(remaining, arg[0]) ? remaining[arg[0]]?.parser : undefined);
    return (
      (typeof parser === 'string' && isBooleanCallback(parser)) ||
      option?.nativeEnumCallback === 'conflict-style' ||
      typeof parser === 'object' ||
      parser === 'abbrev' ||
      parser === 'mainline' ||
      parser === 'object-filter' ||
      parser === 'object-filter-auto' ||
      parser === 'unsigned-size' ||
      isCompoundDecimal(parser)
    );
  });
}

/** Whether a filter uses a binary integer whose libc support must be observed. */
export function commandUsesObjectFilterBinary(
  command: GitCommandName,
  args: readonly unknown[],
  emptyRegistered = true,
): boolean {
  const spec: CommandSpec | undefined = Object.hasOwn(commandSpecs(), command)
    ? commandSpecs()[command]
    : undefined;
  if (!(spec && Array.isArray(args))) {
    return false;
  }
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesObjectFilterBinary(dispatched.command, dispatched.args, emptyRegistered);
  }
  return interpretedArguments(spec, args, emptyRegistered).some((arg) => {
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
        objectFilterUsesBinary(arg[1])) ||
      ((option?.parser === 'pack-objects-index-version' ||
        option?.parser === 'index-pack-index-version') &&
        /,[ \t\r\n\v\f]*[+-]?0[bB]/.test(arg[1]))
    );
  });
}

/** Whether a schema integer used decimal int assignment in the older parser family. */
export function commandUsesIntegerProfile(
  command: GitCommandName,
  args: readonly unknown[],
  emptyRegistered = true,
): boolean {
  if (!(Array.isArray(args) && Object.hasOwn(commandSpecs(), command))) {
    return false;
  }
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesIntegerProfile(dispatched.command, dispatched.args, emptyRegistered);
  }
  return interpretedArguments(spec, args, emptyRegistered).some((arg) => {
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
  emptyRegistered = true,
): boolean {
  if (!(Array.isArray(args) && Object.hasOwn(commandSpecs(), command))) {
    return false;
  }
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesNegativeMagnitude(dispatched.command, dispatched.args, emptyRegistered);
  }
  return interpretedArguments(spec, args, emptyRegistered).some((arg) => {
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
        /^(?:[ \t\r\n\v\f]*-|[kKmMgG]$)/.test(String(arg[1]))) ||
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
  emptyRegistered = true,
): GitDecimalCallback[] {
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandDecimalCallbacks(dispatched.command, dispatched.args, emptyRegistered);
  }
  const callbacks = new Set<GitDecimalCallback>();
  for (const arg of interpretedArguments(spec, args, emptyRegistered)) {
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
      (option.parser.kind === 'decimal' || option.parser.kind === 'timestamp') &&
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
  emptyRegistered = true,
): boolean {
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesDecimalCallback(dispatched.command, dispatched.args, emptyRegistered);
  }
  return interpretedArguments(spec, args, emptyRegistered).some((arg) => {
    if (!Array.isArray(arg) || typeof arg[0] !== 'string') {
      return false;
    }
    const option = Object.hasOwn(spec.options, arg[0]) ? spec.options[arg[0]] : spec.numericOption;
    return (
      typeof option?.parser === 'object' &&
      (option.parser.kind === 'decimal' || option.parser.kind === 'timestamp')
    );
  });
}

/** Detect C char dependent combined-filter words after dispatcher selection. */
export function commandUsesObjectFilterCharProfile(
  command: GitCommandName,
  args: readonly unknown[],
  emptyRegistered = true,
): boolean {
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesObjectFilterCharProfile(dispatched.command, dispatched.args, emptyRegistered);
  }
  return interpretedArguments(spec, args, emptyRegistered).some((arg) => {
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

/** Compound callbacks use selected C long widths; unknown metadata retains native execution. */
export function commandUsesCompoundDecimal(
  command: GitCommandName,
  args: readonly unknown[],
  emptyRegistered = true,
): boolean {
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesCompoundDecimal(dispatched.command, dispatched.args, emptyRegistered);
  }
  return interpretedArguments(spec, args, emptyRegistered).some((arg) => {
    if (!Array.isArray(arg) || typeof arg[0] !== 'string') {
      return false;
    }
    const option = Object.hasOwn(spec.options, arg[0]) ? spec.options[arg[0]] : undefined;
    const remaining = spec.parserExit?.remainingOptions;
    const parser =
      option?.parser ??
      (remaining && Object.hasOwn(remaining, arg[0]) ? remaining[arg[0]]?.parser : undefined);
    return (
      isCompoundDecimal(parser) ||
      (typeof parser === 'object' &&
        parser !== null &&
        parser.kind === 'decimal' &&
        parser.unsignedLong === true)
    );
  });
}

/** Observe reached legacy bit options before help or an end-of-options marker. */
export function commandUsesLsTreeModes(command: GitCommandName, args: readonly unknown[]): boolean {
  if (
    command !== 'ls-tree' ||
    !Array.isArray(args) ||
    isDocumentationDispatch(commandSpecs()[command], args)
  ) {
    return false;
  }
  let reached = false;
  for (const arg of args) {
    if (arg === '--' || (Array.isArray(arg) && arg.length === 1 && arg[0] === '--')) {
      return reached;
    }
    if (!Array.isArray(arg)) {
      continue;
    }
    if (arg.length === 1 && ['-h', '--help', '--help-all'].includes(arg[0])) {
      return reached;
    }
    if (arg.length === 1 && ['-l', '--long', '--name-only', '--name-status'].includes(arg[0])) {
      reached = true;
    }
  }
  return reached;
}

/** Profile an exclude callback reached before help or an end-of-options marker. */
export function commandUsesReadTreeExclude(
  command: GitCommandName,
  args: readonly unknown[],
): boolean {
  if (
    command !== 'read-tree' ||
    !Array.isArray(args) ||
    isDocumentationDispatch(commandSpecs()[command], args)
  ) {
    return false;
  }
  let reached = false;
  for (const arg of args) {
    if (arg === '--' || (Array.isArray(arg) && arg.length === 1 && arg[0] === '--')) {
      return reached;
    }
    if (!Array.isArray(arg)) {
      continue;
    }
    if (arg.length === 1 && ['-h', '--help', '--help-all'].includes(arg[0])) {
      return reached;
    }
    if (arg[0] === '--exclude-per-directory' && arg.length === 2) {
      reached = true;
    }
  }
  return reached;
}

/** Only an actual internal help exit can bypass the older deferred repack value. */
export function commandUsesRepackMaxPackSize(
  command: GitCommandName,
  args: readonly unknown[],
): boolean {
  if (
    command !== 'repack' ||
    !Array.isArray(args) ||
    isDocumentationDispatch(commandSpecs()[command], args)
  ) {
    return false;
  }
  let reached = false;
  for (const arg of args) {
    if (arg === '--' || (Array.isArray(arg) && arg.length === 1 && arg[0] === '--')) {
      return false;
    }
    if (!Array.isArray(arg)) {
      continue;
    }
    if (arg.length === 1 && ['-h', '--help', '--help-all'].includes(arg[0])) {
      return reached;
    }
    if (arg[0] === '--max-pack-size' && arg.length === 2) {
      reached = true;
    }
  }
  return false;
}

/** Whether a conflict-style callback before help needs a selected-executable timing profile. */
export function commandUsesConflictStyle(
  command: GitCommandName,
  args: readonly unknown[],
  emptyRegistered = true,
): boolean {
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesConflictStyle(dispatched.command, dispatched.args, emptyRegistered);
  }
  return interpretedArguments(spec, args, emptyRegistered).some(
    (arg) =>
      Array.isArray(arg) &&
      typeof arg[0] === 'string' &&
      Object.hasOwn(spec.options, arg[0]) &&
      spec.options[arg[0]]?.nativeEnumCallback === 'conflict-style',
  );
}

/** Boolean source traits used before an audited parser exit. */
export function commandUsesBooleanSource(
  command: GitCommandName,
  args: readonly unknown[],
  emptyRegistered = true,
): boolean {
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesBooleanSource(dispatched.command, dispatched.args, emptyRegistered);
  }
  return interpretedArguments(spec, args, emptyRegistered).some(
    (arg) =>
      Array.isArray(arg) &&
      typeof arg[0] === 'string' &&
      Object.hasOwn(spec.options, arg[0]) &&
      typeof spec.options[arg[0]]?.parser === 'string' &&
      isBooleanCallback(spec.options[arg[0]]!.parser as string),
  );
}
/** Binary-prefix configuration integers depend on the selected libc, separately from filter parsing. */
export function commandUsesBooleanBinary(
  command: GitCommandName,
  args: readonly unknown[],
  emptyRegistered = true,
): boolean {
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesBooleanBinary(dispatched.command, dispatched.args, emptyRegistered);
  }
  return interpretedArguments(spec, args, emptyRegistered).some(
    (arg) =>
      Array.isArray(arg) &&
      typeof arg[0] === 'string' &&
      Object.hasOwn(spec.options, arg[0]) &&
      typeof spec.options[arg[0]]?.parser === 'string' &&
      isBooleanCallback(spec.options[arg[0]]!.parser as string) &&
      typeof arg[1] === 'string' &&
      /^[ \t\r\n\v\f]*[+-]?0[bB]/.test(arg[1]),
  );
}

/** Only named callback features before an audited exit require availability observation. */
export function commandBooleanFeatures(
  command: GitCommandName,
  args: readonly unknown[],
  emptyRegistered = true,
): (keyof GitBooleanCapabilities)[] {
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandBooleanFeatures(dispatched.command, dispatched.args, emptyRegistered);
  }
  const features = new Set<keyof GitBooleanCapabilities>();
  for (const arg of interpretedArguments(spec, args, emptyRegistered)) {
    if (!Array.isArray(arg) || typeof arg[0] !== 'string' || !Object.hasOwn(spec.options, arg[0])) {
      continue;
    }
    const parser = spec.options[arg[0]]?.parser;
    if (parser === 'pull-rebase' && (arg[1] === 'preserve' || arg[1] === 'p')) {
      features.add('preserve');
    }
    if (parser === 'push-recurse' && arg[1] === 'only-is-on-demand') {
      features.add('onlyIsOnDemand');
    }
  }
  return [...features];
}

/** Collect only filename updates reached by the selected native parser passes. */
export function commandFilenameTokens(
  command: GitCommandName,
  args: readonly unknown[],
  firstPassEmpty = true,
): { key: string; value: unknown; ignore: boolean }[] {
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandFilenameTokens(dispatched.command, dispatched.args, firstPassEmpty);
  }
  const updates: { key: string; value: unknown; ignore: boolean }[] = [];
  /** Observe each filename token before a later native parse error can preempt it. */
  const collect = (token: readonly unknown[]): false => {
    const flag = token[0];
    const option =
      typeof flag === 'string' && Object.hasOwn(spec.options, flag)
        ? spec.options[flag]
        : undefined;
    if (option?.emptyIsUnset) {
      updates.push({ key: option.key, value: token[1], ignore: option.ignore === true });
    }
    return false;
  };
  if (spec.parserExit?.firstPassOptions) {
    try {
      const words = commandShapeArguments(command, args, true).slice(spec.argv.length);
      initialParserPass(spec, words, firstPassEmpty, spec.parserExit, collect);
    } catch (error) {
      // A reached optional stat may terminate before the later syntax error.
      if (
        !(
          error instanceof GitArgumentError &&
          updates.some(
            (update) => typeof update.value === 'string' && update.value.startsWith(':(optional)'),
          )
        )
      ) {
        throw error;
      }
    }
    return updates;
  }
  for (const token of interpretedArguments(spec, args, firstPassEmpty)) {
    if (Array.isArray(token)) {
      collect(token);
    }
  }
  return updates;
}

/** Observe only empty pickaxe callbacks reached before a native parser exit. */
export function commandUsesEmptyPickaxe(
  command: GitCommandName,
  args: readonly unknown[],
): boolean {
  const spec: CommandSpec = commandSpecs()[command];
  const dispatched = dispatchArguments(spec, args);
  if (dispatched) {
    return commandUsesEmptyPickaxe(dispatched.command, dispatched.args);
  }
  if (command === 'difftool') {
    let toolHelp = false;
    for (const token of args) {
      if (!Array.isArray(token)) {
        continue;
      }
      if (token[0] === '--tool-help') {
        toolHelp = true;
      }
      if (token[0] === '--no-tool-help') {
        toolHelp = false;
      }
    }
    if (toolHelp) {
      return false;
    }
  }
  for (const arg of interpretedArguments(spec, args)) {
    if (!Array.isArray(arg)) {
      continue;
    }
    if (
      arg[1] === '' &&
      (spec.options[arg[0]]?.nativeEmptyPickaxe ||
        spec.rules.some(
          (rule) =>
            rule.nativeEmptyPickaxe &&
            rule.kind === 'required' &&
            rule.required.some(
              (predicate) =>
                predicate.test === 'optionValuesNonempty' && predicate.value === arg[0],
            ),
        ))
    ) {
      return true;
    }
  }
  return false;
}

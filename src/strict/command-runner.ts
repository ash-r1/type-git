import process from 'node:process';
import {
  commandArguments,
  commandBooleanFeatures,
  commandDecimalCallbacks,
  commandExecutableShapeArguments,
  commandFilenameTokens,
  commandHasLegacyStashHelp,
  commandShapeArguments,
  commandUsesBooleanBinary,
  commandUsesBooleanSource,
  commandUsesCompoundDecimal,
  commandUsesConflictStyle,
  commandUsesDecimalCallback,
  commandUsesDepthAtoi,
  commandUsesEmptyPickaxe,
  commandUsesFirstPassEmpty,
  commandUsesIntegerProfile,
  commandUsesLsTreeModes,
  commandUsesNativeABI,
  commandUsesNegativeMagnitude,
  commandUsesObjectFilterBinary,
  commandUsesObjectFilterCharProfile,
  commandUsesObjectFilterEmptyComponent,
  commandUsesReadTreeExclude,
  commandUsesRepackMaxPackSize,
  commandUsesSubmoduleInitAlias,
  type FilenameContext,
  type FilenameProfile,
  isDocumentationDispatch,
  validateArgvStrings,
} from '../commands/build.js';
import { commandSpecs } from '../commands/catalogue.js';
import {
  type GuiGrammar,
  guiGrammarFromSource,
  guiLaunchFromSource,
} from '../commands/gui-syntax.js';
import { initialParserPass } from '../commands/initial-parser-pass.js';
import type { CommandSpec } from '../commands/spec.js';
import type { GitCommandName } from '../commands/types.js';
import { nativeCLongBits, nativeSizeTBits } from '../constraints/c-abi.js';
import type { GitBooleanCapabilities, GitBooleanSource } from '../constraints/git-boolean.js';
import {
  DECIMAL_CALLBACK_PROBES,
  decimalCallbackFamily,
  type GitDecimalCallbacks,
} from '../constraints/git-decimal.js';
import type { GitIntegerProfile } from '../constraints/git-integer.js';
import {
  OBJECT_FILTER_CHAR_PROBE,
  OBJECT_FILTER_EMPTY_PROBE,
  objectFilterCombineEmptyComponents,
  objectFilterUnsignedChar,
} from '../constraints/object-filter.js';
import { PICKAXE_EMPTY_PROBE, pickaxeEmptyRejected } from '../constraints/pickaxe-profile.js';
import type { ExecutionContext, RawResult } from '../core/types.js';
import { GitArgumentError } from '../core/types.js';
import {
  type CliRunner,
  type CommandRunOptions,
  cliRunnerInternals,
  type RunOptions,
  validateIO,
} from '../runner/cli-runner.js';

/**
 * Grammar-checked execution behind `strict(...).command()`.
 *
 * Validates typed argv against the generated command catalogue, observes only the native
 * parser traits that affect validity, and then executes the original ordered words through
 * the shared CliRunner execution path. Lives outside the lightweight runner so the catalogue
 * and probes are loaded only by `type-git/strict`.
 */
export class StrictCommandRunner {
  private readonly runner: ReturnType<typeof cliRunnerInternals>;

  public constructor(runner: CliRunner) {
    this.runner = cliRunnerInternals(runner);
  }

  public runCommand(
    context: ExecutionContext,
    command: GitCommandName,
    args: readonly unknown[],
    inRepository: boolean | undefined,
    opts: RunOptions & { stdout: 'bytes' },
  ): Promise<RawResult<Uint8Array>>;
  public runCommand(
    context: ExecutionContext,
    command: GitCommandName,
    args: readonly unknown[],
    inRepository: boolean | undefined,
    opts?: RunOptions & { stdout?: 'text' },
  ): Promise<RawResult>;
  public runCommand(
    context: ExecutionContext,
    command: GitCommandName,
    args: readonly unknown[],
    inRepository: boolean | undefined,
    opts: CommandRunOptions | undefined,
  ): Promise<RawResult<string | Uint8Array>>;
  /** Validate argv, observe only relevant native parser traits, and execute the original ordered words. */
  public async runCommand(
    context: ExecutionContext,
    command: GitCommandName,
    args: readonly unknown[],
    inRepository: boolean | undefined,
    opts?: CommandRunOptions,
  ): Promise<RawResult<string | Uint8Array>> {
    return this.runCommandWithFilename(context, command, args, inRepository, opts);
  }

  /** Preserve the existing native ABI pipeline while selecting filename state independently. */
  private async runCommandWithFilename(
    context: ExecutionContext,
    command: GitCommandName,
    args: readonly unknown[],
    inRepository: boolean | undefined,
    opts?: CommandRunOptions,
    filename?: FilenameContext,
    validateOnly = false,
  ): Promise<RawResult<string | Uint8Array>> {
    validateIO(opts);
    validateArgvStrings(args);
    const binary = opts?.stdout === 'bytes';
    /** Preserve filename observations while each existing ABI candidate is checked. */
    const build: typeof commandArguments = (
      name,
      tokens,
      repository,
      selectedAbi,
      grammar,
      launch,
    ) =>
      commandArguments(
        name,
        tokens,
        repository,
        command === 'whatchanged' || command === 'pack-redundant'
          ? {
              longBits: nativeCLongBits(process.platform, process.arch),
              sizeTBits: nativeSizeTBits(process.arch),
              ...selectedAbi,
              ...filename,
              // Preserve the selected executable's version-dependent deprecation
              // diagnosis instead of imposing the pinned schema's opt-in policy.
              ...(command === 'whatchanged'
                ? { whatchangedOptInRequired: false }
                : { packRedundantOptInRequired: false }),
            }
          : filename
            ? { longBits: 64, sizeTBits: 64, ...selectedAbi, ...filename }
            : selectedAbi,
        grammar,
        launch,
      );

    const spec: CommandSpec = commandSpecs()[command];
    let traitArgs = args;
    if (filename?.stopBeforeFilename !== undefined && spec.parserExit?.firstPassOptions) {
      let reached = 0;
      const words = commandShapeArguments(command, args, inRepository).slice(spec.argv.length);
      const prefix = initialParserPass(spec, words, true, spec.parserExit, (token) => {
        const option = spec.options[token[0]!];
        return (
          option?.emptyIsUnset === true &&
          typeof token[1] === 'string' &&
          token[1].startsWith(':(optional)') &&
          reached++ === filename.stopBeforeFilename
        );
      });
      traitArgs = prefix.tokens;
    }
    /** Execute the original argv, or finish a read-only prefix validation without spawning it. */
    const execute = (argv: string[]): Promise<RawResult<string | Uint8Array>> => {
      if (validateOnly) {
        return Promise.resolve({
          exitCode: 0,
          stdout: binary ? new Uint8Array(0) : '',
          stderr: '',
          aborted: false,
        });
      }
      if (spec.executable) {
        return binary
          ? this.runner.runCompanionBytes(context, spec.executable, argv.slice(1), opts)
          : this.runner.runCompanion(context, spec.executable, argv.slice(1), opts);
      }
      return binary
        ? this.runner.runBytes(context, argv, opts)
        : this.runner.run(context, argv, opts);
    };
    if (isDocumentationDispatch(spec, args)) {
      return await execute(build(command, args, inRepository));
    }
    // Old stash scans the parent argv for help before dispatch; newer Git stops
    // at a subcommand. Let the selected Git decide this source-dependent exit.
    if (commandHasLegacyStashHelp(command, args, inRepository)) {
      return await execute(commandExecutableShapeArguments(command, args, inRepository));
    }
    if (spec.guiScript) {
      const argv = build(command, args, inRepository);
      if (
        (binary && !this.runner.exec.spawnBytes) ||
        !this.runner.fs.readFile ||
        argv[1] === '--help'
      ) {
        return await execute(argv);
      }
      const probeOptions = {
        ...(opts?.env ? { env: opts.env } : {}),
        ...(opts?.signal ? { signal: opts.signal } : {}),
      };
      const path = await this.runner.probe(context, ['--exec-path'], probeOptions);
      if (path.aborted) {
        return { ...path, stdout: binary ? new Uint8Array(0) : path.stdout };
      }
      if (path.exitCode !== 0) {
        return await execute(argv);
      }
      let source: string;
      try {
        source = await this.runner.fs.readFile(
          `${path.stdout.replace(/\r?\n$/, '')}/git-${argv[0]}`,
        );
      } catch {
        return await execute(argv);
      }
      const launch = guiLaunchFromSource(source);
      if (launch === 'direct-tcl') {
        // Windows invokes Tcl directly: querying --version can open a modal GUI.
        const tclPath = `${path.stdout.replace(/\r?\n$/, '')}/git-gui.tcl`;
        let grammar: GuiGrammar | undefined;
        try {
          grammar = guiGrammarFromSource(await this.runner.fs.readFile(tclPath));
        } catch {
          /* Unknown source keeps native validation. */
        }
        return await execute(build(command, args, inRepository, undefined, grammar, launch));
      }
      const grammar = guiGrammarFromSource(source);
      if (!grammar) {
        return await execute(argv);
      }
      const version = await this.runner.probe(context, [argv[0]!, '--version'], probeOptions);
      if (version.aborted) {
        return { ...version, stdout: binary ? new Uint8Array(0) : version.stdout };
      }
      const reported = /^\s*echo '([^']+)'/m.exec(source)?.[1];
      if (version.exitCode !== 0 || version.stdout.replace(/\r?\n$/, '') !== reported) {
        return await execute(argv);
      }
      return await execute(build(command, args, inRepository, undefined, grammar, launch));
    }
    if (!filename) {
      const updates = commandFilenameTokens(command, args);
      const sensitive = updates.some(
        (update) =>
          update.ignore ||
          update.value === '' ||
          (typeof update.value === 'string' && update.value.startsWith(':(optional)')),
      );
      if (sensitive) {
        const allProfilesAccept = (['legacy', 'intermediate', 'optional'] as const).every(
          (candidateProfile) => {
            try {
              commandArguments(command, args, inRepository, {
                longBits: 64,
                sizeTBits: 64,
                filenameProfile: candidateProfile,
              });
              return true;
            } catch (error) {
              if (!(error instanceof GitArgumentError)) {
                throw error;
              }
              return false;
            }
          },
        );
        if (allProfilesAccept) {
          return this.runCommandWithFilename(context, command, args, inRepository, opts, {});
        }
        const optional = updates.filter(
          (update) =>
            !update.ignore &&
            typeof update.value === 'string' &&
            update.value.startsWith(':(optional)'),
        );
        if (optional.length === 0) {
          commandShapeArguments(command, args, inRepository);
        }
        const probeOptions = {
          ...(opts?.env ? { env: opts.env } : {}),
          ...(opts?.signal ? { signal: opts.signal } : {}),
        };
        const negate = await this.runner.probe(
          context,
          [
            'tag',
            '--list',
            'type-git-profile-readonly',
            '--file=type-git-profile-readonly',
            '--no-file',
          ],
          probeOptions,
        );
        if (negate.aborted) {
          return { ...negate, stdout: binary ? new Uint8Array(0) : negate.stdout };
        }
        const empty = await this.runner.probe(
          context,
          ['tag', '--list', 'type-git-profile-readonly', '--file='],
          probeOptions,
        );
        if (empty.aborted) {
          return { ...empty, stdout: binary ? new Uint8Array(0) : empty.stdout };
        }
        /** Distinguish a retained filename from an ignored optional path using tag usage. */
        const usage = (result: RawResult): boolean =>
          result.exitCode === 129 && /usage: git tag/.test(result.stderr);
        const profile: FilenameProfile | undefined =
          negate.exitCode === 0
            ? empty.exitCode === 0
              ? 'intermediate'
              : usage(empty)
                ? 'legacy'
                : undefined
            : usage(negate) && empty.exitCode === 0
              ? 'optional'
              : undefined;
        if (!profile) {
          return await execute(commandExecutableShapeArguments(command, args, inRepository));
        }
        const ignored = new Set<string>();
        if (profile === 'optional') {
          for (const [optionalIndex, update] of optional.entries()) {
            const validation = await this.runCommandWithFilename(
              context,
              command,
              args,
              inRepository,
              opts,
              {
                filenameProfile: profile,
                ignoreOptionalFilename: (_key, candidateValue) => ignored.has(candidateValue),
                deferFinalRules: true,
                stopBeforeFilename: optionalIndex,
              },
              true,
            );
            if (validation.aborted) {
              return validation;
            }
            const value = update.value as string;
            if (ignored.has(value)) {
              continue;
            }
            const result = await this.runner.probe(
              context,
              ['tag', '--list', 'type-git-profile-readonly', `--file=${value}`],
              probeOptions,
            );
            if (result.aborted) {
              return { ...result, stdout: binary ? new Uint8Array(0) : result.stdout };
            }
            if (result.exitCode === 0) {
              ignored.add(value);
            } else if (!usage(result)) {
              return await execute(commandExecutableShapeArguments(command, args, inRepository));
            }
          }
        }
        return this.runCommandWithFilename(context, command, args, inRepository, opts, {
          filenameProfile: profile,
          ignoreOptionalFilename: (_key, candidateValue) => ignored.has(candidateValue),
        });
      }
    }
    type NativeAbi = {
      longBits: 32 | 64;
      sizeTBits: 32 | 64;
      binaryIntegers?: boolean;
      integerProfile?: GitIntegerProfile;
      negativeMagnitudes?: boolean;
      decimalCallbacks?: GitDecimalCallbacks;
      unsignedChar?: boolean;
      combineEmptyComponents?: boolean;
      conflictStyle?: 'immediate' | 'deferred';
      repackMaxPackSize?: 'immediate' | 'deferred';
      readTreeExclude?: 'legacy' | 'modern';
      lsTreeModes?: 'bits' | 'cmdmode';
      booleanSource?: GitBooleanSource;
      booleanBinaryIntegers?: boolean;
      booleanCapabilities?: GitBooleanCapabilities;
      compoundNegatedOverflow?: boolean;
      firstPassEmpty?: boolean;
      depthAtoiBits?: 32 | 64;
      submoduleInitAlias?: boolean;
      emptyPickaxeRejected?: boolean;
    };
    let emptyPickaxeRejected: boolean | undefined;
    if (commandUsesEmptyPickaxe(command, traitArgs)) {
      const probe = await this.runner.probe(context, [...PICKAXE_EMPTY_PROBE], {
        ...(opts?.env ? { env: opts.env } : {}),
        ...(opts?.signal ? { signal: opts.signal } : {}),
      });
      if (probe.aborted) {
        return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
      }
      emptyPickaxeRejected = pickaxeEmptyRejected(probe);
      if (emptyPickaxeRejected === undefined) {
        return await execute(commandExecutableShapeArguments(command, args, inRepository));
      }
    }
    let submoduleInitAlias: boolean | undefined;
    if (commandUsesSubmoduleInitAlias(command, traitArgs)) {
      const probe = await this.runner.probe(context, ['submodule--helper', 'update', '-i', '-h'], {
        ...(opts?.env ? { env: opts.env } : {}),
        ...(opts?.signal ? { signal: opts.signal } : {}),
      });
      if (probe.aborted) {
        return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
      }
      if (
        [0, 129].includes(probe.exitCode) &&
        (probe.stdout + probe.stderr).startsWith('usage:') &&
        !/^(?:error|fatal):/m.test(probe.stderr)
      ) {
        submoduleInitAlias = true;
      } else if (probe.exitCode === 129 && /^error: unknown switch `i'\r?$/m.test(probe.stderr)) {
        submoduleInitAlias = false;
      } else {
        return await execute(commandExecutableShapeArguments(command, args, inRepository));
      }
    }
    let depthAtoiBits: 32 | 64 | undefined;
    if (commandUsesDepthAtoi(command, traitArgs)) {
      const observed = await this.runner.observeDepthAtoi(context, opts);
      if (observed.result?.aborted) {
        const probe = observed.result;
        return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
      }
      if (observed.bits === undefined) {
        return await execute(commandExecutableShapeArguments(command, args, inRepository));
      }
      depthAtoiBits = observed.bits;
    }
    let lsTreeModes: 'bits' | 'cmdmode' | undefined;
    if (commandUsesLsTreeModes(command, traitArgs)) {
      const original = commandExecutableShapeArguments(command, args, inRepository);
      const observations = [];
      for (const tail of [
        ['--long', '--name-only', '-h'],
        ['--name-only', '--long', '-h'],
        ['--name-only', '--name-status', '-h'],
      ]) {
        const probe = await this.runner.probe(context, ['ls-tree', ...tail], {
          ...(opts?.env ? { env: opts.env } : {}),
          ...(opts?.signal ? { signal: opts.signal } : {}),
        });
        if (probe.aborted) {
          return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
        }
        observations.push(probe);
      }
      const usage = (r: { exitCode: number; stdout: string; stderr: string }) =>
        [0, 129].includes(r.exitCode) &&
        (r.stdout + r.stderr).startsWith('usage:') &&
        !/^(?:error|fatal):/m.test(r.stderr);
      const pairs = [
        ['--name-only', '--long'],
        ['--long', '--name-only'],
        ['--name-status', '--name-only'],
      ];
      if (observations.every(usage)) {
        lsTreeModes = 'bits';
      } else if (
        observations.every(
          (r, i) =>
            r.exitCode === 129 &&
            r.stderr.startsWith(
              `error: options '${pairs[i]?.[0]}' and '${pairs[i]?.[1]}' cannot be used together`,
            ),
        )
      ) {
        lsTreeModes = 'cmdmode';
      } else {
        return await execute(original);
      }
    }
    let readTreeExclude: 'legacy' | 'modern' | undefined;
    if (commandUsesReadTreeExclude(command, traitArgs)) {
      const original = commandExecutableShapeArguments(command, args, inRepository);
      const observations = [];
      for (const tail of [
        ['--exclude-per-directory=.gitignore', '-h'],
        ['-u', '--exclude-per-directory=type-git-profile-ignore', '-h'],
        ['-u', '--exclude-per-directory=.gitignore', '--exclude-per-directory=.gitignore', '-h'],
      ]) {
        const probe = await this.runner.probe(context, ['read-tree', ...tail], {
          ...(opts?.env ? { env: opts.env } : {}),
          ...(opts?.signal ? { signal: opts.signal } : {}),
        });
        if (probe.aborted) {
          return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
        }
        observations.push(probe);
      }
      const usage = (r: { exitCode: number; stdout: string; stderr: string }) =>
        [0, 129].includes(r.exitCode) &&
        (r.stdout + r.stderr).startsWith('usage:') &&
        !/^(?:error|fatal):/m.test(r.stderr);
      const [first, value, repeated] = observations;
      if (
        first &&
        value &&
        repeated &&
        usage(first) &&
        usage(value) &&
        repeated.exitCode === 128 &&
        /^fatal: more than one --exclude-per-directory given\./m.test(repeated.stderr)
      ) {
        readTreeExclude = 'legacy';
      } else if (
        first &&
        value &&
        repeated &&
        first.exitCode === 128 &&
        /^fatal: --exclude-per-directory is meaningless unless -u/m.test(first.stderr) &&
        value.exitCode === 128 &&
        /^fatal: --exclude-per-directory argument must be \.gitignore/m.test(value.stderr) &&
        usage(repeated)
      ) {
        readTreeExclude = 'modern';
      } else {
        return await execute(original);
      }
    }
    let repackMaxPackSize: 'immediate' | 'deferred' | undefined;
    if (commandUsesRepackMaxPackSize(command, traitArgs)) {
      const original = commandExecutableShapeArguments(command, args, inRepository);
      const probe = await this.runner.probe(
        context,
        ['repack', '--max-pack-size=type-git-profile-invalid', '-h'],
        {
          ...(opts?.env ? { env: opts.env } : {}),
          ...(opts?.signal ? { signal: opts.signal } : {}),
        },
      );
      if (probe.aborted) {
        return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
      }
      if (
        [0, 129].includes(probe.exitCode) &&
        (probe.stdout + probe.stderr).startsWith('usage:') &&
        !/^(?:error|fatal):/m.test(probe.stderr)
      ) {
        repackMaxPackSize = 'deferred';
      } else if (
        probe.exitCode === 129 &&
        /^error: option [`']max-pack-size['`] expects .*integer/m.test(probe.stderr)
      ) {
        repackMaxPackSize = 'immediate';
      } else {
        return await execute(original);
      }
    }
    let firstPassEmpty: boolean | undefined;
    if (commandUsesFirstPassEmpty(command, traitArgs)) {
      const probeOptions = {
        ...(opts?.env ? { env: opts.env } : {}),
        ...(opts?.signal ? { signal: opts.signal } : {}),
      };
      const probe = await this.runner.probe(
        context,
        ['cherry-pick', '--empty=type-git-invalid', '-h'],
        probeOptions,
      );
      if (probe.aborted) {
        return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
      }
      if ([0, 129].includes(probe.exitCode) && (probe.stderr + probe.stdout).startsWith('usage:')) {
        firstPassEmpty = false;
      } else if (
        [128, 129].includes(probe.exitCode) &&
        /^error: invalid value for '--empty': 'type-git-invalid'\r?$/m.test(probe.stderr)
      ) {
        firstPassEmpty = true;
      } else {
        return await execute(commandExecutableShapeArguments(command, args, inRepository));
      }
    }
    let abi: NativeAbi | undefined =
      lsTreeModes === undefined &&
      readTreeExclude === undefined &&
      repackMaxPackSize === undefined &&
      firstPassEmpty === undefined &&
      depthAtoiBits === undefined &&
      submoduleInitAlias === undefined &&
      emptyPickaxeRejected === undefined
        ? undefined
        : {
            longBits: nativeCLongBits(process.platform, process.arch),
            sizeTBits: nativeSizeTBits(process.arch),
            firstPassEmpty,
            repackMaxPackSize,
            readTreeExclude,
            lsTreeModes,
            depthAtoiBits,
            submoduleInitAlias,
            emptyPickaxeRejected,
          };
    if (commandUsesNativeABI(command, traitArgs, firstPassEmpty)) {
      const profiles: GitIntegerProfile[] = commandUsesIntegerProfile(
        command,
        traitArgs,
        firstPassEmpty,
      )
        ? ['bounded', 'decimal-cast']
        : ['bounded'];
      const signs = commandUsesNegativeMagnitude(command, traitArgs, firstPassEmpty)
        ? [false, true]
        : [false];
      const conflictStyles: ('immediate' | 'deferred')[] = commandUsesConflictStyle(
        command,
        traitArgs,
        firstPassEmpty,
      )
        ? ['immediate', 'deferred']
        : ['immediate'];
      const booleanSources: GitBooleanSource[] = commandUsesBooleanSource(
        command,
        traitArgs,
        firstPassEmpty,
      )
        ? ['modern', 'symmetric', 'legacy-units']
        : ['modern'];
      const booleanBinaries = commandUsesBooleanBinary(command, traitArgs, firstPassEmpty)
        ? [true, false]
        : [true];
      const compoundOverflows = commandUsesCompoundDecimal(command, traitArgs, firstPassEmpty)
        ? [false, true]
        : [false];
      const booleanFeatures = commandBooleanFeatures(command, traitArgs, firstPassEmpty);
      let capabilityVariants: GitBooleanCapabilities[] = [{}];
      for (const feature of booleanFeatures) {
        capabilityVariants = capabilityVariants.flatMap((variant) => [
          { ...variant, [feature]: true },
          { ...variant, [feature]: false },
        ]);
      }
      const callbacks = commandDecimalCallbacks(command, traitArgs, firstPassEmpty);
      const chars = commandUsesObjectFilterCharProfile(command, traitArgs, firstPassEmpty)
        ? [false, true]
        : [true];
      let callbackVariants: GitDecimalCallbacks[] = [{}];
      for (const callback of callbacks) {
        callbackVariants = callbackVariants.flatMap((variant) => [
          { ...variant, [callback]: 'modern' },
          { ...variant, [callback]: 'legacy' },
        ]);
      }
      let valid: { profile: GitIntegerProfile; abi: NativeAbi; argv: string[] }[] = [];
      let firstError: GitArgumentError | undefined;
      for (const integerProfile of profiles) {
        for (const negativeMagnitudes of signs) {
          for (const unsignedChar of chars) {
            for (const conflictStyle of conflictStyles) {
              for (const booleanSource of booleanSources) {
                for (const booleanBinaryIntegers of booleanBinaries) {
                  for (const booleanCapabilities of capabilityVariants) {
                    for (const compoundNegatedOverflow of compoundOverflows) {
                      for (const decimalCallbacks of callbackVariants) {
                        for (const longBits of [32, 64] as const) {
                          for (const sizeTBits of [32, 64] as const) {
                            const candidateAbi = {
                              longBits,
                              sizeTBits,
                              integerProfile,
                              negativeMagnitudes,
                              decimalCallbacks,
                              unsignedChar,
                              conflictStyle,
                              repackMaxPackSize,
                              readTreeExclude,
                              lsTreeModes,
                              booleanSource,
                              booleanBinaryIntegers,
                              booleanCapabilities,
                              compoundNegatedOverflow,
                              firstPassEmpty,
                              depthAtoiBits,
                              submoduleInitAlias,
                              emptyPickaxeRejected,
                            };
                            try {
                              valid.push({
                                profile: integerProfile,
                                abi: candidateAbi,
                                argv: build(command, args, inRepository, candidateAbi),
                              });
                            } catch (error) {
                              if (!(error instanceof GitArgumentError)) {
                                throw error;
                              }
                              firstError ??= error;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (valid.length === 0) {
        throw firstError;
      }
      const needsBinaryProfile = commandUsesObjectFilterBinary(command, traitArgs, firstPassEmpty);
      const needsEmptyProfile = commandUsesObjectFilterEmptyComponent(
        command,
        traitArgs,
        firstPassEmpty,
      );
      if (
        (valid.length ===
          profiles.length *
            signs.length *
            callbackVariants.length *
            chars.length *
            conflictStyles.length *
            booleanSources.length *
            booleanBinaries.length *
            capabilityVariants.length *
            compoundOverflows.length *
            4 &&
          !needsBinaryProfile &&
          !needsEmptyProfile) ||
        (binary && !this.runner.exec.spawnBytes)
      ) {
        return await execute(valid[0]!.argv);
      }
      const probeOptions = {
        ...(opts?.env ? { env: opts.env } : {}),
        ...(opts?.signal ? { signal: opts.signal } : {}),
      };
      if (compoundOverflows.length > 1) {
        const groups = new Map<string, Set<boolean | undefined>>();
        for (const entry of valid) {
          const { compoundNegatedOverflow, ...other } = entry.abi;
          const key = JSON.stringify(other);
          if (!groups.has(key)) {
            groups.set(key, new Set());
          }
          groups.get(key)!.add(compoundNegatedOverflow);
        }
        if ([...groups.values()].some((group) => group.size !== 2)) {
          // A negative magnitude beyond either ULONG_MAX distinguishes saturation from negation.
          const probe = await this.runner.probe(
            context,
            ['shortlog', '-w2,-18446744073709551616,0', '-h'],
            probeOptions,
          );
          if (probe.aborted) {
            return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
          }
          let compoundNegatedOverflow: boolean;
          if (
            [0, 129].includes(probe.exitCode) &&
            (probe.stderr + probe.stdout).startsWith('usage:')
          ) {
            compoundNegatedOverflow = true;
          } else if (probe.exitCode === 129 && /^error: -w\[/m.test(probe.stderr)) {
            compoundNegatedOverflow = false;
          } else {
            return await execute(valid[0]!.argv);
          }
          const selected = valid.filter(
            (entry) => entry.abi.compoundNegatedOverflow === compoundNegatedOverflow,
          );
          if (selected.length === 0) {
            build(command, args, inRepository, {
              ...valid[0]!.abi,
              compoundNegatedOverflow,
            });
            throw firstError;
          }
          valid = selected;
        }
      }
      if (conflictStyles.length > 1) {
        const groups = new Map<string, Set<string>>();
        for (const entry of valid) {
          const { conflictStyle, ...other } = entry.abi;
          const key = JSON.stringify(other);
          if (!groups.has(key)) {
            groups.set(key, new Set());
          }
          groups.get(key)!.add(conflictStyle!);
        }
        if ([...groups.values()].some((group) => group.size !== 2)) {
          const probe = await this.runner.probe(
            context,
            [command, '--conflict=bad', '-h'],
            probeOptions,
          );
          if (probe.aborted) {
            return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
          }
          let conflictStyle: 'immediate' | 'deferred';
          if (
            probe.exitCode === 129 &&
            /^error: unknown conflict style 'bad'/m.test(probe.stderr)
          ) {
            conflictStyle = 'immediate';
          } else if (
            (probe.exitCode === 0 || probe.exitCode === 129) &&
            (probe.stderr + probe.stdout).startsWith('usage:')
          ) {
            conflictStyle = 'deferred';
          } else {
            return await execute(valid[0]!.argv);
          }
          const selected = valid.filter((entry) => entry.abi.conflictStyle === conflictStyle);
          if (selected.length === 0) {
            build(command, args, inRepository, { ...valid[0]!.abi, conflictStyle });
            throw firstError;
          }
          valid = selected;
        }
      }
      for (const feature of booleanFeatures) {
        const groups = new Map<string, Set<boolean | undefined>>();
        for (const entry of valid) {
          const { booleanCapabilities, ...other } = entry.abi;
          const remainingCapabilities = { ...booleanCapabilities };
          delete remainingCapabilities[feature];
          const key = JSON.stringify({ ...other, booleanCapabilities: remainingCapabilities });
          if (!groups.has(key)) {
            groups.set(key, new Set());
          }
          groups.get(key)!.add(booleanCapabilities?.[feature]);
        }
        if (![...groups.values()].some((group) => group.size !== 2)) {
          continue;
        }
        const argv =
          feature === 'preserve'
            ? ['pull', '--rebase=preserve', '-h']
            : ['push', '--recurse-submodules=only-is-on-demand', '-h'];
        const probe = await this.runner.probe(context, argv, probeOptions);
        if (probe.aborted) {
          return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
        }
        const diagnostic = probe.stderr + probe.stdout;
        let supported: boolean;
        if ((probe.exitCode === 0 || probe.exitCode === 129) && diagnostic.startsWith('usage:')) {
          supported = true;
        } else if (
          feature === 'preserve' &&
          probe.exitCode === 129 &&
          /preserve.*(?:superseded|invalid|removed)|(?:Invalid|invalid) value.*(?:rebase|preserve)/.test(
            diagnostic,
          )
        ) {
          supported = false;
        } else if (
          feature === 'onlyIsOnDemand' &&
          probe.exitCode === 128 &&
          /bad recurse-submodules argument: only-is-on-demand/.test(diagnostic)
        ) {
          supported = false;
        } else {
          return await execute(valid[0]!.argv);
        }
        const selected = valid.filter(
          (entry) => entry.abi.booleanCapabilities?.[feature] === supported,
        );
        if (selected.length === 0) {
          build(command, args, inRepository, {
            ...valid[0]!.abi,
            booleanCapabilities: { ...valid[0]!.abi.booleanCapabilities, [feature]: supported },
          });
          throw firstError;
        }
        valid = selected;
      }
      const booleanDependent = (
        key: 'booleanSource' | 'booleanBinaryIntegers',
        variants: number,
      ) => {
        const groups = new Map<string, Set<unknown>>();
        for (const entry of valid) {
          const other = { ...entry.abi };
          delete other[key];
          const id = JSON.stringify(other);
          if (!groups.has(id)) {
            groups.set(id, new Set());
          }
          groups.get(id)!.add(entry.abi[key]);
        }
        return [...groups.values()].some((group) => group.size !== variants);
      };
      if (booleanSources.length > 1 && booleanDependent('booleanSource', booleanSources.length)) {
        const observe = (value: string) =>
          this.runner.probe(
            context,
            [
              '-c',
              `typegitprofile.boolean=${value}`,
              'config',
              '--type=bool',
              '--get',
              'typegitprofile.boolean',
            ],
            probeOptions,
          );
        const units = await observe('m');
        if (units.aborted) {
          return { ...units, stdout: binary ? new Uint8Array(0) : units.stdout };
        }
        let booleanSource: GitBooleanSource;
        if (units.exitCode === 0 && units.stdout.trim() === 'false') {
          booleanSource = 'legacy-units';
        } else if (
          units.exitCode === 128 &&
          /bad (?:boolean|numeric) config value/.test(units.stderr)
        ) {
          const minimum = await observe('-2147483648');
          if (minimum.aborted) {
            return { ...minimum, stdout: binary ? new Uint8Array(0) : minimum.stdout };
          }
          if (minimum.exitCode === 0 && minimum.stdout.trim() === 'true') {
            booleanSource = 'modern';
          } else if (
            minimum.exitCode === 128 &&
            /bad (?:boolean|numeric) config value/.test(minimum.stderr)
          ) {
            booleanSource = 'symmetric';
          } else {
            return await execute(valid[0]!.argv);
          }
        } else {
          return await execute(valid[0]!.argv);
        }
        const selected = valid.filter((entry) => entry.abi.booleanSource === booleanSource);
        if (selected.length === 0) {
          build(command, args, inRepository, { ...valid[0]!.abi, booleanSource });
          throw firstError;
        }
        valid = selected;
      }
      if (
        booleanBinaries.length > 1 &&
        booleanDependent('booleanBinaryIntegers', booleanBinaries.length)
      ) {
        const probe = await this.runner.probe(
          context,
          [
            '-c',
            'typegitprofile.boolean=0b1',
            'config',
            '--type=bool',
            '--get',
            'typegitprofile.boolean',
          ],
          probeOptions,
        );
        if (probe.aborted) {
          return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
        }
        let booleanBinaryIntegers: boolean;
        if (probe.exitCode === 0 && probe.stdout.trim() === 'true') {
          booleanBinaryIntegers = true;
        } else if (
          probe.exitCode === 128 &&
          /bad (?:boolean|numeric) config value/.test(probe.stderr)
        ) {
          booleanBinaryIntegers = false;
        } else {
          return await execute(valid[0]!.argv);
        }
        const selected = valid.filter(
          (entry) => entry.abi.booleanBinaryIntegers === booleanBinaryIntegers,
        );
        if (selected.length === 0) {
          build(command, args, inRepository, {
            ...valid[0]!.abi,
            booleanBinaryIntegers,
          });
          throw firstError;
        }
        valid = selected;
      }
      let unsignedChar = true;
      if (chars.length > 1) {
        const groups = new Map<string, Set<boolean>>();
        for (const entry of valid) {
          const { unsignedChar: char, ...other } = entry.abi;
          const key = JSON.stringify(other);
          if (!groups.has(key)) {
            groups.set(key, new Set());
          }
          groups.get(key)!.add(char!);
        }
        if ([...groups.values()].some((group) => group.size !== 2)) {
          const probe = await this.runner.probe(
            context,
            [...OBJECT_FILTER_CHAR_PROBE],
            probeOptions,
          );
          if (probe.aborted) {
            return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
          }
          const observed = objectFilterUnsignedChar(probe);
          if (observed === undefined) {
            return await execute(valid[0]!.argv);
          }
          unsignedChar = observed;
        }
      }
      const charValid = valid.filter((entry) => entry.abi.unsignedChar === unsignedChar);
      if (charValid.length === 0) {
        build(command, args, inRepository, {
          longBits: 64,
          sizeTBits: 64,
          unsignedChar,
        });
        throw firstError;
      }
      const selectedCallbacks: GitDecimalCallbacks = {};
      for (const callback of callbacks) {
        const groups = new Map<string, Set<string>>();
        for (const entry of charValid) {
          const otherCallbacks = { ...entry.abi.decimalCallbacks };
          const family = otherCallbacks[callback]!;
          delete otherCallbacks[callback];
          const key = JSON.stringify({ ...entry.abi, decimalCallbacks: otherCallbacks });
          if (!groups.has(key)) {
            groups.set(key, new Set());
          }
          groups.get(key)!.add(family);
        }
        if ([...groups.values()].every((families) => families.size === 2)) {
          selectedCallbacks[callback] = 'modern';
          continue;
        }
        const probe = await this.runner.probe(
          context,
          [...DECIMAL_CALLBACK_PROBES[callback]],
          probeOptions,
        );
        if (probe.aborted) {
          return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
        }
        const family = decimalCallbackFamily(callback, probe);
        if (!family) {
          return await execute(charValid[0]!.argv);
        }
        selectedCallbacks[callback] = family;
      }
      const callbackValid = charValid.filter((entry) =>
        callbacks.every(
          (callback) => entry.abi.decimalCallbacks?.[callback] === selectedCallbacks[callback],
        ),
      );
      if (callbackValid.length === 0) {
        build(command, args, inRepository, {
          longBits: 64,
          sizeTBits: 64,
          decimalCallbacks: selectedCallbacks,
          unsignedChar,
        });
        throw firstError;
      }
      let selected: GitIntegerProfile = 'bounded';
      const familyDependent =
        profiles.length > 1 &&
        signs.some((candidateSign) =>
          [32, 64].some((longBits) =>
            [32, 64].some(
              (sizeTBits) =>
                callbackValid.some(
                  (e) =>
                    e.profile === 'bounded' &&
                    e.abi.negativeMagnitudes === candidateSign &&
                    e.abi.longBits === longBits &&
                    e.abi.sizeTBits === sizeTBits,
                ) !==
                callbackValid.some(
                  (e) =>
                    e.profile === 'decimal-cast' &&
                    e.abi.negativeMagnitudes === candidateSign &&
                    e.abi.longBits === longBits &&
                    e.abi.sizeTBits === sizeTBits,
                ),
            ),
          ),
        );
      if (familyDependent) {
        // Both branches read help only: no input, repository mutation or network.
        const family = await this.runner.probe(
          context,
          ['column', '--width=2147483648', '-h'],
          probeOptions,
        );
        if (family.aborted) {
          return { ...family, stdout: binary ? new Uint8Array(0) : family.stdout };
        }
        const usage = (family.stdout + family.stderr).includes('usage:');
        if (family.exitCode === 129 && /not in range/.test(family.stderr)) {
          selected = 'bounded';
        } else if (
          (family.exitCode === 0 || family.exitCode === 129) &&
          usage &&
          !/error:|fatal:/.test(family.stderr)
        ) {
          selected = 'decimal-cast';
        } else {
          return await execute(callbackValid[0]!.argv);
        }
      }
      let negativeMagnitudes = false;
      const signDependent =
        signs.length > 1 &&
        [32, 64].some((longBits) =>
          [32, 64].some(
            (sizeTBits) =>
              callbackValid.some(
                (e) =>
                  e.profile === selected &&
                  e.abi.negativeMagnitudes === false &&
                  e.abi.longBits === longBits &&
                  e.abi.sizeTBits === sizeTBits,
              ) !==
              callbackValid.some(
                (e) =>
                  e.profile === selected &&
                  e.abi.negativeMagnitudes === true &&
                  e.abi.longBits === longBits &&
                  e.abi.sizeTBits === sizeTBits,
              ),
          ),
        );
      if (signDependent) {
        const sign = await this.runner.runRepositoryProbe(
          context,
          ['pack-objects', '--max-pack-size=-0', '-h'],
          probeOptions,
        );
        if (sign.aborted) {
          return { ...sign, stdout: binary ? new Uint8Array(0) : sign.stdout };
        }
        const diagnostic = sign.stdout + sign.stderr;
        if (sign.exitCode === 129 && /expects .*non-negative|not in range/.test(sign.stderr)) {
          negativeMagnitudes = false;
        } else if (
          sign.exitCode === 129 &&
          diagnostic.includes('usage:') &&
          !/error:|fatal:/.test(sign.stderr)
        ) {
          negativeMagnitudes = true;
        } else {
          return await execute(callbackValid[0]!.argv);
        }
      }
      const selectedValid = callbackValid.filter(
        (entry) =>
          entry.profile === selected &&
          entry.abi.negativeMagnitudes === negativeMagnitudes &&
          callbacks.every(
            (callback) => entry.abi.decimalCallbacks?.[callback] === selectedCallbacks[callback],
          ),
      );
      if (selectedValid.length === 0) {
        build(command, args, inRepository, {
          longBits: 64,
          sizeTBits: 64,
          integerProfile: selected,
          negativeMagnitudes,
          decimalCallbacks: selectedCallbacks,
          unsignedChar,
        });
        throw firstError;
      }
      abi = selectedValid[0]!.abi;
      if (
        new Set(selectedValid.map((entry) => `${entry.abi.longBits}:${entry.abi.sizeTBits}`))
          .size !== 4
      ) {
        const probe = await this.runner.probe(
          context,
          ['version', '--build-options'],
          probeOptions,
        );
        if (probe.aborted) {
          return { ...probe, stdout: binary ? new Uint8Array(0) : probe.stdout };
        }
        const longBytes = /^sizeof-long: ([48])\r?$/m.exec(probe.stdout)?.[1];
        const sizeBytes = /^sizeof-size_t: ([48])\r?$/m.exec(probe.stdout)?.[1];
        if (probe.exitCode !== 0 || !(longBytes && sizeBytes)) {
          if (
            commandUsesDecimalCallback(command, traitArgs, firstPassEmpty) ||
            commandUsesCompoundDecimal(command, traitArgs, firstPassEmpty)
          ) {
            return await execute(selectedValid[0]!.argv);
          }
          throw new GitArgumentError(
            'Cannot determine integer widths of the selected Git executable',
          );
        }
        abi = {
          ...abi,
          longBits: longBytes === '4' ? 32 : 64,
          sizeTBits: sizeBytes === '4' ? 32 : 64,
          integerProfile: selected,
          negativeMagnitudes,
          decimalCallbacks: selectedCallbacks,
          unsignedChar,
        };
      }
      if (needsBinaryProfile) {
        // Clone's callback runs before -h. No URL is supplied or contacted.
        const profile = await this.runner.probe(
          context,
          ['clone', '--filter=blob:limit=0b1', '-h'],
          {
            ...(opts?.env ? { env: opts.env } : {}),
            ...(opts?.signal ? { signal: opts.signal } : {}),
          },
        );
        if (profile.aborted) {
          return { ...profile, stdout: binary ? new Uint8Array(0) : profile.stdout };
        }
        const diagnostic = profile.stdout + profile.stderr;
        const supported = profile.exitCode === 129 && diagnostic.includes('usage:');
        const unsupported = profile.exitCode === 128 && diagnostic.includes('invalid filter-spec');
        if (!(supported || unsupported)) {
          // Unrecognized/localized frontends keep their own native validation.
          return await execute(build(command, args, inRepository, abi));
        }
        abi = { ...(abi ?? { longBits: 32, sizeTBits: 32 }), binaryIntegers: supported };
      }
      if (needsEmptyProfile) {
        // Clone's callback runs before -h. No URL is supplied or contacted.
        const profile = await this.runner.probe(
          context,
          [...OBJECT_FILTER_EMPTY_PROBE],
          probeOptions,
        );
        if (profile.aborted) {
          return { ...profile, stdout: binary ? new Uint8Array(0) : profile.stdout };
        }
        const observed = objectFilterCombineEmptyComponents(profile);
        if (observed === undefined) {
          // Unrecognized/localized frontends keep their own native validation.
          return await execute(build(command, args, inRepository, abi));
        }
        abi = { ...(abi ?? { longBits: 32, sizeTBits: 32 }), combineEmptyComponents: observed };
      }
    }
    return await execute(build(command, args, inRepository, abi));
  }
}

const runners: WeakMap<CliRunner, StrictCommandRunner> = new WeakMap<
  CliRunner,
  StrictCommandRunner
>();

/** The grammar-checked runner bound to a CliRunner, created once per runner. */
export function strictCommandRunner(runner: CliRunner): StrictCommandRunner {
  let strict = runners.get(runner);
  if (strict === undefined) {
    strict = new StrictCommandRunner(runner);
    runners.set(runner, strict);
  }
  return strict;
}

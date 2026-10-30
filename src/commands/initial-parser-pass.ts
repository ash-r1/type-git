import { GitArgumentError } from '../core/types.js';
import type { CommandSpec } from './spec.js';

/** Result of one native option pass; literal provenance is reported only when requested. */
type InitialParserPassResult = {
  exited: boolean;
  tokens: readonly (readonly string[])[];
  remaining: readonly string[];
  delegated?: true;
  subcommand?: string;
  /** Provenance of `remaining`, aligned by index, when `literal` was supplied. */
  remainingLiteral?: readonly boolean[];
  /** This pass consumed a literal word as an option or boundary and did not exit. */
  literalOption?: true;
  /** This pass retained a literal word as an unknown option for a later parser. */
  literalUnknown?: true;
};

/**
 * Execute the source-recorded option pass over serialized words.
 * `literal` marks words supplied as operand objects. When this pass consumes one as an option
 * or boundary without a native exit, the result carries `literalOption`; one retained as an
 * unknown option sets `literalUnknown`, leaving the decision to the retained-word consumer.
 */
export function initialParserPass(
  spec: CommandSpec,
  argv: readonly string[],
  emptyRegistered = true,
  exit: NonNullable<CommandSpec['parserExit']> = spec.parserExit!,
  onToken?: (token: readonly string[]) => boolean,
  literal?: readonly boolean[],
): InitialParserPassResult {
  const recognized = new Set(
    exit.firstPassOptions?.filter(
      (flag) => !exit.flags.includes(flag) && (emptyRegistered || flag !== '--empty'),
    ),
  );
  const longNames = exit.firstPassLongNames?.filter((name) => emptyRegistered || name !== 'empty');
  const tokens: string[][] = [];
  const remaining: string[] = [];
  let flags: readonly boolean[] = literal ?? [];
  const remainingFlags: boolean[] = [];
  let literalOption = false;
  let literalUnknown = false;
  /** Attach provenance only for callers that track operand objects. */
  const result = (
    value: Omit<InitialParserPassResult, 'remainingLiteral' | 'literalOption' | 'literalUnknown'>,
    retained: readonly boolean[] = remainingFlags,
  ): InitialParserPassResult => ({
    ...value,
    ...(literal ? { remainingLiteral: retained } : {}),
    ...(literalOption && !value.exited ? { literalOption: true as const } : {}),
    ...(literalUnknown && !value.exited ? { literalUnknown: true as const } : {}),
  });
  /** Provenance of the words from `start`. */
  const flagsFrom = (start: number) =>
    argv.slice(start).map((_, offset) => flags[start + offset] === true);
  /** Retain the words from `start` with their provenance. */
  const retainFrom = (start: number) => {
    remaining.push(...argv.slice(start));
    remainingFlags.push(...flagsFrom(start));
  };
  // Git's top-level dispatcher owns this position, before the command parser runs.
  if (exit.exceptFirst?.includes(argv[0] ?? '')) {
    return result({ exited: false, tokens, remaining: argv, delegated: true }, flagsFrom(0));
  }
  for (const wrapper of exit.wrappers ?? []) {
    const pass = initialParserPass(
      spec,
      argv,
      emptyRegistered,
      {
        ...wrapper,
        flags: exit.flags,
        singleWordExits: exit.singleWordExits,
        firstPassOptions: [],
        firstPassLongNames: wrapper.firstPassLongNames ?? [],
      },
      undefined,
      literal ? flags : undefined,
    );
    if (pass.exited) {
      return pass;
    }
    literalOption ||= pass.literalOption === true;
    literalUnknown ||= pass.literalUnknown === true;
    argv = pass.remaining;
    flags = pass.remainingLiteral ?? [];
  }
  /** Select native internal help after excluding dispatcher-only spellings. */
  const help = () => {
    const flag = exit.flags.find((candidate) => !exit.exceptFirst?.includes(candidate));
    if (!flag) {
      throw new Error('Native parser metadata requires an internal help spelling');
    }
    return result({ exited: true, tokens: [...tokens, [flag]], remaining });
  };
  if (argv.length === 1 && exit.singleWordExits?.includes(argv[0]!)) {
    return help();
  }
  /** Reject a single-dash long spelling after the native short-option lookup. */
  const typo = (word: string) => {
    if (
      word.length >= 3 &&
      (word.startsWith('no-') || longNames?.some((name) => name.startsWith(word)))
    ) {
      throw new GitArgumentError(`-${word}: Git requires two dashes for this option`);
    }
  };
  let index = 0;
  while (index < argv.length) {
    const word = argv[index++]!;
    // An operand object must not become an option or boundary marker.
    const literalWord = flags[index - 1] === true && word.startsWith('-') && word !== '-';
    if (word === '--' || word === '--end-of-options') {
      literalOption ||= literalWord;
      if (exit.mandatorySubcommand) {
        throw new GitArgumentError('Git requires a subcommand before the option boundary');
      }
      if (word === '--end-of-options' ? exit.keepEndOfOptions !== false : exit.keepDashDash) {
        remaining.push(word);
        remainingFlags.push(flags[index - 1] === true);
      }
      retainFrom(index);
      break;
    }
    if (word === '--help' || word === '--help-all') {
      return help();
    }
    if (!word.startsWith('-') || word === '-') {
      if (exit.mandatorySubcommand) {
        if (!(spec.dispatch && Object.hasOwn(spec.dispatch, word))) {
          throw new GitArgumentError(`Unknown Git subcommand: ${word}`);
        }
        return result(
          { exited: false, tokens, remaining: argv.slice(index), subcommand: word },
          flagsFrom(index),
        );
      }
      remaining.push(word);
      remainingFlags.push(flags[index - 1] === true);
      if (exit.stopAtUnknown || exit.stopAtOperand) {
        retainFrom(index);
        break;
      }
      continue;
    }
    if (word.startsWith('--')) {
      const equal = word.indexOf('=');
      const incoming = equal < 0 ? word : word.slice(0, equal);
      const forms = equal < 0 ? exit.longForms?.plain : exit.longForms?.attached;
      const flag = forms
        ? Object.hasOwn(forms, incoming)
          ? forms[incoming]
          : undefined
        : incoming;
      if (flag === null) {
        throw new GitArgumentError(`${incoming}: ambiguous option`);
      }
      if (!(flag && recognized.has(flag))) {
        if (exit.unknownOptions === 'error') {
          throw new GitArgumentError(`${incoming}: unknown option`);
        }
        remaining.push(word);
        remainingFlags.push(literalWord);
        literalUnknown ||= literalWord;
        if (exit.stopAtUnknown) {
          retainFrom(index);
          break;
        }
        continue;
      }
      literalOption ||= literalWord;
      const option = spec.options[flag]!;
      if (option.value === 'flag') {
        if (equal >= 0) {
          throw new GitArgumentError(`${flag}: this flag takes no value`);
        }
        tokens.push([flag]);
        if (onToken?.(tokens[tokens.length - 1]!)) {
          return result({ exited: false, tokens, remaining: [] }, []);
        }
      } else if (equal >= 0) {
        tokens.push([flag, word.slice(equal + 1)]);
        if (onToken?.(tokens[tokens.length - 1]!)) {
          return result({ exited: false, tokens, remaining: [] }, []);
        }
      } else if (
        option.value.startsWith('optional-') &&
        (!option.lastArgDefault || index >= argv.length)
      ) {
        tokens.push([flag]);
        if (onToken?.(tokens[tokens.length - 1]!)) {
          return result({ exited: false, tokens, remaining: [] }, []);
        }
      } else {
        const value = argv[index++];
        if (value === undefined) {
          throw new GitArgumentError(`${flag}: missing option value`);
        }
        tokens.push([flag, value]);
        if (onToken?.(tokens[tokens.length - 1]!)) {
          return result({ exited: false, tokens, remaining: [] }, []);
        }
      }
      continue;
    }
    let cluster = word.slice(1);
    let first = true;
    while (cluster) {
      const flag = `-${cluster[0]}`;
      const option = recognized.has(flag) ? spec.options[flag] : undefined;
      // Internal -h is checked when the short-option lookup fails.
      if (!option) {
        if (first) {
          typo(word.slice(1));
        }
        if (flag === '-h') {
          return help();
        }
        if (exit.unknownOptions === 'error') {
          throw new GitArgumentError(`${flag}: unknown option`);
        }
        remaining.push(`-${cluster}`);
        remainingFlags.push(literalWord);
        literalUnknown ||= literalWord;
        if (exit.stopAtUnknown) {
          retainFrom(index);
          return result({ exited: false, tokens, remaining });
        }
        break;
      }
      literalOption ||= literalWord;
      cluster = cluster.slice(1);
      if (option.value === 'flag') {
        tokens.push([flag]);
        if (onToken?.(tokens[tokens.length - 1]!)) {
          return result({ exited: false, tokens, remaining: [] }, []);
        }
      } else {
        if (cluster) {
          tokens.push([flag, cluster]);
          if (onToken?.(tokens[tokens.length - 1]!)) {
            return result({ exited: false, tokens, remaining: [] }, []);
          }
        } else if (
          option.value.startsWith('optional-') &&
          (!option.lastArgDefault || index >= argv.length)
        ) {
          tokens.push([flag]);
          if (onToken?.(tokens[tokens.length - 1]!)) {
            return result({ exited: false, tokens, remaining: [] }, []);
          }
        } else {
          const value = argv[index++];
          if (value === undefined) {
            throw new GitArgumentError(`${flag}: missing option value`);
          }
          tokens.push([flag, value]);
          if (onToken?.(tokens[tokens.length - 1]!)) {
            return result({ exited: false, tokens, remaining: [] }, []);
          }
        }
        cluster = '';
      }
      if (first && cluster) {
        typo(word.slice(1));
      }
      first = false;
    }
  }
  if (exit.mandatorySubcommand) {
    throw new GitArgumentError('Git requires a subcommand');
  }
  const postParseExit = exit.postParseBooleanExit;
  if (postParseExit) {
    let active = spec.initial?.[postParseExit.key] === true;
    for (const token of tokens) {
      const option = spec.options[token[0]!];
      if (option?.key !== postParseExit.key) {
        continue;
      }
      if (option.clear) {
        active = false;
      } else if (option.toggle) {
        active = !active;
      } else {
        active = option.set === undefined ? true : option.set === true;
      }
    }
    if (active === postParseExit.value) {
      // Use the existing internal exit marker for validation; emitted argv is unchanged.
      return help();
    }
  }
  return result({ exited: false, tokens, remaining });
}

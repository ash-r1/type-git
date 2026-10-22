import { GitArgumentError } from '../core/types.js';
import type { CommandSpec, OptionSpec } from './spec.js';

/** Preserve each stream's order when a native command partitions retained argv. */
export function partitionRemainingArguments(
  spec: CommandSpec,
  argv: readonly string[],
): { words: readonly string[]; state: Readonly<Record<string, readonly string[]>> } {
  const partition = spec.parserExit?.remainingPartition;
  if (!partition) {
    return { words: argv, state: {} };
  }
  const words: string[] = [];
  const operands: string[] = [];
  for (const word of argv) {
    (word.startsWith(partition.optionPrefix) ? words : operands).push(word);
  }
  return { words, state: { [partition.operandKey]: operands } };
}

type Token = readonly string[] | { operand: string };
/** Decode the retained stream in setup_revisions order, before applying callbacks. */
export function revisionParserPass(
  spec: CommandSpec,
  argv: readonly string[],
): { tokens: Token[]; exited?: true } {
  const phase = spec.parserExit!;
  if (argv[0] === '-' && phase.leadingDashReplacement) {
    argv = [phase.leadingDashReplacement, ...argv.slice(1)];
  }
  const options = phase.remainingOptions!;
  const boundary = phase.splitRemainingPaths ? argv.indexOf('--') : -1;
  const words = boundary < 0 ? argv : argv.slice(0, boundary);
  const tokens: Token[] = [];
  let unknown: string | undefined;
  /** Resolve only registered own keys in the retained parser table. */
  const lookup = (flag: string): OptionSpec | undefined =>
    Object.hasOwn(options, flag) ? options[flag] : undefined;
  /** Reject native single-dash long-option typos before deferred usage checks. */
  const typo = (word: string): void => {
    if (
      word.length >= 3 &&
      (word.startsWith('no-') || phase.remainingLongNames?.some((name) => name.startsWith(word)))
    ) {
      throw new GitArgumentError(`-${word}: Git requires two dashes for this option`);
    }
  };
  let index = 0;
  let ended = false;
  while (index < words.length) {
    const word = words[index++]!;
    if (ended || !word.startsWith('-')) {
      tokens.push({ operand: word });
      continue;
    }
    if (word === '--end-of-options') {
      tokens.push([word]);
      ended = true;
      continue;
    }
    if (index === words.length && phase.remainingSingleWordExits?.includes(word)) {
      return { tokens, exited: true };
    }
    const equal = word.indexOf('=');
    const incoming = word.startsWith('--') && equal >= 0 ? word.slice(0, equal) : word;
    let flag = incoming;
    const direct = lookup(incoming);
    if (
      word.startsWith('--') &&
      phase.remainingLongForms &&
      (!direct || (equal >= 0 && (direct.value === 'flag' || direct.separateValue)))
    ) {
      const forms = equal < 0 ? phase.remainingLongForms.plain : phase.remainingLongForms.attached;
      const canonical = Object.hasOwn(forms, incoming) ? forms[incoming] : undefined;
      if (canonical === null) {
        throw new GitArgumentError(`${incoming}: ambiguous diff option`);
      }
      flag = canonical ?? '';
    }
    const option = lookup(flag);
    if (option) {
      if (word.startsWith('--') && equal >= 0) {
        if (option.value === 'flag' || option.separateValue) {
          throw new GitArgumentError(`${flag}: unexpected attached value`);
        }
        tokens.push([flag, word.slice(equal + 1)]);
      } else if (option.value === 'flag' || option.value.startsWith('optional-')) {
        tokens.push([flag]);
      } else {
        if (flag.startsWith('--') && !phase.remainingDetachedOptions?.includes(flag)) {
          throw new GitArgumentError(`${flag}: requires an attached value`);
        }
        const value = words[index++];
        if (value === undefined) {
          throw new GitArgumentError(`${flag}: missing option value after initial parsing`);
        }
        tokens.push([flag, value]);
      }
      continue;
    }
    if (/^-\d/.test(word) && spec.numericOption) {
      // Keep shorthand distinct: old Git checks -<digits> but uses atoi for -n.
      tokens.push([word]);
      continue;
    }
    if (/^-\d/.test(word) || word.startsWith('-n')) {
      tokens.push(['-n', word.slice(word.startsWith('-n') ? 2 : 1)]);
      continue;
    }
    if (word.startsWith('--') || word === '-') {
      // setup_revisions retains unknown words until its final usage check.
      // A later ONE_SHOT completion exit can precede that check.
      unknown ??= `Unrecognized revision option: ${word}`;
      continue;
    }
    let cluster = word.slice(1);
    let first = true;
    while (cluster) {
      const short = `-${cluster[0]}`;
      const shortOption = phase.remainingShortOptions?.includes(short) ? lookup(short) : undefined;
      if (!shortOption) {
        if (first) {
          typo(word.slice(1));
        }
        unknown ??= `Unrecognized diff option: -${cluster}`;
        break;
      }
      cluster = cluster.slice(1);
      if (shortOption.value === 'flag') {
        tokens.push([short]);
      } else {
        if (cluster) {
          tokens.push([short, cluster]);
        } else if (shortOption.value.startsWith('optional-')) {
          tokens.push([short]);
        } else {
          const value = words[index++];
          if (value === undefined) {
            throw new GitArgumentError(`${short}: missing option value after initial parsing`);
          }
          tokens.push([short, value]);
        }
        cluster = '';
      }
      if (first && cluster) {
        typo(word.slice(1));
      }
      first = false;
    }
  }
  if (boundary >= 0) {
    tokens.push(['--'], ...argv.slice(boundary + 1).map((operand) => ({ operand })));
  }
  if (unknown) {
    throw new GitArgumentError(unknown);
  }
  return { tokens };
}

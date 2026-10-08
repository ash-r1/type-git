import { GitArgumentError } from '../core/types.js';
import type { CommandSpec, OptionSpec } from './spec.js';

type Token = readonly string[] | { operand: string };
/** Decode the retained stream in setup_revisions order, before applying callbacks. */
export function revisionParserPass(spec: CommandSpec, argv: readonly string[]): Token[] {
  const phase = spec.parserExit!;
  if (argv[0] === '-' && phase.leadingDashReplacement) {
    argv = [phase.leadingDashReplacement, ...argv.slice(1)];
  }
  const options = phase.remainingOptions!;
  const boundary = phase.splitRemainingPaths ? argv.indexOf('--') : -1;
  const words = boundary < 0 ? argv : argv.slice(0, boundary);
  const tokens: Token[] = [];
  const lookup = (flag: string): OptionSpec | undefined =>
    Object.hasOwn(options, flag) ? options[flag] : undefined;
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
    const equal = word.indexOf('=');
    const flag = word.startsWith('--') && equal >= 0 ? word.slice(0, equal) : word;
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
    if (/^-\d/.test(word) || word.startsWith('-n')) {
      tokens.push(['-n', word.slice(word.startsWith('-n') ? 2 : 1)]);
      continue;
    }
    if (word.startsWith('--') || word === '-') {
      throw new GitArgumentError(`Unrecognized revision option: ${word}`);
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
        throw new GitArgumentError(`Unrecognized diff option: -${cluster}`);
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
  return tokens;
}

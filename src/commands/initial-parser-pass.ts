import { GitArgumentError } from '../core/types.js';
import type { CommandSpec } from './spec.js';

/** KEEP_UNKNOWN_OPT disables long abbreviations. Unknown words survive for later passes. */
export function initialParserPass(
  spec: CommandSpec,
  argv: readonly string[],
  exit: NonNullable<CommandSpec['parserExit']> = spec.parserExit!,
): {
  exited: boolean;
  tokens: readonly (readonly string[])[];
  remaining: readonly string[];
  delegated?: true;
} {
  const recognized = new Set(exit.firstPassOptions?.filter((flag) => !exit.flags.includes(flag)));
  const tokens: string[][] = [];
  const remaining: string[] = [];
  // Git's top-level dispatcher owns this position, before the command parser runs.
  if (exit.exceptFirst?.includes(argv[0] ?? '')) {
    return { exited: false, tokens, remaining: argv, delegated: true };
  }
  for (const wrapper of exit.wrappers ?? []) {
    const pass = initialParserPass(spec, argv, {
      ...wrapper,
      flags: exit.flags,
      firstPassOptions: [],
      firstPassLongNames: [],
    });
    if (pass.exited) {
      return pass;
    }
    argv = pass.remaining;
  }
  const help = () => ({ exited: true, tokens: [...tokens, ['-h']], remaining });
  const typo = (word: string) => {
    if (
      word.length >= 3 &&
      (word.startsWith('no-') || exit.firstPassLongNames?.some((name) => name.startsWith(word)))
    ) {
      throw new GitArgumentError(`-${word}: Git requires two dashes for this option`);
    }
  };
  let index = 0;
  while (index < argv.length) {
    const word = argv[index++]!;
    if (word === '--' || word === '--end-of-options') {
      if (word === '--end-of-options' || exit.keepDashDash) {
        remaining.push(word);
      }
      remaining.push(...argv.slice(index));
      break;
    }
    if (word === '--help' || word === '--help-all') {
      return help();
    }
    if (!word.startsWith('-') || word === '-') {
      remaining.push(word);
      if (exit.stopAtUnknown) {
        remaining.push(...argv.slice(index));
        break;
      }
      continue;
    }
    if (word.startsWith('--')) {
      const equal = word.indexOf('=');
      const flag = equal < 0 ? word : word.slice(0, equal);
      if (!recognized.has(flag)) {
        remaining.push(word);
        if (exit.stopAtUnknown) {
          remaining.push(...argv.slice(index));
          break;
        }
        continue;
      }
      const option = spec.options[flag]!;
      if (option.value === 'flag') {
        if (equal >= 0) {
          throw new GitArgumentError(`${flag}: this flag takes no value`);
        }
        tokens.push([flag]);
      } else if (equal >= 0) {
        tokens.push([flag, word.slice(equal + 1)]);
      } else if (option.value.startsWith('optional-')) {
        tokens.push([flag]);
      } else {
        const value = argv[index++];
        if (value === undefined) {
          throw new GitArgumentError(`${flag}: missing option value`);
        }
        tokens.push([flag, value]);
      }
      continue;
    }
    let cluster = word.slice(1);
    let first = true;
    while (cluster) {
      const flag = `-${cluster[0]}`;
      const option = recognized.has(flag) ? spec.options[flag] : undefined;
      // Internal -h is checked when the short-option lookup fails.
      if (!option || flag === '-h') {
        if (first) {
          typo(word.slice(1));
        }
        if (flag === '-h') {
          return help();
        }
        remaining.push(`-${cluster}`);
        if (exit.stopAtUnknown) {
          remaining.push(...argv.slice(index));
          return { exited: false, tokens, remaining };
        }
        break;
      }
      cluster = cluster.slice(1);
      if (option.value === 'flag') {
        tokens.push([flag]);
      } else {
        if (cluster) {
          tokens.push([flag, cluster]);
        } else if (option.value.startsWith('optional-')) {
          tokens.push([flag]);
        } else {
          const value = argv[index++];
          if (value === undefined) {
            throw new GitArgumentError(`${flag}: missing option value`);
          }
          tokens.push([flag, value]);
        }
        cluster = '';
      }
      if (first && cluster) {
        typo(word.slice(1));
      }
      first = false;
    }
  }
  return { exited: false, tokens, remaining };
}

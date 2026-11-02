/**
 * Guards for caller-supplied positional operands in the convenience APIs.
 *
 * Git parses any argv word that starts with `-` as an option until it reaches
 * `--`. A remote, URL, ref, or path taken from user input such as
 * `--upload-pack=<cmd>` or `--output=<file>` would therefore run a command or
 * write a file instead of naming an operand. The convenience APIs reject such
 * values before spawning Git; callers that really mean an option use the typed
 * option fields or `raw()`.
 */
import { GitArgumentError } from './types.js';

/** Whether Git would read this argv word as an option. A lone `-` is an operand. */
function isOptionLike(value: string): boolean {
  return value.length > 1 && value.startsWith('-');
}

/** Return `value` unchanged, or throw when Git would parse it as an option. */
export function checkedOperand(command: string, name: string, value: string): string {
  if (isOptionLike(value)) {
    throw new GitArgumentError(
      `${command}: ${name} must not start with '-' (got ${JSON.stringify(value)}); ` +
        'Git would parse it as an option.',
    );
  }
  return value;
}

/** Return `values` unchanged, or throw when any of them would parse as an option. */
export function checkedOperands(
  command: string,
  name: string,
  values: readonly string[],
): string[] {
  for (const value of values) {
    checkedOperand(command, name, value);
  }
  return [...values];
}

/**
 * Return a revision operand unchanged, or throw when it is empty or option-like.
 *
 * Git never resolves an empty word as a revision, so `git reset ''` or `git diff ''` fail in every
 * repository. Omitting the word instead would run a different command (`git reset` resets the
 * index), so an empty string is refused rather than dropped.
 */
export function checkedRevision(command: string, name: string, value: string): string {
  if (value === '') {
    throw new GitArgumentError(
      `${command}: ${name} must not be empty; Git rejects an empty revision.`,
    );
  }
  return checkedOperand(command, name, value);
}

/**
 * Return an option value unchanged, or throw when it is empty.
 *
 * Used for values Git resolves as a commit, tree or file (`--source`, `--onto`, `--fixup`, `--file`),
 * where an empty string fails in every repository and omitting the option would run a different
 * command.
 */
export function checkedOptionValue(command: string, name: string, value: string): string {
  if (value === '') {
    throw new GitArgumentError(
      `${command}: ${name} must not be empty; Git rejects an empty value here.`,
    );
  }
  return value;
}

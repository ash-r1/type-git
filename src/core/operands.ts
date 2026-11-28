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
import { validRefSortKey } from '../constraints/ref-format.js';
import { branchNameSyntax } from '../constraints/refname.js';
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

/** Return a new branch name unchanged, or throw when Git refuses it in every repository. */
export function checkedNewBranchName(command: string, name: string, value: string): string {
  if (branchNameSyntax(value) === false) {
    throw new GitArgumentError(
      `${command}: ${name} is not a valid branch name (got ${JSON.stringify(value)}); ` +
        'see git check-ref-format --branch.',
    );
  }
  return value;
}

/** Return a ref-filter sort key unchanged, or throw when ref_sorting_options would die on it. */
export function checkedRefSortKey(command: string, value: string): string {
  if (!validRefSortKey(value)) {
    throw new GitArgumentError(
      `${command}: sort is not a ref-filter sort key (got ${JSON.stringify(value)}); ` +
        "use an optional '-', an optional version: or v:, and a field name such as refname.",
    );
  }
  return value;
}

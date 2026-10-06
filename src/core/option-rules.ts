/** Public option types and runtime validation are derived from the constraint model. */
import { COMMAND_CONSTRAINTS, type CommandName } from '../constraints/commands.js';
import { INPUT_CONSTRAINTS } from '../constraints/inputs.js';
import { violations } from '../constraints/model.js';
import type { Constrained } from '../constraints/types.js';
import { GitArgumentError } from './types.js';

export type CheckedOptions<T, N extends CommandName> = Constrained<
  T,
  (typeof COMMAND_CONSTRAINTS)[N]
>;

export function validateOptions(name: CommandName, options: object | undefined): void {
  const errors = violations(COMMAND_CONSTRAINTS[name], (options ?? {}) as Record<string, unknown>);
  if (errors.length > 0) {
    throw new GitArgumentError(`${name}: ${errors.map((r) => `[${r.id}] ${r.reason}`).join('; ')}`);
  }
}

export const REV_PARSE_QUERY_KEYS = [
  'gitDir',
  'absoluteGitDir',
  'gitCommonDir',
  'showToplevel',
  'showCdup',
  'showPrefix',
  'showSuperprojectWorkingTree',
  'sharedIndexPath',
  'gitPath',
  'resolveGitDir',
  'isInsideGitDir',
  'isInsideWorkTree',
  'isBareRepository',
  'isShallowRepository',
  'all',
  'branches',
  'tags',
  'remotes',
  'glob',
  'disambiguate',
  'showObjectFormat',
  'showRefFormat',
  'localEnvVars',
] as const;
export type ExclusiveQuery<T> = T extends unknown
  ? T & { [K in Exclude<(typeof REV_PARSE_QUERY_KEYS)[number], keyof T>]?: never }
  : never;
export function validateRevParseQuery(query: object): void {
  const values = query as Record<string, unknown>;
  const selected = REV_PARSE_QUERY_KEYS.filter((key) => values[key] !== undefined);
  if (
    selected.length !== 1 ||
    (values[selected[0]!] !== true && typeof values[selected[0]!] !== 'string')
  ) {
    throw new GitArgumentError('revParse: specify exactly one query');
  }
}

export function validatePathInput(
  name: string,
  paths: string | string[],
  opts?: { pathspecFromFile?: string },
): void {
  validateInput('pathspec', { paths, ...opts }, name);
}

export function validateInput(
  name: keyof typeof INPUT_CONSTRAINTS,
  input: Record<string, unknown>,
  command: string = name,
): void {
  const errors = violations(INPUT_CONSTRAINTS[name], input);
  if (errors.length > 0) {
    throw new GitArgumentError(
      `${command}: ${errors.map((r) => `[${r.id}] ${r.reason}`).join('; ')}`,
    );
  }
}

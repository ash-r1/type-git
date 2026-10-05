/** Shared compile-time and runtime rules for typed command options. */
import { GitArgumentError } from './types.js';

type Rule = {
  controls?: readonly string[];
  exclusive: readonly (readonly string[])[];
  unsupported: readonly string[];
};
export const OPTION_RULES = {
  clone: {
    exclusive: [
      ['ipv4', 'ipv6'],
      ['depth', 'shallowSince'],
      ['depth', 'shallowExclude'],
      ['bare', 'separateGitDir'],
      ['mirror', 'separateGitDir'],
    ],
    unsupported: [],
  },
  init: { exclusive: [['bare', 'separateGitDir']], unsupported: [] },
  lsRemote: { exclusive: [], unsupported: ['getUrl', 'symref'] },
  lsTree: { exclusive: [['nameOnly', 'objectOnly', 'long']], unsupported: [] },
  status: { exclusive: [['noRenames', 'findRenames']], unsupported: ['verbose'] },
  log: {
    exclusive: [
      ['merges', 'noMerges'],
      ['since', 'after'],
      ['until', 'before'],
    ],
    unsupported: [
      'source',
      'decorate',
      'decorateRefs',
      'decorateRefsExclude',
      'stat',
      'shortstat',
      'nameOnly',
      'nameStatus',
    ],
  },
  fetch: {
    exclusive: [
      ['ipv4', 'ipv6'],
      ['tags', 'noTags'],
      ['depth', 'deepen', 'unshallow'],
      ['depth', 'shallowSince'],
      ['depth', 'shallowExclude'],
      ['all', 'remote'],
      ['all', 'refspec'],
    ],
    unsupported: ['multiple'],
  },
  push: {
    exclusive: [
      ['ipv4', 'ipv6'],
      ['force', 'forceWithLease'],
      ['all', 'mirror', 'refspec'],
      ['all', 'tags'],
      ['branches', 'mirror', 'refspec'],
      ['branches', 'tags'],
      ['mirror', 'tags'],
      ['remote', 'repo'],
    ],
    unsupported: [],
  },
  add: { exclusive: [['all', 'update']], unsupported: ['interactive', 'patch'] },
  checkoutBranch: {
    exclusive: [['createBranch', 'forceCreateBranch', 'detach', 'orphan']],
    unsupported: [],
  },
  checkoutPath: {
    exclusive: [
      ['ours', 'theirs'],
      ['source', 'ours'],
      ['source', 'theirs'],
    ],
    unsupported: [],
  },
  commit: {
    exclusive: [
      ['message', 'file', 'reuseMessage'],
      ['fixup', 'squash'],
      ['include', 'only', 'all'],
      ['gpgSign', 'noGpgSign'],
    ],
    unsupported: ['dryRun', 'reeditMessage'],
  },
  diff: {
    exclusive: [
      ['nameOnly', 'nameStatus', 'stat', 'numstat', 'patchWithRaw', 'patchWithStat'],
      ['nameOnly', 'patch'],
      ['nameStatus', 'patch'],
      ['nameOnly', 'wordDiff'],
      ['nameStatus', 'wordDiff'],
      ['nameOnly', 'context'],
      ['nameStatus', 'context'],
    ],
    unsupported: ['noIndex'],
  },
  merge: {
    controls: ['abort', 'continue', 'quit'],
    exclusive: [
      ['abort', 'continue', 'quit'],
      ['noDiffstat', 'stat'],
    ],
    unsupported: [],
  },
  pull: {
    exclusive: [
      ['ipv4', 'ipv6'],
      ['noStat', 'stat'],
      ['depth', 'deepen', 'unshallow'],
      ['depth', 'shallowSince'],
      ['depth', 'shallowExclude'],
    ],
    unsupported: [],
  },
  switch: {
    exclusive: [
      ['create', 'forceCreate', 'detach', 'orphan'],
      ['discard', 'merge'],
      ['force', 'merge'],
    ],
    unsupported: [],
  },
  cherryPick: {
    controls: ['abort', 'continue', 'skip'],
    exclusive: [['abort', 'continue', 'skip']],
    unsupported: ['noVerify'],
  },
  revert: {
    controls: ['abort', 'continue', 'skip'],
    exclusive: [['abort', 'continue', 'skip']],
    unsupported: ['noVerify'],
  },
  rebase: {
    controls: ['abort', 'continue', 'skip'],
    exclusive: [
      ['abort', 'continue', 'skip'],
      ['keepBase', 'onto'],
      ['keepBase', 'root'],
      ['apply', 'rebaseMerges'],
      ['apply', 'strategy'],
      ['apply', 'exec'],
    ],
    unsupported: ['interactive'],
  },
  restore: {
    exclusive: [
      ['ours', 'theirs'],
      ['source', 'ours'],
      ['source', 'theirs'],
      ['source', 'merge'],
      ['source', 'conflict'],
    ],
    unsupported: [],
  },
  clean: { exclusive: [['ignored', 'onlyIgnored']], unsupported: [] },
  worktreeAdd: {
    exclusive: [
      ['branch', 'detach'],
      ['orphan', 'detach'],
    ],
    unsupported: [],
  },
  remoteSetHead: { exclusive: [['auto', 'delete']], unsupported: [] },
  configGet: { exclusive: [['all', 'default']], unsupported: [] },
  configList: { exclusive: [], unsupported: ['nameOnly'] },
  lfsPull: { exclusive: [], unsupported: ['ref'] },
  lfsPush: { exclusive: [['ref', 'objectId']], unsupported: [] },
  lfsFetch: {
    exclusive: [
      ['all', 'include'],
      ['all', 'exclude'],
      ['all', 'recent'],
    ],
    unsupported: [],
  },
  lfsStatus: { exclusive: [], unsupported: ['porcelain'] },
  lfsLsFiles: { exclusive: [], unsupported: ['debug', 'nameOnly'] },
} as const satisfies Record<string, Rule>;

type Exclusive<T, Keys extends keyof T> = {
  [K in Keys]: Pick<T, K> & { [P in Exclude<Keys, K>]?: Extract<T[P], false> };
}[Keys];
type Groups<T, G extends readonly (readonly string[])[]> = G extends readonly [
  infer H extends readonly string[],
  ...infer R extends readonly (readonly string[])[],
]
  ? Exclusive<T, Extract<H[number], keyof T>> & Groups<T, R>
  : unknown;

type ControlOptions<T, K extends keyof T> =
  | { [P in K]?: false }
  | { [P in K]: Pick<T, P> & { [Q in Exclude<keyof T, P>]?: Extract<T[Q], false> } }[K];
type Controls<T, N extends keyof typeof OPTION_RULES> = (typeof OPTION_RULES)[N] extends {
  controls: readonly (infer K)[];
}
  ? ControlOptions<T, Extract<K, keyof T>>
  : unknown;

/** Disallow conflicting flags and output modes that cannot satisfy the typed result. */
export type CheckedOptions<T, N extends keyof typeof OPTION_RULES> = T &
  Controls<T, N> &
  Groups<T, (typeof OPTION_RULES)[N]['exclusive']> & {
    [K in (typeof OPTION_RULES)[N]['unsupported'][number]]?: never;
  };

export function validateOptions(
  name: keyof typeof OPTION_RULES,
  options: object | undefined,
): void {
  if (!options) {
    return;
  }
  const values = options as Record<string, unknown>;
  const rule: Rule = OPTION_RULES[name];
  if (
    (name === 'lfsStatus' || name === 'lfsLsFiles') &&
    values.json !== undefined &&
    values.json !== true
  ) {
    throw new GitArgumentError(`${name}: the typed API uses JSON`);
  }
  if (name === 'status' && values.porcelain !== undefined && values.porcelain !== 2) {
    throw new GitArgumentError('status: the typed API uses porcelain v2');
  }
  if (
    (name === 'status' || name === 'diff') &&
    values.nullTerminated !== undefined &&
    values.nullTerminated !== true
  ) {
    throw new GitArgumentError(`${name}: the typed API uses NUL-delimited paths`);
  }

  for (const key of rule.unsupported) {
    if (values[key] !== undefined) {
      throw new GitArgumentError(
        `${name}: ${key} is not supported by the typed API; use raw() for this output or operation`,
      );
    }
  }
  if (rule.controls?.some((key) => values[key] === true)) {
    const ignored = Object.keys(values).filter(
      (key) =>
        !(
          rule.controls?.includes(key) || ['signal', 'onProgress', 'onLfsProgress'].includes(key)
        ) &&
        values[key] !== undefined &&
        values[key] !== false,
    );
    if (ignored.length > 0) {
      throw new GitArgumentError(`${name}: control operations cannot take ${ignored.join(', ')}`);
    }
  }
  for (const group of rule.exclusive) {
    const active = group.filter((key) => values[key] !== undefined && values[key] !== false);
    if (active.length > 1) {
      throw new GitArgumentError(`${name}: ${active.join(', ')} cannot be used together`);
    }
  }
  for (const key of ['depth', 'deepen', 'jobs', 'mainline']) {
    const value = values[key];
    if (value !== undefined && (!Number.isSafeInteger(value) || (value as number) < 1)) {
      throw new GitArgumentError(`${name}: ${key} must be a positive safe integer`);
    }
  }
  for (const key of ['maxCount', 'skip', 'context', 'renameLimit', 'abbrev']) {
    const value = values[key];
    if (
      value !== undefined &&
      typeof value !== 'boolean' &&
      (!Number.isSafeInteger(value) || (value as number) < 0)
    ) {
      throw new GitArgumentError(`${name}: ${key} must be a non-negative safe integer`);
    }
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
  if (opts?.pathspecFromFile !== undefined && (typeof paths === 'string' || paths.length > 0)) {
    throw new GitArgumentError(`${name}: pass an empty path list when using pathspecFromFile`);
  }
}

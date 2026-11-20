/**
 * Configuration keys accepted by `git.clone(url, path, { config })`.
 *
 * `git clone -c <key>=<value>` writes the key into the new repository and applies it to the
 * initial fetch, so a caller-supplied key can make Git run commands: `protocol.ext.allow=always`
 * enables the `ext::` transport, `include.path` loads another config file, and `core.sshCommand`,
 * `core.fsmonitor`, `remote.<name>.uploadpack` and many more name programs directly. Git keeps
 * adding such keys, so instead of refusing known-dangerous keys this module accepts only keys that
 * hold data. Any other key belongs in `raw()` or strict `command()`, or in `repo.config` after the
 * clone.
 */
import { GitArgumentError } from './types.js';

/** Value types of the data-only configuration keys that `clone` accepts. */
export type CloneConfigSchema = {
  'user.name': string;
  'user.email': string;

  'core.autocrlf': 'true' | 'false' | 'input';
  'core.eol': 'lf' | 'crlf' | 'native';
  'core.filemode': 'true' | 'false';
  'core.ignorecase': 'true' | 'false';
  'core.symlinks': 'true' | 'false';
  'core.longpaths': 'true' | 'false';
  'core.protectNTFS': 'true' | 'false';
  'core.protectHFS': 'true' | 'false';
  'core.precomposeUnicode': 'true' | 'false';
  'core.quotepath': 'true' | 'false';
  'core.sparseCheckout': 'true' | 'false';
  'core.sparseCheckoutCone': 'true' | 'false';
  'core.compression': string;
  'core.bigFileThreshold': string;

  'protocol.version': '0' | '1' | '2';

  'fetch.fsckObjects': 'true' | 'false';
  'transfer.fsckObjects': 'true' | 'false';
  'fetch.prune': 'true' | 'false';
  'fetch.pruneTags': 'true' | 'false';
  'fetch.parallel': string;

  'pull.rebase': 'true' | 'false' | 'merges' | 'interactive';
  'pull.ff': 'true' | 'false' | 'only';
  'push.default': 'nothing' | 'current' | 'upstream' | 'tracking' | 'simple' | 'matching';
  'push.autoSetupRemote': 'true' | 'false';
  'merge.ff': 'true' | 'false' | 'only';
  'merge.conflictstyle': 'merge' | 'diff3' | 'zdiff3';
  'rebase.autoStash': 'true' | 'false';
  'rebase.autoSquash': 'true' | 'false';
  'rebase.updateRefs': 'true' | 'false';
  'diff.algorithm': 'default' | 'minimal' | 'patience' | 'histogram';
  'color.ui': 'auto' | 'always' | 'never' | 'true' | 'false';

  'lfs.fetchinclude': string;
  'lfs.fetchexclude': string;
} & {
  [K in `http.${CloneHttpVariable}`]: string;
};

/** `http.*` variables that `clone` accepts, with or without a `http.<url>.` subsection. */
export type CloneHttpVariable =
  | 'sslVerify'
  | 'sslCAInfo'
  | 'sslCAPath'
  | 'proxy'
  | 'extraHeader'
  | 'version'
  | 'postBuffer'
  | 'lowSpeedLimit'
  | 'lowSpeedTime'
  | 'followRedirects';

/** Data-only configuration key accepted by `clone`. */
export type CloneConfigKey = keyof CloneConfigSchema | `http.${string}.${CloneHttpVariable}`;

/**
 * Configuration for the new repository, written with `git clone -c`.
 *
 * Only data-only keys are accepted, so a key from untrusted input cannot make Git run a
 * program. Section and variable names match case-insensitively, as in Git.
 */
export type CloneConfig = { [K in keyof CloneConfigSchema]?: CloneConfigSchema[K] } & {
  [K in `http.${string}.${CloneHttpVariable}`]?: string;
};

const HTTP_VARIABLES: readonly CloneHttpVariable[] = [
  'sslVerify',
  'sslCAInfo',
  'sslCAPath',
  'proxy',
  'extraHeader',
  'version',
  'postBuffer',
  'lowSpeedLimit',
  'lowSpeedTime',
  'followRedirects',
];

const PLAIN_KEYS: readonly string[] = [
  'user.name',
  'user.email',
  'core.autocrlf',
  'core.eol',
  'core.filemode',
  'core.ignorecase',
  'core.symlinks',
  'core.longpaths',
  'core.protectNTFS',
  'core.protectHFS',
  'core.precomposeUnicode',
  'core.quotepath',
  'core.sparseCheckout',
  'core.sparseCheckoutCone',
  'core.compression',
  'core.bigFileThreshold',
  'protocol.version',
  'fetch.fsckObjects',
  'transfer.fsckObjects',
  'fetch.prune',
  'fetch.pruneTags',
  'fetch.parallel',
  'pull.rebase',
  'pull.ff',
  'push.default',
  'push.autoSetupRemote',
  'merge.ff',
  'merge.conflictstyle',
  'rebase.autoStash',
  'rebase.autoSquash',
  'rebase.updateRefs',
  'diff.algorithm',
  'color.ui',
  'lfs.fetchinclude',
  'lfs.fetchexclude',
  ...HTTP_VARIABLES.map((name) => `http.${name}`),
];

/** Keys without a subsection, lower-cased: Git ignores case in section and variable names. */
const PLAIN_KEY_SET: ReadonlySet<string> = new Set(PLAIN_KEYS.map((key) => key.toLowerCase()));
const HTTP_VARIABLE_SET: ReadonlySet<string> = new Set(
  HTTP_VARIABLES.map((name) => name.toLowerCase()),
);

/** Whether `text` holds a control character other than tab, which a config key cannot carry. */
function hasControl(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if ((code < 0x20 && code !== 0x09) || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/** Whether `value` holds NUL, CR or LF, which would end it early or inject another line. */
function hasLineBreak(value: string): boolean {
  return value.includes('\0') || value.includes('\r') || value.includes('\n');
}

/** Whether `key` names a data-only key that `clone` accepts. */
export function isCloneConfigKey(key: string): boolean {
  if (key.includes('=') || hasControl(key)) {
    return false;
  }
  const first = key.indexOf('.');
  const last = key.lastIndexOf('.');
  if (first <= 0 || last === key.length - 1) {
    return false;
  }
  if (first === last) {
    return PLAIN_KEY_SET.has(key.toLowerCase());
  }
  // Git splits `section.subsection.variable` at the first and last dots; the subsection is a
  // case-sensitive URL here and may itself contain dots.
  const section = key.slice(0, first).toLowerCase();
  const variable = key.slice(last + 1).toLowerCase();
  return section === 'http' && HTTP_VARIABLE_SET.has(variable);
}

/**
 * Return the `-c` arguments for `config`, or throw `GitArgumentError` for a key that is not
 * data-only or a value that contains NUL, CR or LF.
 */
export function cloneConfigArgs(config: Readonly<Record<string, unknown>>): string[] {
  const args: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) {
      continue;
    }
    if (!isCloneConfigKey(key)) {
      throw new GitArgumentError(
        `clone: config key ${JSON.stringify(key)} is not accepted; clone only takes data-only ` +
          'keys (see CloneConfigSchema). Set other keys with repo.config after cloning, or use ' +
          'raw() or strict command() if the value is trusted.',
      );
    }
    if (typeof value !== 'string') {
      throw new GitArgumentError(`clone: config value for ${JSON.stringify(key)} must be a string`);
    }
    if (hasLineBreak(value)) {
      throw new GitArgumentError(
        `clone: config value for ${JSON.stringify(key)} must not contain NUL, CR or LF`,
      );
    }
    args.push('-c', `${key}=${value}`);
  }
  return args;
}

/**
 * Checks behind `git.open(path, { untrusted: true })`.
 *
 * Git reads `.git/config`, the files it includes and `.git/hooks` from the repository itself, and
 * many keys there name a program: `core.fsmonitor`, `core.sshCommand`, `diff.<driver>.textconv`,
 * `filter.<driver>.smudge`, `remote.<name>.uploadpack`, `alias.*` and more, with new ones in most
 * releases. Whoever wrote the repository directory therefore decides what runs when it is used.
 * Git has no switch to ignore repository configuration, so untrusted mode does two things:
 *
 * - Every command runs with {@link untrustedRepoConfigOverrides}, which turn off hooks and
 *   the filesystem monitor, refuse the `ext::` transport and refuse implicit bare repositories.
 * - Opening refuses a repository whose own configuration (the `local` and `worktree` scopes,
 *   including the files they include) holds any key outside a closed list of data-only keys.
 *   Keys with a fixed name can be overridden, but driver keys such as `diff.<driver>.command`
 *   cannot, because the driver name is chosen by the repository; refusing is the only safe answer.
 *   Remote URLs must be network URLs, because a local path points Git at another repository
 *   whose configuration is not checked.
 */

/** Oldest Git whose behaviour untrusted mode relies on (`safe.bareRepository`). */
export const UNTRUSTED_REPO_MIN_GIT_VERSION = '2.38.0';

/**
 * `-c` overrides added to every command of a repository opened in untrusted mode.
 *
 * `core.hooksPath` must name a path that can never hold hooks. `/dev/null` is a device on POSIX.
 * Git for Windows reads `/dev/null/<hook>` as a directory on the current drive, which anyone could
 * create, so on Windows the path goes below the runtime's own executable file instead: a path
 * below a regular file cannot exist. An empty `core.fsmonitor` is off on every Git version, where
 * `false` would name a program on Git before 2.36.
 */
export function untrustedRepoConfigOverrides(
  platform: string = process.platform,
  execPath: string = process.execPath,
): string[] {
  const hooksPath = platform === 'win32' ? `${execPath}/no-hooks` : '/dev/null';
  return [
    `core.hooksPath=${hooksPath}`,
    'core.fsmonitor=',
    'protocol.ext.allow=never',
    'safe.bareRepository=explicit',
  ];
}

/** Repository-level keys without a subsection that hold only data (lower-case). */
const PLAIN_KEYS: ReadonlySet<string> = new Set([
  'core.repositoryformatversion',
  'core.bare',
  'core.logallrefupdates',
  'core.filemode',
  'core.ignorecase',
  'core.precomposeunicode',
  'core.symlinks',
  'core.autocrlf',
  'core.eol',
  'core.safecrlf',
  'core.longpaths',
  'core.quotepath',
  'core.sparsecheckout',
  'core.sparsecheckoutcone',
  'core.compression',
  'core.bigfilethreshold',
  'core.checkstat',
  'core.trustctime',
  'core.untrackedcache',
  'core.commitgraph',
  'core.multipackindex',
  'core.abbrev',
  'extensions.objectformat',
  'extensions.compatobjectformat',
  'extensions.refstorage',
  'extensions.worktreeconfig',
  'extensions.partialclone',
  'extensions.preciousobjects',
  'user.name',
  'user.email',
  'init.defaultbranch',
  'index.version',
  'index.sparse',
  'maintenance.auto',
  'maintenance.strategy',
  'protocol.version',
  'fetch.prune',
  'fetch.prunetags',
  'pull.rebase',
  'pull.ff',
  'push.default',
  'push.autosetupremote',
  'merge.ff',
  'merge.conflictstyle',
  'rebase.autostash',
  'rebase.autosquash',
  'rebase.updaterefs',
  'diff.algorithm',
  'color.ui',
  'lfs.repositoryformatversion',
  'lfs.fetchinclude',
  'lfs.fetchexclude',
]);

/** Data-only variables of `<section>.<subsection>.<variable>` keys, by section. */
const SUBSECTION_VARIABLES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  [
    'remote',
    new Set([
      'url',
      'pushurl',
      'fetch',
      'push',
      'tagopt',
      'prune',
      'prunetags',
      'mirror',
      'promisor',
      'partialclonefilter',
      'skipdefaultupdate',
      'skipfetchall',
    ]),
  ],
  ['branch', new Set(['remote', 'merge', 'rebase', 'pushremote', 'description'])],
  ['submodule', new Set(['url', 'active', 'branch', 'ignore', 'shallow'])],
]);

/**
 * Keys whose value is a remote URL. Only network URLs are accepted: a local path or `file://`
 * URL makes Git run `upload-pack` or `receive-pack` in that directory without the `-c`
 * overrides (the local transport drops them), so that repository's own hooks and
 * configuration would run unchecked; a `<helper>::` URL runs `git-remote-<helper>`.
 */
const URL_VARIABLES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['remote', new Set(['url', 'pushurl'])],
  ['submodule', new Set(['url'])],
]);

/** Keys whose value names a remote, which Git also accepts as a URL or path. */
const REMOTE_NAME_VARIABLES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['branch', new Set(['remote', 'pushremote'])],
]);

/** Keys that accept `interactive`, which would start an editor. */
const REBASE_MODE_KEYS: ReadonlySet<string> = new Set(['pull.rebase', 'branch.*.rebase']);

/** Whether `value` is an `https`, `http`, `ssh` or `git` URL, or an scp-style `[user@]host:path`. */
export function isNetworkRemoteUrl(value: string): boolean {
  if (/^(?:https?|ssh|git|git\+ssh|ssh\+git):\/\/[^/\\]/i.test(value)) {
    return true;
  }
  // Any other `<scheme>://` runs `git-remote-<scheme>`, and `<helper>::` names a helper too.
  if (value.includes('://') || value.includes('::')) {
    return false;
  }
  // scp-style: a colon before any slash. A single letter before the colon is a Windows drive.
  const match = /^(?:[^@/\\:]+@)?([^/\\:]+):/.exec(value);
  return match !== null && (match[1] as string).length > 1;
}

/** Whether `value` names a remote rather than spelling a URL or path. */
function isPlainRemoteName(value: string): boolean {
  return value.length > 0 && !value.startsWith('.') && !/[/\\:]/.test(value);
}

/** The values `git lfs install` writes, which are the only `filter.lfs.*` values accepted. */
const LFS_FILTER_VALUES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['clean', new Set(['git-lfs clean -- %f'])],
  ['smudge', new Set(['git-lfs smudge -- %f', 'git-lfs smudge --skip -- %f'])],
  ['process', new Set(['git-lfs filter-process', 'git-lfs filter-process --skip'])],
  ['required', new Set(['true'])],
]);

/** Lower-case ASCII letters only, as Git does for section and variable names. */
function asciiLower(text: string): string {
  return text.replace(/[A-Z]/g, (letter) => String.fromCharCode(letter.charCodeAt(0) + 32));
}

/**
 * Whether a repository-level entry holds only data. `value` is `undefined` for a key written
 * without `=`, which Git reads as `true`.
 *
 * A key that names a remote (`branch.<name>.remote`, `extensions.partialClone`, ...) is accepted
 * only for a name in `configuredRemotes`, the remotes whose `remote.<name>.url` the repository
 * sets (and which is checked as a URL). Git reads any other name as a URL or path, or from the
 * legacy `remotes/` and `branches/` files. Without `configuredRemotes`, only the form of the name
 * is checked.
 */
export function isDataOnlyRepoConfigEntry(
  key: string,
  value: string | undefined,
  configuredRemotes?: ReadonlySet<string>,
): boolean {
  const namesRemote = (name: string | undefined): boolean =>
    name !== undefined &&
    isPlainRemoteName(name) &&
    (configuredRemotes === undefined || configuredRemotes.has(name));
  const first = key.indexOf('.');
  const last = key.lastIndexOf('.');
  if (first <= 0 || last === key.length - 1) {
    return false;
  }
  const section = asciiLower(key.slice(0, first));
  const variable = asciiLower(key.slice(last + 1));
  if (first === last) {
    const name = `${section}.${variable}`;
    if (name === 'extensions.partialclone') {
      // Names the promisor remote; Git reads a value that is not a remote name as a URL or path.
      return namesRemote(value);
    }
    return PLAIN_KEYS.has(name) && !(REBASE_MODE_KEYS.has(name) && isInteractive(value));
  }
  // Git splits `section.subsection.variable` at the first and last dots; the subsection is
  // case-sensitive and may itself contain dots.
  const subsection = key.slice(first + 1, last);
  if (section === 'filter' && subsection === 'lfs') {
    return value !== undefined && LFS_FILTER_VALUES.get(variable)?.has(value) === true;
  }
  if (section === 'lfs') {
    return variable === 'access';
  }
  if (URL_VARIABLES.get(section)?.has(variable) === true) {
    return value !== undefined && isNetworkRemoteUrl(value);
  }
  if (REMOTE_NAME_VARIABLES.get(section)?.has(variable) === true) {
    return namesRemote(value);
  }
  if (REBASE_MODE_KEYS.has(`${section}.*.${variable}`) && isInteractive(value)) {
    return false;
  }
  return SUBSECTION_VARIABLES.get(section)?.has(variable) === true;
}

/** Whether a rebase mode value asks for an interactive rebase. */
function isInteractive(value: string | undefined): boolean {
  const mode = value === undefined ? '' : asciiLower(value);
  return mode === 'interactive' || mode === 'i';
}

/** One entry of `git config --list --show-scope -z`. */
export type ScopedConfigEntry = { scope: string; key: string; value: string | undefined };

/** Parse `git config --list --show-scope -z` output. */
export function parseScopedConfigList(stdout: string): ScopedConfigEntry[] {
  const fields = stdout.split('\0');
  const entries: ScopedConfigEntry[] = [];
  // Each entry is `<scope>\0<key>\n<value>\0`, or `<scope>\0<key>\0` for a key without a value.
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const scope = fields[i] as string;
    const pair = fields[i + 1] as string;
    const newline = pair.indexOf('\n');
    entries.push(
      newline === -1
        ? { scope, key: pair, value: undefined }
        : { scope, key: pair.slice(0, newline), value: pair.slice(newline + 1) },
    );
  }
  return entries;
}

/**
 * Keys from the repository's own configuration (scopes `local` and `worktree`) that are not
 * data-only, in the order Git lists them and without duplicates.
 */
export function unsafeRepoConfigKeys(entries: readonly ScopedConfigEntry[]): string[] {
  const own = entries.filter((entry) => entry.scope === 'local' || entry.scope === 'worktree');
  const configuredRemotes = new Set<string>();
  for (const { key } of own) {
    const first = key.indexOf('.');
    const last = key.lastIndexOf('.');
    if (
      first > 0 &&
      last > first &&
      asciiLower(key.slice(0, first)) === 'remote' &&
      asciiLower(key.slice(last + 1)) === 'url'
    ) {
      configuredRemotes.add(key.slice(first + 1, last));
    }
  }
  const unsafe = new Set<string>();
  for (const entry of own) {
    if (!isDataOnlyRepoConfigEntry(entry.key, entry.value, configuredRemotes)) {
      unsafe.add(entry.key);
    }
  }
  return [...unsafe];
}

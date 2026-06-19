/**
 * Environment variable inheritance control (environment variable traversal prevention)
 *
 * By default, type-git does NOT pass the entire parent process environment to the
 * spawned Git subprocess. Leaking the full environment into Git (and from there into
 * credential helpers, hooks, and LFS transfer agents) is an environment variable
 * traversal risk: secrets such as cloud credentials or API tokens that live in the
 * parent process can be exfiltrated by untrusted Git configuration or remote-controlled
 * helpers.
 *
 * Instead, only a curated allowlist of variables that Git genuinely needs to operate is
 * inherited. Callers can widen or replace this behavior via the `inheritEnv` option.
 */

/**
 * Controls how the parent process environment is inherited by spawned Git commands.
 *
 * - `undefined` (default): inherit only {@link DEFAULT_ENV_ALLOWLIST} — the variables
 *   Git needs to function. Sensitive variables are not passed through.
 * - `true`: inherit the entire parent environment (legacy behavior, opt-in).
 * - `false`: inherit nothing. The child only receives explicitly provided variables and
 *   values computed by the library (e.g. `HOME`, `PATH` prefixes). Note that this may
 *   break Git if `PATH` is not otherwise supplied.
 * - `string[]`: inherit {@link DEFAULT_ENV_ALLOWLIST} plus the named variables. Use this
 *   to explicitly opt specific variables (e.g. an SSH command or a token) back in.
 */
export type EnvInheritance = boolean | string[];

/**
 * Curated allowlist of environment variables inherited by default.
 *
 * These are variables Git (and the tools it shells out to, such as ssh and credential
 * helpers) commonly needs to operate. The list intentionally excludes arbitrary
 * application secrets so they are not silently forwarded to Git subprocesses.
 *
 * Variable names are matched case-insensitively on Windows.
 */
export const DEFAULT_ENV_ALLOWLIST: readonly string[] = [
  // Executable resolution
  'PATH',
  'PATHEXT',
  // User home / identity
  'HOME',
  'USER',
  'LOGNAME',
  // Locale and time
  'LANG',
  'LANGUAGE',
  'LC_ALL',
  'LC_CTYPE',
  'LC_MESSAGES',
  'LC_NUMERIC',
  'LC_TIME',
  'LC_COLLATE',
  'LC_MONETARY',
  'TZ',
  // Temporary directories
  'TMPDIR',
  'TMP',
  'TEMP',
  // Terminal
  'TERM',
  'COLORTERM',
  // SSH agent (required for Git-over-SSH authentication)
  'SSH_AUTH_SOCK',
  'SSH_AGENT_PID',
  // Git SSH transport and TLS configuration. These are commonly required for
  // fetch/push to keep working under the default allowlist. They are transport
  // configuration rather than credential stores, but note they can still carry
  // sensitive data depending on local setup (e.g. GIT_SSH_COMMAND can name a command
  // Git executes). The most credential-prone / askpass variables (GIT_ASKPASS,
  // SSH_ASKPASS, GIT_PROXY_COMMAND) are intentionally NOT inherited by default — they
  // can carry inline credentials or run a helper that reads secrets from the
  // environment, which would weaken the traversal-prevention model. Opt into those
  // explicitly via `inheritEnv` when needed.
  'GIT_SSH',
  'GIT_SSH_COMMAND',
  'GIT_SSH_VARIANT',
  'GIT_SSL_CAINFO',
  'GIT_SSL_CAPATH',
  'GIT_TERMINAL_PROMPT',
  'GIT_CONFIG_NOSYSTEM',
  // HTTP(S) proxy configuration (required for Git network operations behind a proxy)
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'http_proxy',
  'https_proxy',
  'ALL_PROXY',
  'all_proxy',
  'NO_PROXY',
  'no_proxy',
  // Windows essentials
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'APPDATA',
  'LOCALAPPDATA',
  'PROGRAMDATA',
  'ALLUSERSPROFILE',
  'PROGRAMFILES',
  'PROGRAMFILES(X86)',
  'PROGRAMW6432',
  'PUBLIC',
  'SYSTEMROOT',
  'SYSTEMDRIVE',
  'WINDIR',
  'COMSPEC',
  'COMPUTERNAME',
  'USERDOMAIN',
  'NUMBER_OF_PROCESSORS',
  'PROCESSOR_ARCHITECTURE',
];

/**
 * Resolve the set of environment variables to inherit from the parent process.
 *
 * @param parentEnv - The parent process environment (e.g. `process.env`).
 * @param inheritEnv - Inheritance policy. See {@link EnvInheritance}.
 * @param platform - The runtime platform (e.g. `process.platform`). When `'win32'`,
 *   variable names are matched case-insensitively.
 * @returns A record containing only the inherited variables (undefined values removed).
 */
export function resolveInheritedEnv(
  parentEnv: Record<string, string | undefined>,
  inheritEnv?: EnvInheritance,
  platform: string = '',
): Record<string, string> {
  // Legacy behavior: inherit the entire parent environment.
  if (inheritEnv === true) {
    const all: Record<string, string> = {};
    for (const [key, value] of Object.entries(parentEnv)) {
      if (value !== undefined) {
        all[key] = value;
      }
    }
    return all;
  }

  // Build the allowlist. `false` means inherit nothing; an array extends the defaults.
  const allow = new Set<string>(inheritEnv === false ? [] : DEFAULT_ENV_ALLOWLIST);
  if (Array.isArray(inheritEnv)) {
    for (const name of inheritEnv) {
      allow.add(name);
    }
  }

  // Windows environment variable names are case-insensitive.
  const isWindows = platform === 'win32';
  const allowLower = isWindows ? new Set([...allow].map((name) => name.toLowerCase())) : null;

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parentEnv)) {
    if (value === undefined) {
      continue;
    }
    const allowed = allowLower ? allowLower.has(key.toLowerCase()) : allow.has(key);
    if (allowed) {
      result[key] = value;
    }
  }
  return result;
}

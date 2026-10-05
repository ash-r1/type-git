import { validateOptions } from '../core/option-rules.js';
import type {
  ConfigEntry,
  ConfigGetOpts,
  ConfigKey,
  ConfigListOpts,
  ConfigSchema,
} from '../core/repo.js';
import { type ExecOpts, type ExecutionContext, GitError } from '../core/types.js';
import { parseRecords } from '../parsers/index.js';
import type { CliRunner } from '../runner/cli-runner.js';

const CONFIG_ENUMS = {
  'core.autocrlf': ['true', 'false', 'input'],
  'core.filemode': ['true', 'false'],
  'core.ignorecase': ['true', 'false'],
  'core.bare': ['true', 'false'],
  'core.logallrefupdates': ['true', 'false', 'always'],
  'core.quotepath': ['true', 'false'],
  'commit.gpgsign': ['true', 'false'],
  'tag.gpgsign': ['true', 'false'],
  'tag.forcesignannotated': ['true', 'false'],
  'push.default': ['nothing', 'current', 'upstream', 'tracking', 'simple', 'matching'],
  'push.followTags': ['true', 'false'],
  'push.autoSetupRemote': ['true', 'false'],
  'push.gpgSign': ['true', 'false', 'if-asked'],
  'pull.rebase': ['true', 'false', 'merges', 'interactive'],
  'pull.ff': ['true', 'false', 'only'],
  'fetch.prune': ['true', 'false'],
  'fetch.pruneTags': ['true', 'false'],
  'merge.ff': ['true', 'false', 'only'],
  'merge.conflictstyle': ['merge', 'diff3', 'zdiff3'],
  'rebase.autoStash': ['true', 'false'],
  'rebase.autoSquash': ['true', 'false'],
  'rebase.updateRefs': ['true', 'false'],
  'diff.algorithm': ['default', 'minimal', 'patience', 'histogram'],
  'diff.colorMoved': ['no', 'default', 'plain', 'blocks', 'zebra', 'dimmed-zebra'],
  'color.ui': ['auto', 'always', 'never', 'true', 'false'],
  'gpg.format': ['openpgp', 'x509', 'ssh'],
  'http.sslVerify': ['true', 'false'],
} satisfies {
  [K in ConfigKey as string extends ConfigSchema[K] ? never : K]: readonly ConfigSchema[K][];
};

export function configValue<K extends ConfigKey>(
  key: K,
  value: string,
  implicit = false,
): ConfigSchema[K] {
  const allowed = (CONFIG_ENUMS as Record<string, readonly string[]>)[key];
  if (!allowed) {
    return value as ConfigSchema[K];
  }
  let normalized = value.toLowerCase();
  if (allowed.includes('true') && allowed.includes('false')) {
    if (normalized === '') {
      normalized = implicit ? 'true' : 'false';
    }
    if (/^[+-]?\d+[kmg]?$/i.test(normalized)) {
      normalized = Number.parseInt(normalized, 10) === 0 ? 'false' : 'true';
    }
    if (['yes', 'on', '1'].includes(normalized)) {
      normalized = 'true';
    }
    if (['no', 'off', '0'].includes(normalized)) {
      normalized = 'false';
    }
  }
  if (!allowed.includes(normalized)) {
    throw new GitError('ParseError', `Invalid value for ${key}: expected ${allowed.join(' | ')}`);
  }
  return normalized as ConfigSchema[K];
}

export async function readConfig(
  runner: CliRunner,
  context: ExecutionContext,
  key: string,
  opts?: ConfigGetOpts & ExecOpts,
): Promise<string | string[] | undefined> {
  validateOptions('configGet', opts);
  const args = ['config', ...(context.type === 'global' ? ['--global'] : []), '--null'];
  if (opts?.type) {
    args.push(`--type=${opts.type}`);
  }
  if (opts?.default !== undefined) {
    args.push('--default', opts.default);
  }
  args.push(opts?.all ? '--get-all' : '--get', key);
  const result = await runner.run(context, args, opts);
  // Exit 1 means no matching key. Cancellation and all other failures must propagate.
  if (result.exitCode === 1 && !result.aborted) {
    return opts?.all ? [] : undefined;
  }
  runner.checkResult(context, args, result);
  const values = parseRecords(result.stdout);
  return opts?.all ? values : values[0];
}

export async function listConfig(
  runner: CliRunner,
  context: ExecutionContext,
  opts?: ConfigListOpts & ExecOpts,
): Promise<ConfigEntry[]> {
  validateOptions('configList', opts);
  const args = ['config', ...(context.type === 'global' ? ['--global'] : []), '--null', '--list'];
  if (opts?.showOrigin) {
    args.push('--show-origin');
  }
  if (opts?.showScope) {
    args.push('--show-scope');
  }
  if (opts?.includes !== undefined) {
    args.push(opts.includes ? '--includes' : '--no-includes');
  }
  const result = await runner.runOrThrow(context, args, opts);
  const records = parseRecords(result.stdout);
  const entries: ConfigEntry[] = [];
  for (let i = 0; i < records.length; ) {
    const scope = opts?.showScope ? records[i++] : undefined;
    const origin = opts?.showOrigin ? records[i++] : undefined;
    const entry = records[i++];
    if (entry === undefined) {
      throw new GitError('ParseError', 'Incomplete config record');
    }
    const separator = entry.indexOf('\n');
    entries.push({
      key: separator < 0 ? entry : entry.slice(0, separator),
      value: separator < 0 ? '' : entry.slice(separator + 1),
      ...(scope !== undefined ? { scope } : {}),
      ...(origin !== undefined ? { origin } : {}),
    });
  }
  return entries;
}

/** --get-regexp preserves the distinction between implicit booleans and empty values. */
export async function readTypedConfig<K extends ConfigKey>(
  runner: CliRunner,
  context: ExecutionContext,
  key: K,
  opts?: ExecOpts,
  all = false,
): Promise<ConfigSchema[K][]> {
  const pattern = `^${key.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
  const args = [
    'config',
    ...(context.type === 'global' ? ['--global'] : []),
    '--null',
    '--get-regexp',
    pattern,
  ];
  const result = await runner.run(context, args, opts);
  if (result.exitCode === 1 && !result.aborted) {
    return [];
  }
  runner.checkResult(context, args, result);
  const records = parseRecords(result.stdout);
  return (all ? records : records.slice(-1)).map((record) => {
    const separator = record.indexOf('\n');
    return configValue(key, separator < 0 ? '' : record.slice(separator + 1), separator < 0);
  });
}

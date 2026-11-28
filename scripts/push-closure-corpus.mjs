// Independent native oracle for the push completion closure (docs/design/audit-completion.md).
// cmd_push refuses incompatible modes and --delete without refs, then resolves the remote,
// refuses push options with newlines, bulk modes with refspecs and, in set_refspecs, an
// unfinished tag shorthand and --delete words that are not plain names. Every case is a dry
// run against a local bare remote, so nothing is transferred. Cases are singles, pairs and
// selected triples over a fixed vocabulary crossed with operand shapes; they witness the
// closure's mappings and are not a completeness argument.
import { spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-push-closure-'));
const directory = join(base, 'repo');
const env = {
  ...nativeOracleBaseEnv(),
  HOME: base,
  XDG_CONFIG_HOME: base,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_COUNT: '0',
  GIT_TERMINAL_PROMPT: '0',
  LC_ALL: 'C',
  GIT_PAGER: 'cat',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.test',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.test',
};
/** Execute native Git with file-backed empty stdin and report abnormal termination. */
function git(args, cwd = directory) {
  const input = openSync(join(base, 'oracle-stdin'), 'r');
  try {
    const result = spawnSync('git', args, { cwd, env, stdio: [input, 'pipe', 'pipe'], encoding: 'utf8', timeout: 60000 });
    if (result.error || result.signal) throw result.error ?? new Error(`Git terminated: ${result.signal}`);
    return result;
  } finally {
    closeSync(input);
  }
}
const operand = (value) => ({ operand: value });
/** Spell tokens without importing production serialization: long values attach with '='. */
const serialize = (tokens) =>
  tokens.flatMap((token) =>
    !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : token[0].startsWith('--') ? [`${token[0]}=${token[1]}`] : token,
  );
/** Argument refusals these cases may reach in Git 2.55.0. */
const REFUSALS = [
  /^fatal: options '.*' and '.*' cannot be used together$/,
  /^fatal: options '.*', '.*', and '.*' cannot be used together$/,
  /^fatal: --delete doesn't make sense without any refs$/,
  /^fatal: push options must not have new line characters$/,
  /^fatal: --all can't be combined with refspecs$/,
  /^fatal: --mirror can't be combined with refspecs$/,
  /^fatal: tag shorthand without <tag>$/,
  // parse_refspec reads every refspec word, or the refspec a tag shorthand or a deleted name
  // expands to, from argv alone before any transport (push-refspecs.ts).
  /^fatal: invalid refspec '.*'$/,
  /^fatal: --delete only accepts plain target ref names$/,
  /^fatal: bad (?:recurse-submodules|signed) argument: .*$/,
  /^error: (?:option|switch) `[^']*' (?:takes no value|requires a value)$/,
];
/** Refusals decided by configuration, remote state or ref lookup; the wrapper leaves them to Git. */
const STATE = [
  /^fatal: --atomic can only be used when pushing to one remote$/,
  /^error: unable to delete '.*': remote ref does not exist$/,
  /^error: src refspec .* does not match any$/,
  /^error: failed to push some refs to '.*'$/,
  /^fatal: '.*' does not appear to be a git repository$/,
  /^error: dst refspec .* matches more than one$/,
  /^error: The destination you provided is not a full refname .*$/,
];
// --dry-run precedes every case, so only argument checks and ref matching run.
const MODES = [
  [], [['--delete']], [['-d']], [['--no-delete']], [['--tags']], [['--no-tags']], [['--all']], [['--branches']],
  [['--no-all']], [['--mirror']], [['--no-mirror']],
];
const MODIFIERS = [
  [], [['--atomic']], [['-o', 'ok']], [['-o', 'a\nb']], [['--push-option', 'x\n']], [['-o', 'a\nb'], ['--no-push-option']],
  [['--no-push-option'], ['-o', 'a\nb']], [['--force-with-lease']], [['--force-with-lease', 'main']], [['--force']],
  [['--recurse-submodules', 'check']], [['--recurse-submodules', 'only-is-on-demand']], [['--recurse-submodules', 'yes']],
  [['--signed', 'no']], [['--signed', 'maybe']], [['--follow-tags']], [['--prune']], [['-u']], [['--porcelain']],
];
const OPERANDS = [
  [], [operand('origin')], [operand('origin'), operand('main')], [operand('origin'), operand('tag')],
  [operand('origin'), operand('tag'), operand('v1')], [operand('origin'), operand('main'), operand('tag')],
  [operand('origin'), operand('tag'), operand('tag')], [operand('origin'), operand('tag'), operand('main:main')],
  [operand('origin'), operand('main:main')], [operand('origin'), operand(':main')], [operand('origin'), operand('')],
  [operand('origin'), operand('main'), operand('')], [operand('both')], [operand('both'), operand('main')],
  [operand('../origin.git'), operand('main')], [operand('origin'), operand('tag'), operand('')],
  [operand('origin'), operand('tag'), operand('v*')], [operand('origin'), operand('bad name')],
];
try {
  await writeFile(join(base, 'oracle-stdin'), '');
  await mkdir(directory);
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  for (const [args, cwd] of [
    [['init', '-q', '-b', 'main', '--bare', 'origin.git'], base],
    [['init', '-q', '-b', 'main', '--bare', 'second.git'], base],
    [['config', 'receive.advertisePushOptions', 'true'], join(base, 'origin.git')],
    [['config', 'receive.advertisePushOptions', 'true'], join(base, 'second.git')],
    [['init', '-qb', 'main']],
    [['commit', '-q', '--allow-empty', '-m', 'one']],
    [['tag', 'v1']],
    [['tag', 'tag']],
    [['remote', 'add', 'origin', '../origin.git']],
    [['remote', 'add', 'second', '../second.git']],
    [['config', 'remotes.both', 'origin second']],
    [['push', '-q', '-u', 'origin', 'main', 'v1']],
  ]) {
    if (git(args, cwd).status !== 0) throw new Error(`Cannot seed oracle: ${args.join(' ')}`);
  }
  const cases = [];
  const unclassified = new Map();
  const record = (rest) => {
    const tokens = [['--dry-run'], ...rest];
    const argv = ['push', ...serialize(tokens)];
    const result = git(argv);
    const output = `${result.stderr}`.split('\n');
    const diagnostic = output.find((line) => /^(usage|fatal|error):/.test(line)) ?? '';
    const valid = result.status === 0 && !diagnostic;
    const state = !valid && STATE.some((p) => p.test(diagnostic));
    if (!valid && !state && !REFUSALS.some((p) => p.test(diagnostic))) {
      unclassified.set(diagnostic || `${result.status}: ${result.stderr}`, argv);
      return;
    }
    cases.push({ command: 'push', tokens, argv, valid, state, status: result.status, diagnostic });
  };
  const sequences = [];
  for (const a of MODES) for (const b of MODES) for (const o of OPERANDS) sequences.push([...a, ...b, ...o]);
  for (const a of MODES) for (const m of MODIFIERS) for (const o of OPERANDS) sequences.push([...a, ...m, ...o]);
  for (const m of MODIFIERS) for (const n of MODIFIERS) for (const o of OPERANDS.slice(0, 3)) sequences.push([...m, ...n, ...o]);
  const unique = new Map(sequences.map((tokens) => [JSON.stringify(tokens), tokens]));
  for (const tokens of unique.values()) record(tokens);
  if (unclassified.size) {
    throw new Error(`Unclassified outcomes:\n${[...unclassified].map(([d, argv]) => `${JSON.stringify(argv)}: ${d}`).join('\n')}`);
  }
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; one repository on main with tags v1 and tag, remotes origin (main and v1 pushed, upstream of main) and second as local bare repositories that advertise push options, and the remote group both = origin second; every case starts with --dry-run; mode pairs and mode-modifier pairs crossed with eighteen operand shapes, modifier pairs with up to two operands; empty file-backed stdin',
      cases,
    },
    null,
    2,
  )}\n`;
  const target = new URL('test/fixtures/push-closure-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('push-closure-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} independent push closure outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

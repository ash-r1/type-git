// Independent native oracle for the pull completion closure (docs/design/audit-completion.md).
// cmd_pull parses its own options (the --rebase and --recurse-submodules callbacks and the
// final --cleanup check), then forwards its fetch options, repository and refspec words to
// fetch, where --all with a repository and an unfinished tag shorthand are refused. Every
// case starts with --dry-run, so pull returns after the fetch and never merges or rebases.
// Cases are option pairs crossed with operand shapes; they witness the closure's mappings and
// are not a completeness argument.
import { spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-pull-closure-'));
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
  /^fatal: Invalid cleanup mode .*$/,
  /^error: unknown option `[^']*'$/,
  /^error: invalid value for '--rebase': '.*'$/,
  /^fatal: bad recurse-submodules argument: .*$/,
  /^error: (?:option|switch) `[^']*' (?:takes no value|requires a value|expects a numerical value)$/,
  /^fatal: fetch --all does not take a repository argument$/,
  /^fatal: you need to specify a tag name$/i,
  /^fatal: fetch --all does not make sense with refspecs$/,
  /^error: option `deepen' expects an integer value with an optional k\/m\/g suffix$/,
  /^fatal: options '.*' and '.*' cannot be used together$/,
  /^fatal: negative depth in --deepen is not supported$/,
  /^fatal: depth .* is not a positive number$/,
  /^fatal: --depth and --unshallow cannot be used together$/,
];
/** Refusals decided by configuration, remote state or ref lookup; the wrapper leaves them to Git. */
const STATE = [
  /^fatal: '.*' does not appear to be a git repository$/,
  /^fatal: couldn't find remote ref .*$/,
  /^fatal: --unshallow on a complete repository does not make sense$/,
  /^fatal: invalid refspec '.*'$/,
];
// --dry-run precedes every case, so pull stops after the fetch.
const OPTIONS = [
  [], [['--rebase']], [['-r']], [['--no-rebase']], [['--rebase', 'false']], [['--rebase', 'merges']],
  [['--rebase', 'interactive']], [['--rebase', 'bad']], [['--rebase', '']], [['--ff']], [['--no-ff']], [['--ff-only']],
  [['--cleanup', 'strip']], [['--cleanup', 'scissors']], [['--cleanup', 'Strip']], [['--cleanup', '']],
  [['--cleanup', 'bad'], ['--cleanup', 'default']], [['--squash']], [['--no-commit']],
  [['--recurse-submodules', 'on-demand']], [['--recurse-submodules', 'bad']], [['--no-recurse-submodules']],
  [['--all']], [['--no-all']], [['--tags']], [['-q']], [['--deepen', '1']], [['--deepen', 'x']], [['--depth', '1']],
  [['--unshallow']], [['-h']],
  // Abbreviations, short clusters and a detached value option are literal words, which the
  // wrapper refuses as operands.
  [operand('--reb')], [operand('--cl=strip')], [operand('-qv')], [operand('-rq')], [operand('--no-ff-only')],
  [operand('--cleanup')],
];
const OPERANDS = [
  [], [operand('origin')], [operand('origin'), operand('main')], [operand('origin'), operand('tag')],
  [operand('origin'), operand('tag'), operand('v1')], [operand('origin'), operand('main'), operand('tag')],
  [operand('origin'), operand('tag'), operand('tag')], [operand('tag')], [operand('origin'), operand('main:main')],
  [['--'], operand('origin'), operand('main')],
];
try {
  await writeFile(join(base, 'oracle-stdin'), '');
  if (git(['--version'], base).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  await mkdir(join(base, 'seed'));
  for (const [args, cwd] of [
    [['init', '-q', '--bare', 'origin.git'], base],
    [['init', '-qb', 'main'], join(base, 'seed')],
    [['commit', '-q', '--allow-empty', '-m', 'one'], join(base, 'seed')],
    [['tag', 'v1'], join(base, 'seed')],
    [['tag', 'tag'], join(base, 'seed')],
    [['push', '-q', '../origin.git', 'main', '--tags'], join(base, 'seed')],
    [['clone', '-q', 'origin.git', 'repo'], base],
  ]) {
    if (git(args, cwd).status !== 0) throw new Error(`Cannot seed oracle: ${args.join(' ')}`);
  }
  const cases = [];
  const unclassified = new Map();
  const record = (rest, dryRun = true) => {
    const tokens = dryRun ? [['--dry-run'], ...rest] : rest;
    const argv = ['pull', ...serialize(tokens)];
    const result = git(argv);
    const diagnostic = `${result.stderr}`.split('\n').find((line) => /^(fatal|error):/.test(line)) ?? '';
    // A help exit prints usage on stdout and is an accepted invocation, as in the other oracles.
    const usage = result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr;
    const valid = (result.status === 0 && !diagnostic) || usage;
    const state = !valid && STATE.some((p) => p.test(diagnostic));
    if (!valid && !state && !REFUSALS.some((p) => p.test(diagnostic))) {
      unclassified.set(diagnostic || `${result.status}: ${result.stderr}`, argv);
      return;
    }
    cases.push({ command: 'pull', tokens, argv, valid, state, usage, status: result.status, diagnostic });
  };
  const sequences = [];
  for (const a of OPTIONS) for (const o of OPERANDS) sequences.push([...a, ...o]);
  for (const a of OPTIONS) for (const b of OPTIONS) for (const o of OPERANDS.slice(0, 4)) sequences.push([...a, ...b, ...o]);
  const unique = new Map(sequences.map((tokens) => [JSON.stringify(tokens), tokens]));
  for (const tokens of unique.values()) record(tokens);
  // The completion helpers exit before any fetch, and only as the single argument.
  for (const word of ['--git-completion-helper', '--git-completion-helper-all']) record([[word]], false);
  if (unclassified.size) {
    throw new Error(`Unclassified outcomes:\n${[...unclassified].map(([d, argv]) => `${JSON.stringify(argv)}: ${d}`).join('\n')}`);
  }
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; a clone of a local bare origin with main and tags v1 and tag, on main tracking origin/main; every case starts with --dry-run; single options crossed with ten operand shapes, option pairs with up to two operands; the two completion helpers alone; empty file-backed stdin',
      cases,
    },
    null,
    2,
  )}\n`;
  const target = new URL('test/fixtures/pull-closure-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('pull-closure-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} independent pull closure outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

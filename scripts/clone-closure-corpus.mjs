// Independent native oracle for the clone completion closure (docs/design/audit-completion.md).
// cmd_clone refuses its operand count, an unknown ref storage format, --bare (or --mirror)
// with --separate-git-dir and --bundle-uri with a shallow option, then checks the repository
// and the final depth, the destination, --recursive with both reference kinds,
// --also-filter-submodules without --filter or --recurse-submodules, the --config keys, the
// remote name and --revision with --branch or --mirror. Every case clones a local bare
// repository into a fresh directory. Cases are singles and pairs over a fixed vocabulary crossed
// with operand shapes. --config values of keys outside git_clone_config are left out, because
// their grammars belong to the configuration readers. The cases witness the closure's mappings
// and are not a completeness argument.
import { spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-clone-closure-'));
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
function git(args, cwd = base) {
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
  /^fatal: Too many arguments\.$/,
  /^fatal: You must specify a repository to clone\.$/,
  /^fatal: unknown ref storage format '.*'$/,
  /^fatal: options '.*' and '.*' cannot be used together$/,
  /^fatal: depth .* is not a positive number$/,
  /^fatal: clone --recursive is not compatible with both --reference and --reference-if-able$/,
  /^fatal: the option '.*' requires '.*'$/,
  /^fatal: '.*' is not a valid remote name$/,
  /^error: key does not contain a section: .*$/,
  /^error: invalid key: .*$/,
  /^error: missing value for '.*'$/,
  /^fatal: bad boolean config value '.*' for '.*'$/,
  /^error: (?:option|switch) `[^']*' (?:takes no value|requires a value)$/,
  /^error: invalid filter-spec '.*'$/,
  /^fatal: invalid filter-spec '.*'$/,
];
/** Refusals decided by the filesystem or the source repository; the wrapper leaves them to Git. */
const STATE = [
  /^fatal: repository '.*' does not exist$/,
  /^fatal: destination path '.*' already exists and is not an empty directory\.$/,
  /^fatal: Remote branch .* not found in upstream .*$/,
  /^fatal: Remote revision .* not found in upstream .*$/,
  // --branch with --mirror maps a tag twice when the source has tags (write_remote_refs).
  /^fatal: multiple updates for ref '.*' not allowed$/,
];
const SOURCE = '../origin.git';
// Each word below is a final value or flag; pairs show the last-wins and cross-option rules.
const OPTIONS = [
  [], [['--bare']], [['--no-bare']], [['--mirror']], [['--separate-git-dir', 'sep']], [['--no-checkout']],
  [['--origin', 'up']], [['--origin', 'up/stream']], [['--origin', 'a b']], [['--origin', 'x.lock']],
  [['--origin', '']], [['-o', '.x']], [['--origin', 'a:b']], [['--origin', 'a b'], ['--no-origin']],
  [['--ref-format', 'files']], [['--ref-format', 'bad']], [['--depth', '1']], [['--depth', '0']], [['--depth', 'x']],
  [['--shallow-since', '2000-01-01']], [['--bundle-uri', 'none.bundle']], [['--revision', 'main']],
  [['--branch', 'main']], [['--branch', 'nope']], [['--filter', 'blob:none']], [['--also-filter-submodules']],
  [['--recurse-submodules']], [['--recursive']], [['--no-recurse-submodules']], [['--reference', SOURCE]],
  [['--reference-if-able', SOURCE]], [['--no-reference']], [['--single-branch']], [['-h']], [['--help-all']],
  [['-c', 'a=b']], [['-c', 'a.1b=x']], [['-c', 'a.b']], [['--config', 'sec.sub.var=1']], [['-c', '.x.y=1']],
  [['-c', 'a=b'], ['--no-config']], [['-c', 'clone.defaultRemoteName=up']],
  [['-c', 'clone.defaultRemoteName=a b']], [['-c', 'clone.defaultRemoteName']],
  [['-c', 'Clone.RejectShallow=maybe']], [['-c', 'clone.filterSubmodules=1k']],
  [['-c', 'clone.filterSubmodules=maybe']],
];
const OPERANDS = [
  [], [operand(SOURCE)], [operand(SOURCE), operand('dst')], [operand(SOURCE), operand('dst'), operand('extra')],
  [operand('missing'), operand('dst')], [operand(SOURCE), operand('full')],
];
try {
  await writeFile(join(base, 'oracle-stdin'), '');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  await mkdir(join(base, 'seed'));
  for (const [args, cwd] of [
    [['init', '-q', '-b', 'main', '--bare', 'origin.git'], base],
    [['init', '-qb', 'main'], join(base, 'seed')],
    [['commit', '-q', '--allow-empty', '-m', 'one'], join(base, 'seed')],
    [['tag', 'v1'], join(base, 'seed')],
    [['push', '-q', '../origin.git', 'main', '--tags'], join(base, 'seed')],
  ]) {
    if (git(args, cwd).status !== 0) throw new Error(`Cannot seed oracle: ${args.join(' ')}`);
  }
  const cases = [];
  const unclassified = new Map();
  let serial = 0;
  const record = async (tokens) => {
    const argv = ['clone', ...serialize(tokens)];
    // A fresh working directory per case, with a nonempty 'full' destination beside the source.
    const cwd = join(base, `case-${serial++}`);
    await mkdir(join(cwd, 'full'), { recursive: true });
    await writeFile(join(cwd, 'full', 'file'), '');
    const result = git(argv, cwd);
    await rm(cwd, { recursive: true, force: true });
    const diagnostic = `${result.stderr}`.split('\n').find((line) => /^(fatal|error):/.test(line)) ?? '';
    // A help exit prints usage on stdout and is an accepted invocation, as in the other oracles.
    const usage = result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr;
    const valid = (result.status === 0 && !diagnostic) || usage;
    const state = !valid && STATE.some((p) => p.test(diagnostic));
    if (!valid && !state && !REFUSALS.some((p) => p.test(diagnostic))) {
      unclassified.set(diagnostic || `${result.status}: ${result.stderr}`, argv);
      return;
    }
    cases.push({ command: 'clone', tokens, argv, valid, state, status: result.status, diagnostic });
  };
  const sequences = [];
  for (const a of OPTIONS) for (const o of OPERANDS) sequences.push([...a, ...o]);
  for (const a of OPTIONS) for (const b of OPTIONS) sequences.push([...a, ...b, ...OPERANDS[1]]);
  // --recursive with both reference kinds in every order, alone or followed by a negation.
  const references = [[['--reference', SOURCE]], [['--reference-if-able', SOURCE]], [['--recurse-submodules']]];
  const clears = [[['--no-reference']], [['--no-reference-if-able']], [['--no-recurse-submodules']]];
  for (const clear of [[], ...clears]) {
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
      sequences.push([...references[a], ...references[b], ...references[c], ...clear, ...OPERANDS[1]]);
    }
  }
  // A negation followed by the same option again restores it.
  for (const [i, clear] of clears.entries()) {
    sequences.push([...references[0], ...references[1], ...references[2], ...clear, ...references[i], ...OPERANDS[1]]);
  }
  const unique = new Map(sequences.map((tokens) => [JSON.stringify(tokens), tokens]));
  for (const tokens of unique.values()) await record(tokens);
  if (unclassified.size) {
    throw new Error(`Unclassified outcomes:\n${[...unclassified].map(([d, argv]) => `${JSON.stringify(argv)}: ${d}`).join('\n')}`);
  }
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; a local bare origin.git with main and tag v1; each case runs in a fresh directory beside it that holds a nonempty directory full; single options crossed with six operand shapes, option pairs with the source alone, and --recursive with both reference kinds in all six orders, alone, followed by --no-reference, --no-reference-if-able or --no-recurse-submodules, or followed by such a negation and the negated option again; empty file-backed stdin',
      cases,
    },
    null,
    2,
  )}\n`;
  const target = new URL('test/fixtures/clone-closure-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('clone-closure-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} independent clone closure outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

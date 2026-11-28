// Independent native oracle for the fetch completion closure (docs/design/audit-completion.md).
// cmd_fetch refuses recursion with --negotiate-only or --porcelain, the deepen/depth/unshallow
// combinations and a nonpositive depth, then selects --all, the default remote, --multiple
// remotes, a group or a single remote, refuses single-remote options for several remotes and,
// in fetch_one, an unfinished tag shorthand. Every case is a dry run against local bare
// remotes. Cases are singles and pairs over a fixed vocabulary crossed with operand shapes;
// they witness the closure's mappings and are not a completeness argument.
import { spawnSync } from 'node:child_process';
import { closeSync, cpSync, openSync, rmSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-fetch-closure-'));
const directory = join(base, 'repo');
// Each case starts from a copy of the seeded clone: a dry run can still update .git/shallow.
const pristine = join(base, 'pristine');
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
  /^fatal: negative depth in --deepen is not supported$/,
  /^fatal: depth .* is not a positive number$/,
  /^fatal: fetch --all does not take a repository argument$/,
  /^fatal: fetch --all does not make sense with refspecs$/,
  /^fatal: must supply remote when using --negotiate-only$/,
  /^fatal: --filter can only be used with the remote configured in extensions\.partialclone$/,
  /^fatal: --atomic can only be used when fetching from one remote$/,
  /^fatal: --stdin can only be used when fetching from one remote$/,
  /^fatal: you need to specify a tag name$/,
  // parse_refspec reads every refspec word, or the refspec a tag shorthand or a deleted name
  // expands to, from argv alone before any transport (push-refspecs.ts).
  /^fatal: invalid refspec '.*'$/,
  /^fatal: bad recurse-submodules argument: .*$/,
  /^error: (?:option|switch) `[^']*' (?:takes no value|requires a value|expects a numerical value)$/,
];
/** Refusals decided by configuration, repository state or ref lookup; left to native Git. */
const STATE = [
  /^fatal: --unshallow on a complete repository does not make sense$/,
  /^fatal: no such remote or remote group: .*$/,
  /^fatal: fetching a group and specifying refspecs does not make sense$/,
  /^fatal: --negotiate-only needs one or more --negotiation-restrict=\*$/,
  /^fatal: --refmap option is only meaningful with command-line refspec\(s\)$/,
  /^fatal: couldn't find remote ref .*$/,
  /^fatal: '.*' does not appear to be a git repository$/,
  /^error: could not fetch .*$/,
  // The transport chosen for the remote parses the depth again (transport.c set_git_option).
  /^fatal: transport: invalid depth option '.*'$/,
  /^fatal: expected 'acknowledgments', received '.*'$/,
];
/** Single-remote refusals; with --all or a group the remotes come from configuration. */
const GROUPED = [
  /^fatal: must supply remote when using --negotiate-only$/,
  /^fatal: --filter can only be used with the remote configured in extensions\.partialclone$/,
  /^fatal: --atomic can only be used when fetching from one remote$/,
  /^fatal: --stdin can only be used when fetching from one remote$/,
];
// --dry-run precedes every case, so nothing is written.
const MODES = [
  [], [['--all']], [['--no-all']], [['--multiple']], [['-m']], [['--negotiate-only']], [['--porcelain']], [['--stdin']],
  [['--atomic']], [['--filter', 'blob:none']], [['--refmap', 'refs/heads/*:refs/x/*']],
];
const MODIFIERS = [
  [], [['--recurse-submodules']], [['--recurse-submodules', 'yes']], [['--recurse-submodules', 'on-demand']],
  [['--recurse-submodules', 'no']], [['--no-recurse-submodules']], [['--recurse-submodules', 'bogus']],
  [['--depth', '1']], [['--depth', '']], [['--depth', '0']], [['--depth', ' 2x']], [['--deepen', '1']], [['--deepen', '0']],
  [['--deepen', '-1']], [['--unshallow']], [['--negotiation-restrict', 'main']], [['--no-negotiation-restrict']], [['-P']],
];
const OPERANDS = [
  [], [operand('origin')], [operand('origin'), operand('main')], [operand('origin'), operand('tag')],
  [operand('origin'), operand('tag'), operand('v1')], [operand('origin'), operand('main'), operand('tag')],
  [operand('origin'), operand('tag'), operand('tag')], [operand('origin'), operand('second')], [operand('both')],
  [operand('both'), operand('main')], [operand('../origin.git'), operand('main')],
  [operand('origin'), operand('tag'), operand('')], [operand('origin'), operand('tag'), operand('a:b')],
  [operand('origin'), operand('bad name')],
];
try {
  await writeFile(join(base, 'oracle-stdin'), '');
  await mkdir(join(base, 'work'));
  if (git(['--version'], base).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  for (const [args, cwd] of [
    [['init', '-q', '-b', 'main', '--bare', 'origin.git'], base],
    [['init', '-q', '-b', 'main', '--bare', 'second.git'], base],
    [['init', '-qb', 'main'], join(base, 'work')],
    [['commit', '-q', '--allow-empty', '-m', 'one'], join(base, 'work')],
    [['tag', 'v1'], join(base, 'work')],
    [['tag', 'tag'], join(base, 'work')],
    [['push', '-q', '--tags', '../origin.git'], join(base, 'work')],
    [['push', '-q', '../origin.git', 'main'], join(base, 'work')],
    [['push', '-q', '../second.git', 'main'], join(base, 'work')],
    [['clone', '-q', 'origin.git', 'repo'], base],
    [['remote', 'add', 'second', '../second.git']],
    [['config', 'remotes.both', 'origin second']],
  ]) {
    if (git(args, cwd).status !== 0) throw new Error(`Cannot seed oracle: ${args.join(' ')}`);
  }
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD', '@{upstream}']).stdout.trim().split('\n');
  if (branch.join(' ') !== 'main origin/main') throw new Error(`Unexpected seed branch: ${branch.join(' ')}`);
  cpSync(directory, pristine, { recursive: true });
  const cases = [];
  const unclassified = new Map();
  const record = (rest) => {
    const tokens = [['--dry-run'], ...rest];
    const argv = ['fetch', ...serialize(tokens)];
    rmSync(directory, { recursive: true, force: true });
    cpSync(pristine, directory, { recursive: true });
    const result = git(argv);
    const output = `${result.stderr}`.split('\n');
    const diagnostic = output.find((line) => /^(usage|fatal|error):/.test(line)) ?? '';
    const valid = result.status === 0 && !diagnostic;
    // Without --multiple, several remotes come from --all or a remote group in configuration.
    const multiple = argv.includes('--multiple') || argv.includes('-m');
    const state = !valid && (STATE.some((p) => p.test(diagnostic)) || (!multiple && GROUPED.some((p) => p.test(diagnostic))));
    if (!valid && !state && !REFUSALS.some((p) => p.test(diagnostic))) {
      unclassified.set(diagnostic || `${result.status}: ${result.stderr}`, argv);
      return;
    }
    cases.push({ command: 'fetch', tokens, argv, valid, state, status: result.status, diagnostic });
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
        'Git 2.55.0; a complete clone of a local bare origin (main and tags v1 and tag) with a second local bare remote and the remote group both = origin second; each case runs on a fresh copy of that clone and starts with --dry-run; mode pairs and mode-modifier pairs crossed with fourteen operand shapes, modifier pairs with up to two operands; empty file-backed stdin',
      cases,
    },
    null,
    2,
  )}\n`;
  const target = new URL('test/fixtures/fetch-closure-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('fetch-closure-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} independent fetch closure outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

// Independent native oracle for the branch completion closure (docs/design/audit-completion.md).
// cmd_branch counts its non-create actions after option parsing and prints usage when more
// than one is selected; filters imply listing, and the remaining operands decide between
// creation and usage. Every case runs in a fresh copy of one seed repository, so actions
// really execute. Cases are singles and pairs over a fixed vocabulary crossed with operand
// shapes; they witness the closure's mappings and are not a completeness argument.
import { spawnSync } from 'node:child_process';
import { closeSync, cpSync, openSync, rmSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-branch-closure-'));
const seed = join(base, 'seed');
const directory = join(base, 'repo');
const env = {
  ...nativeOracleBaseEnv(),
  HOME: base,
  XDG_CONFIG_HOME: base,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_COUNT: '0',
  LC_ALL: 'C',
  GIT_PAGER: 'cat',
  GIT_EDITOR: 'true',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.test',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.test',
};
/** Execute native Git with file-backed empty stdin and report abnormal termination. */
function git(args, cwd = directory, extra = {}) {
  const input = openSync(join(base, 'oracle-stdin'), 'r');
  try {
    const result = spawnSync('git', args, { cwd, env: { ...env, ...extra }, stdio: [input, 'pipe', 'pipe'], encoding: 'utf8', timeout: 60000 });
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
  /^usage: git branch /,
  /^fatal: --recurse-submodules can only be used to create branches$/,
  /^fatal: branch with --recurse-submodules can only be used if submodule\.propagateBranches is enabled$/,
  /^fatal: options '--column' and '--verbose' cannot be used together$/,
  /^fatal: branch name required$/,
  /^fatal: cannot edit description of more than one branch$/,
  /^fatal: too many branches for a copy operation$/,
  /^fatal: too many arguments for a rename operation$/,
  /^fatal: too many arguments to set new upstream$/,
  /^fatal: too many arguments to unset upstream$/,
  /^fatal: the -a, and -r, options to 'git branch' do not take a branch name\.$/,
  /^fatal: the '--set-upstream' option is no longer supported\. Please use '--track' or '--set-upstream-to' instead$/,
  /^fatal: cannot use -a with -d$/,
  /^error: (?:option|switch) `[^']*' (?:takes no value|requires a value)$/,
];
/** Name-syntax refusals the closure leaves open (branch-name-syntax); no case should reach them. */
const NAME_SYNTAX = [/^fatal: '.*' is not a valid branch name$/, /^fatal: invalid branch name: '.*'$/];
/** Refusals decided by repository state for these operands; the wrapper leaves them to Git. */
const STATE = [
  /^fatal: a branch named '.*' already exists$/,
  /^fatal: (?:no branch named|branch) '.*'(?: not found| does not exist)?\.?$/,
  /^error: branch '.*' not found\.?$/,
  /^error: no branch named '.*'$/,
  /^error: remote-tracking branch '.*' not found\.?$/,
  /^fatal: no such branch '.*'$/,
  /^fatal: branch '.*' has no upstream information$/,
  /^fatal: not a valid object name: '.*'$/,
  // A bare --merged or --contains followed by another word takes it as the object name.
  /^(?:fatal|error): malformed object name .*$/,
  /^error: cannot delete branch '.*' used by worktree at '.*'$/,
  /^error: the branch '.*' is not fully merged\.?$/,
  /^fatal: cannot (?:copy|rename) the current branch while not on any\.?$/,
  /^fatal: the requested upstream branch '.*' does not exist$/,
  /^fatal: cannot set up tracking information; starting point '.*' is not a branch$/,
  /^fatal: no commit on branch '.*' yet$/,
];
const ACTIONS = [
  [], [['-d']], [['--delete']], [['-D']], [['--no-delete']], [['-m']], [['--move']], [['-M']], [['--no-move']],
  [['-c']], [['--copy']], [['-C']], [['--no-copy']], [['-l']], [['--no-list']], [['--show-current']],
  [['--no-show-current']], [['--edit-description']], [['--no-edit-description']], [['-u', 'main']],
  [['-u', '']], [['--no-set-upstream-to']], [['--unset-upstream']], [['--no-unset-upstream']],
];
const MODIFIERS = [
  [], [['-a']], [['-r']], [['-f']], [['--recurse-submodules']], [['--set-upstream']], [['-t']],
  [['-v']], [['--verbose'], ['--verbose']], [['--no-verbose']], [['--column']], [['--column', 'always']], [['--column', 'never']],
  [['--column', 'auto']], [['--column', 'row']], [['--column', 'plain']], [['--no-column']], [['--merged', 'HEAD']], [['--points-at', 'HEAD']], [['--contains', 'HEAD']],
  [['--no-merged', 'HEAD']], [['--no-contains', 'HEAD']],
  [['--track', 'direct']], [['--track', 'inherit']], [['--no-track']], [['--no-recurse-submodules']],
  [['--create-reflog']], [['-q']], [['--format', '%(refname)']], [['--sort', 'refname']],
];
const OPERANDS = [[], [operand('new')], [operand('topic')], [operand('topic'), operand('new')], [operand('a'), operand('b'), operand('c')]];
try {
  await writeFile(join(base, 'oracle-stdin'), '');
  await mkdir(seed);
  if (git(['--version'], seed).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  for (const args of [
    ['init', '-qb', 'main'],
    ['commit', '-q', '--allow-empty', '-m', 'one'],
    ['branch', 'topic'],
    ['commit', '-q', '--allow-empty', '-m', 'two'],
    ['branch', 'feature'],
    ['branch', '--set-upstream-to', 'main', 'feature'],
  ]) {
    if (git(args, seed).status !== 0) throw new Error(`Cannot seed oracle: ${args.join(' ')}`);
  }
  const cases = [];
  const unclassified = new Map();
  const record = (tokens) => {
    rmSync(directory, { recursive: true, force: true });
    cpSync(seed, directory, { recursive: true });
    const argv = ['branch', ...serialize(tokens)];
    // Explicit recursion is refused outright unless submodule.propagateBranches is set, so
    // those cases run with it set to reach the argv checks behind it.
    const recurse = argv.includes('--recurse-submodules');
    const config = recurse ? { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'submodule.propagateBranches', GIT_CONFIG_VALUE_0: 'true' } : {};
    const result = git(argv, directory, config);
    const output = `${result.stderr}`.split('\n');
    const diagnostic = output.find((line) => /^(usage|fatal|error):/.test(line)) ?? '';
    // Help output goes to stdout with exit 129; usage errors print usage to stderr.
    const valid = result.status === 0 && !diagnostic;
    if (NAME_SYNTAX.some((p) => p.test(diagnostic))) throw new Error(`Name syntax reached by ${JSON.stringify(argv)}`);
    const state = !valid && STATE.some((p) => p.test(diagnostic));
    if (!valid && !state && !REFUSALS.some((p) => p.test(diagnostic))) {
      unclassified.set(diagnostic || `${result.status}: ${result.stderr}`, argv);
      return;
    }
    cases.push({ command: 'branch', tokens, argv, ...(recurse ? { propagateBranches: true } : {}), valid, state, status: result.status, diagnostic });
  };
  const sequences = [];
  for (const a of ACTIONS) for (const b of ACTIONS) for (const o of OPERANDS) sequences.push([...a, ...b, ...o]);
  for (const a of ACTIONS) for (const m of MODIFIERS) for (const o of OPERANDS) sequences.push([...a, ...m, ...o]);
  for (const m of MODIFIERS) for (const n of MODIFIERS) for (const o of OPERANDS.slice(0, 2)) sequences.push([...m, ...n, ...o]);
  // A bare --merged or --contains defaults to HEAD only as the last word; otherwise it takes
  // the next word, even an option, as its object name.
  for (const bare of [[['--merged']], [['--contains']], [['--no-merged']], [['--no-contains']]]) {
    for (const next of [[], [['-a']], [['-d']], [['-v'], ['--column']], [operand('main')], [operand('HEAD')], [operand('topic'), operand('main')]]) {
      sequences.push([...bare, ...next], [...next, ...bare]);
    }
  }
  // A negation between two actions clears only its own bit (-D keeps bit 2 after --no-delete).
  const NEGATIONS = [[['--no-delete']], [['--no-move']], [['--no-copy']], [['--no-list']]];
  const positive = ACTIONS.filter((a) => a.length && !a[0][0].startsWith('--no-'));
  for (const a of positive) for (const n of NEGATIONS) for (const b of positive) sequences.push([...a, ...n, ...b]);
  const unique = new Map(sequences.map((tokens) => [JSON.stringify(tokens), tokens]));
  for (const tokens of unique.values()) record(tokens);
  if (unclassified.size) {
    throw new Error(`Unclassified outcomes:\n${[...unclassified].map(([d, argv]) => `${JSON.stringify(argv)}: ${d}`).join('\n')}`);
  }
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; fresh copy of a seed repository on main with branches topic (merged) and feature (tracking main) for every case; GIT_EDITOR=true; submodule.propagateBranches=true for cases with --recurse-submodules; action pairs and action-modifier pairs crossed with five operand shapes, modifier pairs with no operand or one, action-negation-action triples; empty file-backed stdin',
      cases,
    },
    null,
    2,
  )}\n`;
  const target = new URL('test/fixtures/branch-closure-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('branch-closure-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} independent branch closure outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

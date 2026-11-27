// Independent native oracle for the stash completion closures (docs/design/audit-completion.md).
// Each stash subcommand checks its operands and option combinations after parse_options in
// builtin/stash.c; several of those refusals are printed without an error: prefix and only
// return -1. Every case runs in a fresh copy of one seed repository that has two stash
// entries, local changes, an untracked file, a pathspec file and an exported stash chain, so
// accepted cases really execute. Cases are single words and pairs over fixed vocabularies
// crossed with operand shapes; they witness the closures' mappings and are not a
// completeness argument.
import { spawnSync } from 'node:child_process';
import { closeSync, cpSync, openSync, rmSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-stash-closure-'));
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
  GIT_AUTHOR_DATE: '2001-01-01T00:00:00Z',
  GIT_COMMITTER_DATE: '2001-01-01T00:00:00Z',
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
/**
 * Argument refusals these cases may reach in Git 2.55.0, each decided by argv alone. The
 * empty-reference refusals name the expansion of an empty operand, so they are matched
 * before the repository-state patterns below, which match the same message for real names.
 */
const REFUSALS = [
  /^Too many revisions specified:( '[^']*')+$/,
  /^error: refs\/stash@\{\} is not a valid reference$/,
  /^No branch name specified$/,
  /^fatal: '' is not a valid branch name$/,
  /^"git stash store" requires one <commit> argument$/,
  /^Cannot update refs\/stash with $/,
  /^fatal: a revision is required$/,
  /^error: not a valid revision: $/,
  /^error: exactly one of --print and --to-ref is required$/,
  /^error: unable to find stash entry $/,
  /^error: git stash clear with arguments is unimplemented$/,
  /^fatal: subcommand wasn't specified; 'push' can't be assumed due to unexpected token '.*'$/,
  /^fatal: options '--pathspec-from-file' and '--(?:patch|staged)' cannot be used together$/,
  /^fatal: '--pathspec-from-file' and pathspec arguments cannot be used together$/,
  /^fatal: the option '--(?:pathspec-file-nul|unified|inter-hunk-context|no-auto-advance)' requires '--(?:pathspec-from-file|patch)'$/,
  /^fatal: '--(?:unified|inter-hunk-context)' cannot be negative$/,
  /^Can't use --(?:patch|staged) and --include-untracked or --all at the same time$/,
  /^fatal: empty string is not a valid pathspec\. please use \. instead if you meant to match all paths$/,
  /^error: (?:option|switch) `[^']*' (?:takes no value|requires a value)$/,
  /^error: unknown (?:option|switch) `.*'$/,
];
/** Refusals decided by repository state, object resolution or interactive input. */
const STATE = [
  /^error: .* is not a valid reference$/,
  /^error: '.*' is not a stash reference$/,
  /^fatal: '.*' is not a stash-like commit$/,
  /^Cannot update refs\/stash with .+$/,
  /^error: not a valid revision: .+$/,
  /^error: .* is not a valid exported stash commit$/,
  /^error: unable to find stash entry .+$/,
  /^error: .* does not look like a stash commit$/,
  /^fatal: a branch named '.*' already exists$/,
  // NUL-separated pathspec files keep the newline in the pathspec, which then matches nothing.
  /^error: pathspec '/,
  /^error: Your local changes to the following files would be overwritten by (?:merge|checkout):$/,
  /^No staged changes$/,
  // Patch mode reads hunk choices from standard input, which is empty here.
  /^No changes selected$/,
];
/** Stash operand shapes: none, one, two, empty in each position and resolvable or not. */
const STASH_OPERANDS = [[], [operand('0')], [operand('0'), operand('1')], [operand('')], [operand('0'), operand('')], [operand(''), operand('0')], [operand('stash@{1}')], [operand('HEAD')], [operand('missing')]];
const PUSH_WORDS = [
  [], [['-p']], [['--no-patch']], [['-S']], [['--no-staged']], [['-u']], [['--no-include-untracked']], [['-a']], [['--no-all']],
  [['-k']], [['--no-keep-index']], [['-q']], [['-m', 'msg']], [['--pathspec-from-file', 'paths']], [['--pathspec-file-nul']],
  [['--no-pathspec-file-nul']], [['-U', '3']], [['--unified', '-2']], [['--inter-hunk-context', '1']],
  [['--inter-hunk-context', '-2']], [['--no-auto-advance']], [['--auto-advance']],
];
const PATHS = [[], [['--'], operand('tracked')], [operand('tracked')], [['--'], operand('')]];

try {
  await writeFile(join(base, 'oracle-stdin'), '');
  await mkdir(seed);
  if (git(['--version'], seed).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  const seedSteps = [
    ['init', '-qb', 'main'],
    ['add', 'tracked', 'paths', '.gitignore'],
    ['commit', '-qm', 'one'],
  ];
  await writeFile(join(seed, 'tracked'), 'one\n');
  await writeFile(join(seed, 'paths'), 'tracked\n');
  await writeFile(join(seed, '.gitignore'), 'ignored\n');
  for (const args of seedSteps) if (git(args, seed).status !== 0) throw new Error(`Cannot seed oracle: ${args.join(' ')}`);
  for (const content of ['two\n', 'three\n']) {
    await writeFile(join(seed, 'tracked'), content);
    if (git(['stash', 'push', '-qm', content.trim()], seed).status !== 0) throw new Error('Cannot seed stash entries');
  }
  const stashCommit = git(['rev-parse', 'stash@{0}'], seed).stdout.trim();
  for (const args of [['stash', 'export', '--to-ref', 'refs/exported'], ['tag', 'stashed', stashCommit]]) {
    if (git(args, seed).status !== 0) throw new Error(`Cannot seed oracle: ${args.join(' ')}`);
  }
  await writeFile(join(seed, 'tracked'), 'local\n');
  await writeFile(join(seed, 'untracked'), 'new\n');
  await writeFile(join(seed, 'ignored'), 'ignored\n');

  const cases = [];
  const unclassified = new Map();
  const seen = new Set();
  const record = (command, tokens) => {
    // Pairs with an empty word repeat single words; each sequence runs once.
    const key = JSON.stringify([command, tokens]);
    if (seen.has(key)) return;
    seen.add(key);
    rmSync(directory, { recursive: true, force: true });
    cpSync(seed, directory, { recursive: true });
    // Applying needs a tree without conflicting local changes, so those cases restore it first.
    if (['stash apply', 'stash pop', 'stash branch'].includes(command) && git(['checkout', '-q', '--', 'tracked']).status !== 0) {
      throw new Error('Cannot restore the tracked file');
    }
    const words = command === 'stash' ? [] : [command.slice('stash '.length)];
    const argv = ['stash', ...words, ...serialize(tokens)];
    const result = git(argv);
    const lines = `${result.stderr}`.split('\n').filter((line) => line && !/^(?:hint|warning): /.test(line));
    const diagnostic = lines.find((line) => /^(?:usage|fatal|error):/.test(line)) ?? lines[0] ?? '';
    const valid = result.status === 0;
    // store --quiet reports neither a wrong operand count nor an empty commit name, which never
    // resolves; both are still refused by argv alone.
    const commits = tokens.filter((token) => !Array.isArray(token)).map((token) => token.operand);
    const quietStore = command === 'stash store' && (commits.length !== 1 || commits[0] === '') && !valid && !diagnostic;
    const refused = !valid && (quietStore || REFUSALS.some((p) => p.test(diagnostic)));
    // Otherwise --quiet hides only state outcomes, such as nothing staged to stash.
    const quiet = !valid && !refused && !diagnostic && argv.includes('-q');
    const state = !valid && !refused && (quiet || STATE.some((p) => p.test(diagnostic)));
    if (!valid && !refused && !state) {
      unclassified.set(diagnostic || `${result.status}: ${result.stderr}`, argv);
      return;
    }
    cases.push({ command, tokens, argv, valid, state, status: result.status, diagnostic });
  };

  for (const command of ['stash apply', 'stash drop', 'stash pop', 'stash show']) {
    const options = command === 'stash apply' || command === 'stash pop' ? [[], [['--index']], [['-q']]] : [[], [['-q']]].slice(0, command === 'stash show' ? 1 : 2);
    for (const o of options) for (const s of STASH_OPERANDS) record(command, [...o, ...s]);
  }
  for (const s of [[], [operand('b')], [operand('b'), operand('0')], [operand('b'), operand('0'), operand('1')], [operand('')], [operand('b'), operand('')], [operand(''), operand('0')], [operand('main')]]) {
    record('stash branch', s);
  }
  for (const o of [[], [['-q']], [['-m', 'msg']]]) {
    for (const s of [[], [operand('stashed')], [operand('stashed'), operand('stashed')], [operand('')], [operand('HEAD')], [operand('missing')]]) record('stash store', [...o, ...s]);
  }
  for (const s of [[], [operand('refs/exported')], [operand('refs/exported'), operand('refs/exported')], [operand('')], [operand('HEAD')], [operand('missing')]]) {
    record('stash import', s);
  }
  const MODES = [[], [['--print']], [['--to-ref', 'refs/out']], [['--print'], ['--to-ref', 'refs/out']], [['--to-ref', 'refs/out'], ['--print']], [['--to-ref', 'refs/out'], ['--no-to-ref']], [['--to-ref', 'refs/out'], ['--no-to-ref'], ['--print']]];
  for (const m of MODES) for (const s of STASH_OPERANDS) record('stash export', [...m, ...s]);
  for (const s of [[], [operand('x')], [['--']], [operand('')], [['--'], operand('x')]]) record('stash clear', s);
  for (const command of ['stash push', 'stash save', 'stash']) {
    const paths = command === 'stash save' ? PATHS.slice(0, 1) : PATHS;
    const words = command === 'stash save' ? PUSH_WORDS.filter((w) => !w.length || !w[0][0].startsWith('--pathspec')) : PUSH_WORDS;
    for (const a of words) for (const b of words) for (const p of paths) record(command, [...a, ...b, ...p]);
  }
  if (unclassified.size) {
    throw new Error(`Unclassified outcomes:\n${[...unclassified].map(([d, argv]) => `${JSON.stringify(argv)}: ${d}`).join('\n')}`);
  }
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; fresh copy of a seed repository on main with two stash entries, a modified tracked file (restored for apply, pop and branch), an untracked and an ignored file, a pathspec file, an exported chain at refs/exported and a stash commit tagged stashed for every case; apply/drop/pop/show/export operand shapes with their options and export output modes, branch/store/import/clear arities, and push/save/assumed-push word pairs crossed with path shapes; empty file-backed stdin',
      cases,
    },
    null,
    2,
  )}\n`;
  const target = new URL('test/fixtures/stash-closure-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('stash-closure-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} independent stash closure outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

// Independent native oracle for new branch names (refs.c:check_branch_ref, reached through
// branch.c:validate_branchname). Every name is tried as a created branch and as the target of
// -m/-M/-c/-C with one and two operands, each in a fresh copy of one seed repository. The names
// cover every ASCII byte except NUL alone and between letters, and the structural rules of
// check_refname_format; they witness the mapping and are not a completeness argument.
import { spawnSync } from 'node:child_process';
import { closeSync, cpSync, openSync, rmSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-branch-name-'));
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
/** Name refusals of check_branch_ref as validate_branchname and copy_or_rename_branch report them. */
const NAME_SYNTAX = /^fatal: '[\s\S]*' is not a valid branch name$/;
/** Refusals decided by repository state: the name was interpreted against reflog or upstream. */
const STATE = [/^fatal: a branch named '.*' already exists$/, /^fatal: cannot force update the branch '.*' used by worktree at '.*'$/, /^fatal: cannot (?:copy|rename) the current branch while not on any\.?$/];

const bytes = [];
for (let code = 1; code < 128; code += 1) bytes.push(String.fromCharCode(code));
const NAMES = [
  ...bytes,
  ...bytes.map((character) => `a${character}b`),
  '', '.', '..', '...', 'a.', '.a', 'a..b', 'a.b', 'a/.b', 'a/b.', 'a./b', 'a/b', 'a//b', '/a', 'a/',
  'a.lock', 'a.lock/b', 'a/b.lock', 'a.locks', 'lock', '.lock', 'a.LOCK', 'a.lock.lock', 'a/.lock/b',
  '@', '@@', 'a@b', 'a@', '@a', 'a@{b', '@{', '@{}', 'a@{', '{', 'a{b}', '@{-1}', '@{-1}x', '@{-0}', '@{-x}',
  'topic@{u}', 'topic@{U}', 'topic@{upstream}', 'topic@{push}', '@{u}', 'x@{u}', 'a..b@{u}',
  // Interpreted names followed by literal text: @{-1} is topic, topic@{u} is main, @{u} is topic,
  // topic@{push} is mirror/topic.
  '@{-1}x', '@{- +01}x', '@{-1}..', '@{-1}x..', '@{-1}/x', '@{-1}/.x', '@{-1}.lock', '@{-1}:x', '@{-1}@{-1}',
  'topic@{u}x', 'topic@{U}/y', 'topic@{push}x', 'topic@{PUSH}..', 'topic@{Push}.LOCK', '@{-1}.LOCK', 'topic@{u}..', 'topic@{u}:', 'a:b@{u}', '@{u}..', 'topic@{u}@{x', '@{-1}x@{u}',
  'HEAD', 'head', 'x/HEAD', 'HEAD/x', 'HEADx', '-', '-a', 'a-', '--', 'é', 'aÿb', '日本',
  'refs/heads/x', 'refs', 'a*', '*', 'a/*', 'a/b/c', 'a.b.c', 'a/-b', 'a/@', '@/a',
];
const ACTIONS = [
  { label: 'create', tokens: (name) => [['--'], operand(name)] },
  ...['-m', '-M', '-c', '-C'].flatMap((flag) => [
    { label: `${flag} sole`, tokens: (name) => [[flag], ['--'], operand(name)] },
    { label: `${flag} pair`, tokens: (name) => [[flag], ['--'], operand('topic'), operand(name)] },
  ]),
];
try {
  await writeFile(join(base, 'oracle-stdin'), '');
  await mkdir(seed);
  if (git(['--version'], seed).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  for (const args of [
    ['init', '-qb', 'main'],
    ['commit', '-q', '--allow-empty', '-m', 'one'],
    ['branch', 'topic'],
    ['branch', '--set-upstream-to', 'main', 'topic'],
    ['branch', '--set-upstream-to', 'topic', 'main'],
    // A prior checkout makes @{-1} resolve to topic.
    ['checkout', '-q', 'topic'],
    ['checkout', '-q', 'main'],
    // topic@{push} is mirror/topic: remote "self" maps its branches under refs/heads/mirror/.
    ['remote', 'add', 'self', '.'],
    ['config', 'remote.self.fetch', '+refs/heads/*:refs/heads/mirror/*'],
    ['config', 'push.default', 'current'],
    ['config', 'branch.topic.pushRemote', 'self'],
  ]) {
    if (git(args, seed).status !== 0) throw new Error(`Cannot seed oracle: ${args.join(' ')}`);
  }
  const cases = [];
  for (const name of NAMES) {
    for (const action of ACTIONS) {
      rmSync(directory, { recursive: true, force: true });
      cpSync(seed, directory, { recursive: true });
      const tokens = action.tokens(name);
      const argv = ['branch', ...tokens.flatMap((token) => (Array.isArray(token) ? token : [token.operand]))];
      const result = git(argv);
      const diagnostic = result.stderr.split('\n').find((line) => /^(usage|fatal|error):/.test(line)) ?? '';
      const valid = result.status === 0 && !diagnostic;
      const refused = !valid && NAME_SYNTAX.test(result.stderr.trim().split('\nhint:')[0] ?? '');
      // Interpreting @{...} (reflog, upstream, push) can fail on repository state before the check.
      const state = !valid && !refused && (STATE.some((pattern) => pattern.test(diagnostic)) || name.includes('@{'));
      if (!valid && !refused && !state) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.stderr}`);
      // Worktree paths in diagnostics come from the temporary directory.
      const recorded = diagnostic.replaceAll(base, '<tmp>');
      cases.push({ command: 'branch', action: action.label, name, tokens, argv, valid, state, diagnostic: recorded });
    }
  }
  const fixture = {
    generator: 'scripts/branch-name-corpus.mjs',
    git: '2.55.0',
    scope: 'Git 2.55.0 check_branch_ref for new branch names: creation and -m/-M/-c/-C targets with one and two operands',
    cases,
  };
  await writeFile(new URL('test/fixtures/branch-name-corpus.json', root), `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`Recorded ${cases.length} branch name cases (${cases.filter((row) => row.valid).length} accepted).`);
} finally {
  await rm(base, { recursive: true, force: true });
}

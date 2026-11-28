// Independent native oracle for the rebase completion closure (docs/design/audit-completion.md).
// cmd_rebase reads configuration and in-progress state, parses options, validates trailers,
// refuses actions with other arguments, checks --keep-base, --root and --fork-point, the
// apply options -C and --whitespace and the exec commands, derives the backend from explicit
// and implied requests, and then resolves the upstream, onto and branch. Every case runs in a
// fresh copy of a seed repository, so rebases really execute. Cases are singles and pairs over
// a fixed vocabulary crossed with operand shapes; they witness the closure's mappings and are
// not a completeness argument.
//
// A refused case is state-dependent when the same argv is accepted in a repository where the
// branch already contains its upstream or where an interactive rebase is stopped, or when its
// diagnostic depends on inputs no seed provides (see STATE): the wrapper must accept exactly
// the argv that some such state accepts.
import { spawnSync } from 'node:child_process';
import { closeSync, cpSync, openSync, rmSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-rebase-closure-'));
const seeds = { clean: join(base, 'clean'), rebasing: join(base, 'rebasing'), current: join(base, 'current') };
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
  GIT_SEQUENCE_EDITOR: 'true',
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
  /^usage: git rebase /,
  /^error: empty --trailer argument$/,
  /^error: invalid trailer '.*': missing key before separator$/,
  /^fatal: --preserve-merges was replaced by --rebase-merges$/,
  /^fatal: options '--(?:keep-base|root)' and '--(?:onto|root|fork-point)' cannot be used together$/,
  /^fatal: switch `C' expects a numerical value$/,
  /^fatal: Invalid whitespace option: '.*'$/,
  /^error: exec commands cannot contain newlines$/,
  /^error: empty exec command$/,
  /^fatal: apply options and merge options cannot be used together$/,
  /^fatal: .+ requires the merge backend$/,
  /^fatal: --reschedule-failed-exec requires --exec or --interactive$/,
  /^fatal: unrecognized empty type '.*'; valid values are "drop", "keep", and "stop"\.$/,
  /^fatal: Unknown rebase-merges mode: .*$/,
  /^fatal: invalid upstream ''$/,
  /^fatal: no such branch\/commit ''$/,
  /^fatal: Does not point to a valid commit ''$/,
  /^error: (?:option|switch) `[^']*' (?:takes no value|requires a value|expects a numerical value|isn't available)$/,
  /^error: unknown (?:option|switch) /,
  /^error: option `.*' is incompatible with --.*$/,
  /^error: options '.*' and '.*' cannot be used together$/,
];
/**
 * Refusals that depend on inputs these seeds do not vary: signing keys, strategy executables,
 * an in-progress rebase whose state the action needs, whether there are patches to apply, and
 * refs with unusual names.
 */
const STATE = [
  /^error: gpg failed to sign the data:?$/,
  /^error: failed to write commit object$/,
  /^fatal: no rebase in progress$/,
  // git apply refuses an empty --whitespace action only when there are patches to apply.
  /^error: unrecognized whitespace option ''$/,
  // A ref may have any name that update-ref accepts, even '-'.
  /^fatal: no such branch\/commit '.+'$/,
  /^error: could not commit staged changes\.$/,
  /^fatal: could not find merge strategy '.*'$/i,
  /^error: Could not execute .*/,
];
const ACTIONS = [[], [['--continue']], [['--skip']], [['--abort']], [['--quit']], [['--edit-todo']], [['--show-current-patch']]];
const MODIFIERS = [
  [], [['--onto', 'main']], [['--onto', '']], [['--keep-base']], [['--no-keep-base']], [['--no-verify']], [['--verify']],
  [['-q']], [['-v']], [['-n']], [['--stat']], [['--trailer', 'Key: value']], [['--trailer', '']], [['--trailer', '=x']],
  [['--trailer', 'x=y']], [['--signoff']], [['--committer-date-is-author-date']], [['--reset-author-date']], [['--ignore-date']],
  [['-C', '3']], [['-C', 'x']], [['--ignore-whitespace']], [['--whitespace', 'fix']], [['--whitespace', 'warn']],
  [['--whitespace', 'bogus']], [['--whitespace', '']], [['-f']], [['--no-ff']], [['--apply']], [['--merge']], [['-i']],
  [['-p']], [['--rerere-autoupdate']], [['--no-rerere-autoupdate']], [['--empty', 'drop']], [['--empty', 'KEEP']],
  [['--empty', 'ask']], [['--empty', 'bogus']], [['-k']], [['--no-keep-empty']], [['--autosquash']], [['--no-autosquash']],
  [['--update-refs']], [['--no-update-refs']], [['-S']], [['--no-gpg-sign']], [['--autostash']], [['--no-autostash']],
  [['-x', 'true']], [['-x', '']], [['-x', 'a\nb']], [['--no-exec']], [['-r']], [['--rebase-merges', 'rebase-cousins']],
  [['--rebase-merges', '']], [['--rebase-merges', 'bogus']], [['--no-rebase-merges']], [['--fork-point']], [['--no-fork-point']],
  [['-s', 'ort']], [['-X', 'ours']], [['--root']], [['--no-root']], [['--reschedule-failed-exec']],
  [['--no-reschedule-failed-exec']], [['--reapply-cherry-picks']], [['--no-reapply-cherry-picks']], [['--allow-empty-message']],
];
const OPERANDS = [[], [operand('main')], [operand('-')], [operand('main'), operand('topic')], [operand('main'), operand('topic'), operand('main')], [operand('')], [operand('main'), operand('')]];
try {
  await writeFile(join(base, 'oracle-stdin'), '');
  const clean = seeds.clean;
  await mkdir(clean);
  if (git(['--version'], clean).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  const seed = async (cwd, steps) => {
    for (const step of steps) {
      if (typeof step === 'function') await step();
      else if (git(step, cwd).status !== 0) throw new Error(`Cannot seed oracle: ${step.join(' ')}`);
    }
  };
  await seed(clean, [
    () => writeFile(join(clean, 'f'), 'base\n'),
    ['init', '-qb', 'main'],
    // Copies keep mtimes but not inodes or ctimes; compare only what a copy preserves.
    ['config', 'core.checkStat', 'minimal'],
    ['config', 'core.trustctime', 'false'],
    ['add', 'f'],
    ['commit', '-qm', 'base'],
    ['checkout', '-qb', 'topic'],
    () => writeFile(join(clean, 't'), 'topic\n'),
    ['add', 't'],
    ['commit', '-qm', 'topic'],
    ['checkout', '-q', 'main'],
    () => writeFile(join(clean, 'm'), 'main\n'),
    ['add', 'm'],
    ['commit', '-qm', 'main'],
    // topic tracks main, and '-' (@{-1}) names main.
    ['checkout', '-q', 'topic'],
    ['branch', '-q', '--set-upstream-to', 'main'],
  ]);
  // A branch that already contains main: rebasing it writes no commits.
  const current = seeds.current;
  cpSync(clean, current, { recursive: true, preserveTimestamps: true });
  if (git(['rebase', '-q', 'main'], current).status !== 0) throw new Error('Cannot seed an up-to-date branch');
  const rebasing = seeds.rebasing;
  cpSync(clean, rebasing, { recursive: true, preserveTimestamps: true });
  if (git(['rebase', '-x', 'false', 'main'], rebasing).status === 0) throw new Error('Cannot seed a stopped rebase');

  /** Run one argv in a fresh copy of a seed and classify its first diagnostic. */
  const run = (tokens, state = 'clean') => {
    rmSync(directory, { recursive: true, force: true });
    cpSync(seeds[state], directory, { recursive: true, preserveTimestamps: true });
    const argv = ['rebase', ...serialize(tokens)];
    const result = git(argv);
    const lines = `${result.stderr}`.split('\n');
    const diagnostic = lines.find((line) => /^(usage|fatal|error):/.test(line)) ?? '';
    return { status: result.status, diagnostic, valid: result.status === 0 && !diagnostic };
  };
  const cases = [];
  const unclassified = new Map();
  const record = (tokens) => {
    const outcome = run(tokens);
    const { valid, diagnostic } = outcome;
    const argv = ['rebase', ...serialize(tokens)];
    const state =
      !valid && (STATE.some((p) => p.test(diagnostic)) || run(tokens, 'current').valid || run(tokens, 'rebasing').valid);
    if (!valid && !state && !REFUSALS.some((p) => p.test(diagnostic))) {
      unclassified.set(diagnostic || `${outcome.status}`, argv);
      return;
    }
    cases.push({ command: 'rebase', tokens, argv, valid, state, status: outcome.status, diagnostic });
  };
  const sequences = [];
  for (const a of ACTIONS) for (const m of MODIFIERS) for (const o of OPERANDS) sequences.push([...a, ...m, ...o]);
  for (const m of MODIFIERS) for (const n of MODIFIERS) sequences.push([...m, ...n, operand('main')]);
  for (const a of ACTIONS) for (const b of ACTIONS) sequences.push([...a, ...b]);
  const unique = new Map(sequences.map((tokens) => [JSON.stringify(tokens), tokens]));
  for (const tokens of unique.values()) record(tokens);
  if (unclassified.size) {
    throw new Error(`Unclassified outcomes:\n${[...unclassified].map(([d, argv]) => `${JSON.stringify(argv)}: ${d}`).join('\n')}`);
  }
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; fresh copy of a seed repository on topic (tracking main, one commit behind and one ahead; @{-1} is main), or of the same repository with topic already rebased onto main or with a merge-backend rebase stopped at a failed exec, for every case; GIT_EDITOR=true and GIT_SEQUENCE_EDITOR=true; actions crossed with modifiers and seven operand shapes, modifier pairs before main, action pairs; a refused case is state-dependent when the same argv succeeds on the up-to-date branch or during the stopped rebase, or when its diagnostic depends on signing keys, strategy executables, an in-progress rebase or unusual ref names; empty file-backed stdin',
      cases,
    },
    null,
    2,
  )}\n`;
  const target = new URL('test/fixtures/rebase-closure-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('rebase-closure-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} independent rebase closure outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

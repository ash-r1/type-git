// Independent native oracle for the merge completion closure (docs/design/audit-completion.md).
// cmd_merge parses options after reading configuration, handles --abort, --quit and
// --continue as sole arguments, refuses in-progress operations, checks --squash against
// --no-ff and --commit, and then resolves and merges the named commits. Every case runs in a
// fresh copy of a seed repository, so merges really execute. Cases are singles and pairs over
// a fixed vocabulary crossed with operand shapes; they witness the closure's mappings and are
// not a completeness argument.
//
// A refused case is state-dependent when the same argv is accepted in another seed state: the
// each named operand replaced by a diverged branch (topic), a fast-forward branch (ahead), the current branch (main) or '-', or a
// repository with a conflicted merge in progress. The wrapper must accept exactly the argv
// that some such state accepts, except for refusals listed in STATE, which depend on inputs
// no seed here provides (signatures, keys, upstream configuration, merge drivers).
import { spawnSync } from 'node:child_process';
import { closeSync, cpSync, openSync, rmSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-merge-closure-'));
const seeds = { clean: join(base, 'clean'), merging: join(base, 'merging') };
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
  GIT_MERGE_AUTOEDIT: 'no',
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
/** Parser and argument refusals that precede every repository read they could depend on. */
const GUARANTEED = [
  /^fatal: --(?:abort|quit|continue) expects no arguments$/,
  /^fatal: options '--squash' and '--(?:no-ff|commit)\.' cannot be used together$/,
  /^fatal: Invalid cleanup mode .*$/,
  /^error: (?:option|switch) `[^']*' (?:takes no value|requires a value|expects a numerical value|cannot be negated)$/,
  /^error: unknown (?:option|switch) /,
  // An empty name never resolves to a commit.
  /^merge:  - not something we can merge$/,
];
/** Argument refusals these cases may reach in Git 2.55.0. */
const REFUSALS = [
  /^usage: git merge /,
  /^fatal: --(?:abort|quit|continue) expects no arguments$/,
  /^fatal: options '--squash' and '--(?:no-ff|commit)\.' cannot be used together$/,
  /^fatal: Invalid cleanup mode .*$/,
  /^error: (?:option|switch) `[^']*' (?:takes no value|requires a value|expects a numerical value|cannot be negated)$/,
  /^error: (?:option|switch) `[^']*' isn't available$/,
  /^error: unknown (?:option|switch) /,
  /^merge:  - not something we can merge$/,
  // A missing strategy or message file stops parsing before a refusal that would follow.
  /^Could not find merge strategy 'bogus'\.$/,
  /^error: could not read file 'missing'$/,
];
/**
 * Refusals that depend on inputs these seeds do not vary: commit signatures and signing keys,
 * the branch's upstream, names that do not resolve here, and whether two histories are related.
 */
const STATE = [
  /^fatal: Commit [0-9a-f]+ does not have a GPG signature\.$/,
  /^error: gpg failed to sign the data:?$/,
  /^fatal: No (?:remote|default upstream defined) for the current branch\.$/,
  /^merge: .+ - not something we can merge$/,
  /^fatal: refusing to merge unrelated histories$/,
];
const ACTIONS = [[], [['--abort']], [['--quit']], [['--continue']], [['--no-abort']], [['--no-continue']]];
const MODIFIERS = [
  [], [['-n']], [['--stat']], [['--no-stat']], [['--summary']], [['--compact-summary']], [['--no-compact-summary']],
  [['--log']], [['--log', '3']], [['--log', '-1']], [['--no-log']], [['--squash']], [['--no-squash']],
  [['--commit']], [['--no-commit']], [['-e']], [['--no-edit']], [['--cleanup', 'strip']], [['--cleanup', 'scissors']],
  [['--cleanup', 'bogus']], [['--ff']], [['--no-ff']], [['--ff-only']], [['--rerere-autoupdate']], [['--no-rerere-autoupdate']],
  [['--verify-signatures']], [['--no-verify-signatures']], [['-s', 'ort']], [['-s', 'recursive']], [['-s', 'resolve']],
  [['-s', 'ours']], [['-s', 'octopus']], [['-s', 'subtree']], [['-s', 'bogus']], [['--no-strategy']],
  [['-X', 'ours']], [['-X', 'theirs']], [['-X', 'bogus']], [['--no-strategy-option']], [['-m', 'msg']], [['-m', '']],
  [['--no-message']], [['-F', 'message']], [['-F', 'missing']], [['--into-name', 'other']], [['-q']], [['-v']],
  [['--progress']], [['--no-progress']], [['--allow-unrelated-histories']], [['-S']], [['--no-gpg-sign']],
  [['--autostash']], [['--no-autostash']], [['--overwrite-ignore']], [['--signoff']], [['--no-signoff']], [['--no-verify']],
];
const OPERANDS = [[], [operand('topic')], [operand('ahead')], [operand('-')], [operand('topic'), operand('ahead')], [operand('HEAD')], [operand('')]];
/** Replace each named operand by each of a diverged branch, a fast-forward branch, the current branch and '-' (topic). */
const NAMES = ['topic', 'ahead', 'main', '-'];
const swap = (tokens) => {
  let out = [tokens];
  tokens.forEach((token, index) => {
    if (Array.isArray(token) || !NAMES.includes(token.operand)) return;
    out = out.flatMap((v) => NAMES.map((name) => v.map((t, i) => (i === index ? operand(name) : t))));
  });
  return out;
};
try {
  await writeFile(join(base, 'oracle-stdin'), '');
  await writeFile(join(base, 'message'), 'from file\n');
  const clean = seeds.clean;
  await mkdir(clean);
  if (git(['--version'], clean).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  await writeFile(join(clean, 'f'), 'base\n');
  const seed = async (cwd, steps) => {
    for (const step of steps) {
      if (typeof step === 'function') await step();
      else if (git(step, cwd).status !== 0) throw new Error(`Cannot seed oracle: ${step.join(' ')}`);
    }
  };
  await seed(clean, [
    ['init', '-qb', 'main'],
    // Copies keep mtimes but not inodes or ctimes; compare only what a copy preserves.
    ['config', 'core.checkStat', 'minimal'],
    ['config', 'core.trustctime', 'false'],
    ['add', 'f'],
    ['commit', '-qm', 'base'],
    ['checkout', '-qb', 'topic'],
    ['commit', '-q', '--allow-empty', '-m', 'topic'],
    ['checkout', '-q', 'main'],
    ['branch', 'ahead'],
    ['checkout', '-q', 'ahead'],
    ['commit', '-q', '--allow-empty', '-m', 'ahead'],
    ['checkout', '-q', 'main'],
    // Diverge main from topic so that merging topic needs a strategy; '-' names topic.
    () => writeFile(join(clean, 'g'), 'main\n'),
    ['add', 'g'],
    ['commit', '-qm', 'main'],
    ['checkout', '-q', 'topic'],
    ['checkout', '-q', 'main'],
  ]);
  // ahead is now behind main's new commit, so recreate it as a strict descendant of main.
  await seed(clean, [['branch', '-qf', 'ahead', 'main'], ['checkout', '-q', 'ahead'], ['commit', '-q', '--allow-empty', '-m', 'ahead'], ['checkout', '-q', 'topic'], ['checkout', '-q', 'main']]);
  const merging = seeds.merging;
  cpSync(clean, merging, { recursive: true, preserveTimestamps: true });
  await seed(merging, [
    ['checkout', '-qb', 'conflict', 'topic'],
    () => writeFile(join(merging, 'f'), 'conflict\n'),
    ['commit', '-qam', 'conflict'],
    ['checkout', '-q', 'main'],
    () => writeFile(join(merging, 'f'), 'main side\n'),
    ['commit', '-qam', 'main side'],
  ]);
  if (git(['merge', 'conflict'], merging).status === 0) throw new Error('Cannot seed a conflicted merge');
  // Resolve the conflict in the index so that --continue can commit; MERGE_HEAD stays.
  await writeFile(join(merging, 'f'), 'resolved\n');
  if (git(['add', 'f'], merging).status !== 0) throw new Error('Cannot stage the resolution');

  /** Run one argv in a fresh copy of a seed and classify its first diagnostic. */
  const run = (tokens, state = 'clean') => {
    rmSync(directory, { recursive: true, force: true });
    cpSync(seeds[state], directory, { recursive: true, preserveTimestamps: true });
    const argv = ['merge', ...serialize(tokens).map((w) => (w === 'message' || w.endsWith('=message') ? w.replace('message', join(base, 'message')) : w))];
    const result = git(argv);
    const lines = `${result.stderr}`.split('\n');
    const diagnostic = lines.find((line) => /^(usage|fatal|error|merge):|^Could not find merge strategy/.test(line)) ?? '';
    // A conflicted merge exits 1 and reports the conflict on stdout; that is an accepted argv.
    const conflicted = result.status === 1 && /Automatic merge failed|CONFLICT/.test(result.stdout) && !diagnostic;
    return { status: result.status, diagnostic, valid: (result.status === 0 || conflicted) && !diagnostic };
  };
  const cases = [];
  const unclassified = new Map();
  /**
   * -s and -F are resolved by option callbacks while parsing, before every later check. A case
   * refused for a missing strategy or message file is state-dependent only when the same argv
   * with an existing strategy (ours) and message file is accepted, or is itself state-dependent.
   */
  const PARSE_TIME = [/^Could not find merge strategy '.*'\.$/, /^error: could not read file '.*'$/];
  const resolvable = (tokens) =>
    tokens.map((t) =>
      Array.isArray(t) && t[0] === '-s' && t[1] === 'bogus' ? ['-s', 'ours'] : Array.isArray(t) && t[0] === '-F' && t[1] === 'missing' ? ['-F', 'message'] : t,
    );
  const classify = (tokens) => {
    const outcome = run(tokens);
    const { valid, diagnostic } = outcome;
    let state = false;
    if (!valid && PARSE_TIME.some((p) => p.test(diagnostic))) {
      const other = resolvable(tokens);
      if (JSON.stringify(other) === JSON.stringify(tokens)) throw new Error(`Unexpected parse-time refusal: ${diagnostic}`);
      const resolved = classify(other);
      state = resolved.valid || resolved.state;
    } else if (!valid && !GUARANTEED.some((p) => p.test(diagnostic))) {
      state =
        STATE.some((p) => p.test(diagnostic)) ||
        swap(tokens).some((v) => (JSON.stringify(v) !== JSON.stringify(tokens) && run(v).valid) || run(v, 'merging').valid);
    }
    return { outcome, valid, diagnostic, state };
  };
  const record = (tokens) => {
    const { outcome, valid, diagnostic, state } = classify(tokens);
    const argv = ['merge', ...serialize(tokens)];
    if (!valid && !state && !REFUSALS.some((p) => p.test(diagnostic))) {
      // Remaining refusals are repository conditions in the clean seed that another seed lifts.
      unclassified.set(diagnostic || `${outcome.status}`, argv);
      return;
    }
    cases.push({ command: 'merge', tokens, argv, valid, state, status: outcome.status, diagnostic });
  };
  const sequences = [];
  for (const a of ACTIONS) for (const m of MODIFIERS) for (const o of OPERANDS) sequences.push([...a, ...m, ...o]);
  for (const m of MODIFIERS) for (const n of MODIFIERS) for (const o of OPERANDS.slice(1, 3)) sequences.push([...m, ...n, ...o]);
  for (const a of ACTIONS) for (const b of ACTIONS) sequences.push([...a, ...b]);
  const unique = new Map(sequences.map((tokens) => [JSON.stringify(tokens), tokens]));
  for (const tokens of unique.values()) record(tokens);
  if (unclassified.size) {
    throw new Error(`Unclassified outcomes:\n${[...unclassified].map(([d, argv]) => `${JSON.stringify(argv)}: ${d}`).join('\n')}`);
  }
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; fresh copy of a seed repository on main with a diverged branch topic (also @{-1}) and a fast-forward branch ahead, or of the same repository with a resolved but uncommitted conflicted merge, for every case; GIT_EDITOR=true; -F names a readable message file; actions crossed with modifiers and seven operand shapes, modifier pairs before topic or ahead, action pairs; a refused case is state-dependent when the same argv succeeds with its named operands replaced by topic, ahead, main or - or during the merge, or, for a missing strategy or message file, when the argv with -s ours or the readable file is accepted or state-dependent, or when its diagnostic depends on signatures, signing keys, upstream configuration or unrelated histories; empty file-backed stdin',
      cases,
    },
    null,
    2,
  )}\n`;
  const target = new URL('test/fixtures/merge-closure-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('merge-closure-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} independent merge closure outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

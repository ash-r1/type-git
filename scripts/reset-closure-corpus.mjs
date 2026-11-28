// Independent native oracle for the reset completion closure (docs/design/audit-completion.md).
// cmd_reset parses options with PARSE_OPT_KEEP_DASHDASH, splits the remaining words into a
// revision and pathspecs in parse_args, resolves the revision, and only then checks the
// combinations of mode, patch, context and pathspec-file options. Every case runs in a fresh
// copy of one seed repository, so resets really execute. Cases are singles and pairs over a
// fixed vocabulary crossed with operand shapes, plus mode/modifier/operand triples; they
// witness the closure's mappings and are not a completeness argument.
import { spawnSync } from 'node:child_process';
import { closeSync, cpSync, openSync, rmSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-reset-closure-'));
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
/** Spell tokens without importing production serialization: long values attach with '='. */
const serialize = (tokens) =>
  tokens.flatMap((token) =>
    !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : token[0].startsWith('--') ? [`${token[0]}=${token[1]}`] : token,
  );
/** Argument refusals these cases may reach in Git 2.55.0. */
const REFUSALS = [
  /^fatal: options '--pathspec-from-file' and '--patch' cannot be used together$/,
  /^fatal: '--pathspec-from-file' and pathspec arguments cannot be used together$/,
  /^fatal: the option '--pathspec-file-nul' requires '--pathspec-from-file'$/,
  /^fatal: '--(?:unified|inter-hunk-context)' cannot be negative$/,
  /^fatal: options '--patch' and '--\{hard,mixed,soft\}' cannot be used together$/,
  /^fatal: the option '--(?:unified|inter-hunk-context|no-auto-advance)' requires '--patch'$/,
  /^fatal: Cannot do (?:soft|hard|merge|keep) reset with paths\.$/,
  /^fatal: the option '-N' requires '--mixed'$/,
  /^fatal: bad recurse-submodules argument: .*$/,
  // An empty word is never a revision, and as a path it is refused either by verify_filename
  // (as the first retained word) or by parse_pathspec.
  /^fatal: ambiguous argument '': unknown revision or path not in the working tree\.$/,
  /^fatal: empty string is not a valid pathspec\. please use \. instead if you meant to match all paths$/,
  /^error: (?:option|switch) `[^']*' (?:takes no value|requires a value|expects a numerical value)$/,
  /^error: unknown (?:option|switch) /,
];
/** Refusals decided by which words name objects or paths; the wrapper leaves them to Git. */
const STATE = [
  /^fatal: ambiguous argument '.+': unknown revision or path not in the working tree\.$/,
  /^fatal: ambiguous argument '.*': both revision and filename$/,
  /^fatal: Failed to resolve '.*' as a valid (?:revision|tree)\.$/,
  /^fatal: .*: no such path in the working tree\.$/,
  /^error: pathspec '.*' did not match any file\(s\) known to git$/,
];
const MODES = [[], [['--soft']], [['--mixed']], [['--hard']], [['--merge']], [['--keep']]];
const MODIFIERS = [
  [], [['-p']], [['--patch']], [['--no-patch']], [['-N']], [['--intent-to-add']], [['--no-intent-to-add']],
  [['-q']], [['--no-refresh']], [['--refresh']], [['-U', '3']], [['-U', '-1']], [['-U', '-2']], [['--unified', '0']],
  [['--inter-hunk-context', '1']], [['--inter-hunk-context', '-1']], [['--inter-hunk-context', '-2']],
  [['--auto-advance']], [['--no-auto-advance']], [['--pathspec-from-file', 'paths']],
  [['--pathspec-file-nul']], [['--no-pathspec-file-nul']], [['--no-pathspec-from-file']],
  [['--pathspec-from-file', 'paths'], ['--pathspec-file-nul']], [['--pathspec-from-file', 'paths'], ['--no-pathspec-from-file']],
  [['--recurse-submodules']], [['--recurse-submodules', 'yes']], [['--recurse-submodules', 'no']],
  [['--recurse-submodules', 'check']], [['--recurse-submodules', 'bogus']], [['--no-recurse-submodules']],
];
const SEP = ['--'];
const OPERANDS = [
  [], [operand('HEAD')], [operand('@')], [operand('main~1')], [SEP], [SEP, operand('f')], [operand('HEAD'), SEP],
  [operand('HEAD'), SEP, operand('f')], [operand('f')], [operand('HEAD'), operand('f')], [operand('f'), operand('g')],
  [operand('')], [SEP, operand('')], [operand('HEAD'), SEP, operand('f'), SEP],
];
try {
  await writeFile(join(base, 'oracle-stdin'), '');
  await mkdir(seed);
  if (git(['--version'], seed).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  await writeFile(join(seed, 'f'), 'one\n');
  await writeFile(join(seed, 'g'), 'one\n');
  for (const args of [
    ['init', '-qb', 'main'],
    ['add', 'f', 'g'],
    ['commit', '-qm', 'one'],
    ['commit', '-q', '--allow-empty', '-m', 'two'],
  ]) {
    if (git(args, seed).status !== 0) throw new Error(`Cannot seed oracle: ${args.join(' ')}`);
  }
  await writeFile(join(seed, 'paths'), 'f\n');
  await writeFile(join(seed, 'empty'), '');
  const cases = [];
  const unclassified = new Map();
  /** Run one argv in a fresh copy of the seed and classify its first diagnostic. */
  const run = (tokens) => {
    rmSync(directory, { recursive: true, force: true });
    cpSync(seed, directory, { recursive: true });
    const argv = ['reset', ...serialize(tokens)];
    const result = git(argv);
    const diagnostic = `${result.stderr}`.split('\n').find((line) => /^(usage|fatal|error):/.test(line)) ?? '';
    // Patch mode with empty stdin reports "No changes." and succeeds.
    return { argv, status: result.status, diagnostic, valid: result.status === 0 && !diagnostic };
  };
  /**
   * The same argv shape in other repository states: each non-empty operand that names a path
   * (f, g) or a revision (HEAD, @, main~1) swapped for the other kind, and the pathspec file
   * swapped for an empty one. The wrapper cannot tell these apart, so it must accept an argv
   * when any of them is accepted.
   */
  const variants = (tokens) => {
    let out = [tokens];
    tokens.forEach((token, index) => {
      if (Array.isArray(token) ? token[0] !== '--pathspec-from-file' : !token.operand) return;
      const other = Array.isArray(token) ? ['--pathspec-from-file', 'empty'] : operand(/^[fg]$/.test(token.operand) ? 'HEAD' : 'f');
      out = out.flatMap((v) => [v, v.map((t, i) => (i === index ? other : t))]);
    });
    return out.slice(1);
  };
  const record = (tokens) => {
    const outcome = run(tokens);
    const { argv, valid, diagnostic } = outcome;
    const state = !valid && variants(tokens).some((v) => run(v).valid);
    if (!valid && !state && !REFUSALS.some((p) => p.test(diagnostic)) && !STATE.some((p) => p.test(diagnostic))) {
      unclassified.set(diagnostic || `${outcome.status}: ${diagnostic}`, argv);
      return;
    }
    cases.push({ command: 'reset', tokens, argv, valid, state, status: outcome.status, diagnostic });
  };
  const sequences = [];
  for (const m of MODES) for (const a of MODIFIERS) for (const o of OPERANDS) sequences.push([...m, ...a, ...o]);
  for (const a of MODIFIERS) for (const b of MODIFIERS) for (const o of OPERANDS.slice(0, 2)) sequences.push([...a, ...b, ...o]);
  for (const m of MODES) for (const n of MODES) for (const o of OPERANDS) sequences.push([...m, ...n, ...o]);
  // Paths and an explicit pathspec file in either order around a mode.
  for (const m of MODES) for (const a of MODIFIERS) for (const b of MODIFIERS.slice(1, 10)) sequences.push([...m, ...a, ...b, operand('f')]);
  const unique = new Map(sequences.map((tokens) => [JSON.stringify(tokens), tokens]));
  for (const tokens of unique.values()) record(tokens);
  if (unclassified.size) {
    throw new Error(`Unclassified outcomes:\n${[...unclassified].map(([d, argv]) => `${JSON.stringify(argv)}: ${d}`).join('\n')}`);
  }
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; fresh copy of a seed repository on main with two commits tracking files f and g and untracked pathspec files paths (naming f) and empty, for every case; a refused case is state-dependent when the same shape is accepted with path and revision operands swapped or with the empty pathspec file; modes crossed with modifiers and fourteen operand shapes, modifier pairs with no operand or HEAD, mode pairs with every operand shape, mode-modifier-modifier triples before f; empty file-backed stdin',
      cases,
    },
    null,
    2,
  )}\n`;
  const target = new URL('test/fixtures/reset-closure-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('reset-closure-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} independent reset closure outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

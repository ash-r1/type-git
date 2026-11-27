// Independent native oracle for the status completion closure (docs/design/audit-completion.md).
// Each refusal obligation of cmd_status and its same-file helpers is reached here, together
// with the last-wins format, NUL, untracked, ignored, submodule and rename spellings that
// decide whether it fires. Cases are pairs and ordered triples over a fixed vocabulary, so
// the corpus witnesses the closure's mappings; it is not a completeness argument.
import { spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-status-closure-'));
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
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.test',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.test',
};
/** Execute native Git with file-backed stdin and report abnormal termination. */
function git(args) {
  const input = openSync(join(base, 'oracle-stdin'), 'r');
  try {
    const result = spawnSync('git', args, {
      cwd: directory,
      env,
      stdio: [input, 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 60000,
    });
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
    !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : [`${token[0]}=${token[1]}`],
  );
/** Refusals these cases may reach in Git 2.55.0; any other failure aborts generation. */
const DIAGNOSTICS = [
  /^fatal: options '--long' and '-z' cannot be used together$/,
  /^fatal: unsupported porcelain version '.*'$/,
  /^fatal: Invalid untracked files mode '.*'$/,
  /^fatal: Invalid ignored mode '.*'$/,
  /^fatal: Unsupported combination of ignored and untracked-files arguments$/,
  /^fatal: bad --ignore-submodules argument: .*$/,
  /^fatal: empty string is not a valid pathspec\. please use \. instead if you meant to match all paths$/,
  /^error: option `[a-z-]+' takes no value$/,
];
// One vocabulary per obligation family; long spellings carry values so '-u' optargs stay attached.
const FORMAT = [
  ['--long'], ['--no-long'], ['-s'], ['--no-short'], ['--porcelain'], ['--no-porcelain'],
  ['--porcelain', 'v1'], ['--porcelain', '1'], ['--porcelain', 'v2'], ['--porcelain', '2'],
  ['--porcelain', 'V2'], ['--porcelain', 'v3'], ['--porcelain', ''], ['--porcelain', ' v1'],
];
const NUL = [['-z'], ['--null'], ['--no-null']];
const UNTRACKED = [
  ['-u'], ['--no-untracked-files'], ['--untracked-files', 'no'], ['--untracked-files', 'normal'],
  ['--untracked-files', 'all'], ['--untracked-files', 'false'], ['--untracked-files', 'TRUE'],
  ['--untracked-files', '0'], ['--untracked-files', 'off'], ['--untracked-files', ''],
  ['--untracked-files', 'All'], ['--untracked-files', 'bad'],
];
const IGNORED = [
  ['--ignored'], ['--no-ignored'], ['--ignored', 'no'], ['--ignored', 'matching'],
  ['--ignored', 'traditional'], ['--ignored', 'Matching'], ['--ignored', ''],
];
const SUBMODULES = [
  ['--ignore-submodules'], ['--ignore-submodules', 'none'], ['--ignore-submodules', 'dirty'],
  ['--ignore-submodules', 'untracked'], ['--ignore-submodules', 'all'],
  ['--ignore-submodules', 'ALL'], ['--ignore-submodules', ''],
];
const RENAMES = [['-M'], ['--find-renames', '50%'], ['--find-renames', 'x'], ['--find-renames', '-5'], ['--no-renames']];
const OPERANDS = [operand('file'), operand('')];
try {
  await mkdir(directory);
  await writeFile(join(base, 'oracle-stdin'), '');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  await writeFile(join(directory, 'file'), 'one\n');
  await writeFile(join(directory, '.gitignore'), 'ignored\n');
  if (git(['add', '--', 'file', '.gitignore']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) {
    throw new Error('Cannot seed oracle');
  }
  await writeFile(join(directory, 'file'), 'one\ntwo\n');
  await writeFile(join(directory, 'ignored'), '');
  await writeFile(join(directory, 'untracked'), '');
  const cases = [];
  const record = (tokens) => {
    const argv = ['status', ...serialize(tokens)];
    const result = git(argv);
    const diagnostic = result.stderr.split('\n').find((line) => /^(fatal|error):/.test(line)) ?? '';
    // A help exit prints usage on stdout and is an accepted invocation, as in the other oracles.
    const usage = result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr;
    const valid = result.status === 0 || usage;
    if (valid ? diagnostic : !DIAGNOSTICS.some((p) => p.test(diagnostic))) {
      throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    }
    cases.push({ command: 'status', tokens, argv, valid, status: result.status, diagnostic });
  };
  const families = [FORMAT, NUL, UNTRACKED, IGNORED, SUBMODULES, RENAMES, OPERANDS];
  const sequences = [];
  for (const family of families) for (const a of family) sequences.push([a]);
  // Every ordered pair, within a family and across families.
  for (const left of families) for (const right of families) for (const a of left) for (const b of right) sequences.push([a, b]);
  // Format and NUL are last-wins state: triples over both, with the NUL word in every position, decide --long with -z.
  const formatNul = [...FORMAT, ...NUL];
  for (const a of formatNul) for (const b of formatNul) for (const c of NUL) sequences.push([a, b, c], [a, c, b], [c, a, b]);
  // Matching ignored files with two last-wins untracked modes, the ignored word in every position.
  const matching = ['--ignored', 'matching'];
  for (const a of UNTRACKED) for (const b of UNTRACKED) sequences.push([matching, a, b], [a, matching, b], [a, b, matching]);
  // Refusal order: option callbacks, then final checks, then the pathspec, then submodules.
  for (const a of [['--porcelain', 'v3'], ['--long'], ['--untracked-files', 'bad'], ['--ignored', 'bad']]) {
    for (const b of [['-z'], ['--ignored', 'bad'], ['--ignore-submodules', 'bad'], operand('')]) sequences.push([a, b], [b, a]);
  }
  sequences.push([['--ignore-submodules', 'bad'], operand('')], [['-h'], ['--porcelain', 'v3']], [['--porcelain', 'v3'], ['-h']]);
  const unique = new Map(sequences.map((tokens) => [JSON.stringify(tokens), tokens]));
  for (const tokens of unique.values()) record(tokens);
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; isolated seeded repository with a modified tracked file, an untracked file and an ignored file; every ordered pair of the status closure vocabulary, format/NUL and matching/untracked triples in each position; empty file-backed stdin',
      cases,
    },
    null,
    2,
  )}\n`;
  const target = new URL('test/fixtures/status-closure-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('status-closure-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} independent status closure outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

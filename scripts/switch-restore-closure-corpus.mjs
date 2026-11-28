// Independent native oracle for the switch and restore completion closures
// (docs/design/audit-completion.md). Each argv-decided refusal site of checkout_main,
// checkout_branch, checkout_paths and parse_branchname_arg that switch or restore can reach
// is exercised by every ordered pair of distinct items of a fixed vocabulary (an item is never
// paired with itself), with each operand shape. Outcomes
// that Git decides from repository state (ref resolution, stage lookups, tracking setup) are
// recorded as delegated. The corpus witnesses the closures' mappings; it is not a
// completeness argument.
//
//   node scripts/switch-restore-closure-corpus.mjs [--check]
import { spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const check = process.argv.includes('--check');
const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-switch-restore-closure-'));
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
/** Execute native Git with empty file-backed stdin and report abnormal termination. */
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
/** Refusals decided by argv in Git 2.55.0, with the typed rule that models each. */
const RULES = [
  [/^fatal: '--(unified|inter-hunk-context)' cannot be negative$/, 'range'],
  [/^fatal: the option '--(unified|inter-hunk-context|no-auto-advance)' requires '--patch'$/, 'patch-only'],
  [/^fatal: options '-c', '-C', and '--orphan' cannot be used together$/, 'switch-creation'],
  [/^fatal: options '-p' and '--overlay' cannot be used together$/, 'restore-patch-overlay'],
  [/^fatal: --track needs a branch name$/, 'switch-target'],
  [/^fatal: missing branch name; try -c$/, 'switch-track-start-point'],
  [/^fatal: '--pathspec-from-file' and pathspec arguments cannot be used together$/, 'restore-file-operands'],
  [/^fatal: options '--pathspec-from-file' and '--patch' cannot be used together$/, 'restore-file-patch'],
  [/^fatal: the option '--pathspec-file-nul' requires '--pathspec-from-file'$/, 'restore-file-nul'],
  [/^fatal: git checkout: --ours\/--theirs, --force and --merge are incompatible when$/, 'restore-merge-stage'],
  [/^fatal: you must specify path\(s\) to restore$/, 'restore-paths'],
  [/^fatal: '--detach' cannot be used with '-b\/-B\/--orphan'$/, 'switch-detach-*'],
  [/^fatal: '--orphan' cannot be used with '-t'$/, 'switch-orphan-tracking'],
  [/^fatal: '--orphan' cannot take <start-point>$/, 'switch-orphan-start'],
  [/^fatal: '--detach' cannot be used with '-t'$/, 'switch-detach-tracking'],
  [/^fatal: '-f' cannot be used with '-m'$/, 'switch-force-merge'],
  [/^fatal: '--discard-changes' cannot be used with '--merge'$/, 'switch-discard-merge'],
  [/^fatal: missing branch or commit argument$/, 'switch-target'],
  [/^fatal: only one reference expected$/, 'switch-arity'],
  [/^fatal: '--ignore-unmerged' cannot be used with updating paths$/, 'restore-ignore-unmerged-patch'],
  [/^fatal: options '--merge' and '--patch' cannot be used together$/, 'restore-patch-merge'],
  [/^fatal: options '--ignore-unmerged' and '-m' cannot be used together$/, 'restore-ignore-unmerged-merge'],
  [/^fatal: neither '--staged' or '--worktree' is specified$/, 'restore-destination-*'],
  [/^fatal: '--ours' or '--theirs' cannot be used with --staged$/, 'restore-staged-stage'],
  [/^fatal: '--merge' or '--conflict' cannot be used with --staged$/, 'restore-staged-merge'],
  [/^fatal: '--merge', '--ours', or '--theirs' cannot be used when checking out of a tree$/, 'restore-source-*'],
  [/^error: unknown conflict style '.*'$/, 'conflict-style'],
  [/^fatal: empty string is not a valid pathspec/, 'restore-empty-pathspec'],
  [/^fatal: could not resolve ''$/, 'restore-empty-source'],
  [/^fatal: '.*' is not a valid branch name$/, 'switch-*-name, switch-track-start-point'],
];
/** Outcomes decided from repository state; the typed API leaves them to Git. */
const DELEGATED = [
  /^fatal: invalid reference: /,
  /^fatal: a branch is expected, got /,
  /^fatal: cannot set up tracking information/,
  /^error: path '.*' does not have (our|their|necessary|all necessary) versions?$/,
  /^error: pathspec '/,
  /^fatal: no upstream configured for branch /,
  /^fatal: cannot force update the (current )?branch/,
  /^fatal: [Aa] branch named '.*' already exists\.?$/,
];
const SWITCH_WORDS = [
  ['--create', 'neu'],
  ['--force-create', 'neu'],
  ['--orphan', 'neu'],
  ['--detach'],
  ['--track'],
  ['--track', 'inherit'],
  ['--no-track'],
  ['--force'],
  ['--discard-changes'],
  ['--merge'],
  ['--no-merge'],
  ['--conflict', 'diff3'],
  ['--no-conflict'],
  ['--no-guess'],
];
const SWITCH_OPERANDS = [
  [],
  [operand('side')],
  [operand('origin/feat')],
  [operand('refs/remotes/origin/feat')],
  [operand('remotes/feat')],
  [operand('origin/')],
  [operand('side'), operand('main')],
];
/** New branch names for -c, -C and --orphan. */
const NEW_BRANCH_NAMES = [
  'ok/name',
  'a..b',
  'HEAD',
  '-x',
  'a.lock',
  'a b',
  'x~1',
  'a/.b',
  '.a',
  'a/',
  'a//b',
  'a@{b',
  '@{-1}',
  'main@{u}',
];
const RESTORE_WORDS = [
  ['--source', 'HEAD'],
  ['--source', ''],
  ['--no-source'],
  ['--staged'],
  ['--no-staged'],
  ['--worktree'],
  ['--no-worktree'],
  ['--ours'],
  ['--theirs'],
  ['--merge'],
  ['--no-merge'],
  ['--conflict', 'merge'],
  ['--no-conflict'],
  ['--ignore-unmerged'],
  ['--patch'],
  ['--no-patch'],
  ['--overlay'],
  ['--no-overlay'],
  ['--pathspec-from-file', '../oracle-paths'],
  ['--pathspec-file-nul'],
  ['--unified', '1'],
  ['--unified', '-2'],
  ['--unified', '-1'],
  ['--inter-hunk-context', '1'],
  ['--inter-hunk-context', '-2'],
];
const RESTORE_OPERANDS = [[], [operand('file')]];

try {
  await mkdir(directory);
  await writeFile(join(base, 'oracle-stdin'), '');
  await writeFile(join(base, 'oracle-paths'), 'file\n');
  await writeFile(join(base, 'oracle-paths-nul'), 'file\0');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  await writeFile(join(directory, 'file'), 'one\n');
  for (const args of [
    ['add', '--', 'file'],
    ['commit', '-qm', 'seed'],
    ['branch', 'side'],
    ['config', 'remote.origin.url', directory],
    ['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'],
    ['update-ref', 'refs/remotes/origin/feat', 'HEAD'],
    ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/feat'],
  ]) {
    if (git(args).status !== 0) throw new Error(`Cannot seed oracle: ${args.join(' ')}`);
  }
  /** Restore HEAD, the work tree, the branch list and @{-1} (side) before every case. */
  const reset = () => {
    for (const args of [['switch', '-qf', 'side'], ['switch', '-qf', 'main'], ['reset', '-q', '--hard']]) {
      if (git(args).status !== 0) throw new Error(`Cannot reset oracle: ${args.join(' ')}`);
    }
    const refs = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads']);
    if (refs.status !== 0) throw new Error(`Cannot list oracle branches: ${refs.stderr}`);
    for (const name of refs.stdout.split('\n')) {
      if (!name || name === 'main' || name === 'side') continue;
      const removed = git(['branch', '-qD', name]);
      if (removed.status !== 0) throw new Error(`Cannot delete oracle branch ${name}: ${removed.stderr}`);
    }
  };
  const cases = [];
  const record = (command, tokens) => {
    reset();
    const argv = [command, ...serialize(tokens)];
    const result = git(argv);
    if (![0, 1, 128, 129].includes(result.status)) {
      throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    }
    const diagnostic = result.stderr.split('\n').find((line) => /^(fatal|error):/.test(line)) ?? '';
    const delegated = result.status !== 0 && DELEGATED.some((pattern) => pattern.test(diagnostic));
    const rule = result.status !== 0 && !delegated ? RULES.find(([pattern]) => pattern.test(diagnostic))?.[1] : undefined;
    if (result.status !== 0 && !delegated && rule === undefined) {
      throw new Error(`Unexpected diagnostic ${JSON.stringify(argv)}: ${result.stderr}`);
    }
    cases.push({ command, tokens, argv, valid: result.status === 0, delegated, status: result.status, diagnostic, ...(rule ? { rule } : {}) });
  };
  for (const [command, words, operands] of [
    ['switch', SWITCH_WORDS, SWITCH_OPERANDS],
    ['restore', RESTORE_WORDS, RESTORE_OPERANDS],
  ]) {
    for (const tail of operands) {
      for (const first of words) {
        record(command, [first, ...tail]);
        for (const second of words) if (first !== second) record(command, [first, second, ...tail]);
      }
    }
  }
  // NUL-terminated pathspec files are accepted with --pathspec-file-nul.
  for (const extra of [[], [['--staged']], [['--worktree']], [['--source', 'HEAD']]]) {
    record('restore', [['--pathspec-from-file', '../oracle-paths-nul'], ['--pathspec-file-nul'], ...extra]);
  }
  for (const name of NEW_BRANCH_NAMES) {
    for (const option of ['--create', '--force-create', '--orphan']) record('switch', [[option, name]]);
  }
  // The derived name is checked only after the start point resolves, so the start points exist.
  const derived = [];
  for (const start of [
    'origin/HEAD',
    'refs/remotes/origin/HEAD',
    'remotes/origin/HEAD',
    'origin/feat',
    'refs/remotes/origin/feat',
    'remotes/origin/feat',
    'origin/feat@{0}',
    'origin/feat^{commit}',
    'refs/x',
    'remotes/',
    '@{u}',
    '-',
    'origin',
  ]) {
    for (const option of [['--track'], ['--no-track'], ['--track', 'inherit']]) {
      record('switch', [option, operand(start)]);
      derived.push(cases.at(-1));
    }
  }
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; isolated repository with main, side and a configured origin remote-tracking branch origin/feat; HEAD, work tree, branches and @{-1} (side) reset before every case; empty file-backed stdin; LF and NUL pathspec files outside the work tree',
      cases,
    },
    null,
    2,
  )}\n`;
  // Literal checks keep two decisive rows per command, diagnostic family and length; the
  // runtime test replays every case.
  const typeRows = { switch: [], restore: [] };
  const taken = new Map();
  // Every derived --track name row is a type witness, accepted or refused.
  for (const row of derived.filter((candidate) => !candidate.delegated)) typeRows.switch.push(row);
  // Numeric context bounds with --patch and a path: -1 is accepted and -2 is refused as negative.
  // Pinned acceptances: @{-1} as a forced new branch name and a NUL-separated pathspec file.
  for (const spelled of [
    ['restore', '--patch', '--unified=-1', 'file'],
    ['restore', '--patch', '--inter-hunk-context=-2', 'file'],
    ['switch', '--force-create=@{-1}'],
    ['restore', '--pathspec-from-file=../oracle-paths-nul', '--pathspec-file-nul'],
  ]) {
    const row = cases.find((candidate) => JSON.stringify(candidate.argv) === JSON.stringify(spelled));
    if (!row) throw new Error(`Missing pinned row ${spelled.join(' ')}`);
    typeRows[row.command].push(row);
  }
  for (const row of cases.filter((candidate) => !candidate.delegated && !typeRows[candidate.command].includes(candidate))) {
    // Quoted option names stay in the family, so each option's diagnostic keeps its own witnesses.
    const family = `${row.command}:${row.diagnostic.replace(/'(?!--)[^']*'/g, "''")}:${row.tokens.length}`;
    if ((taken.get(family) ?? 0) < 2) {
      taken.set(family, (taken.get(family) ?? 0) + 1);
      typeRows[row.command].push(row);
    }
  }
  const profile =
    "{ integerProfile: 'bounded'; firstPassEmpty: true; booleanSource: 'modern'; filenameProfile: 'optional'; decimalCallbacks: { 'unified-context': 'modern'; 'revision-count': 'modern'; 'strip-count': 'modern'; 'daemon-count': 'modern'; 'daemon-timeout': 'modern'; 'daemon-init-timeout': 'modern' } }";
  const types = `// Generated by node scripts/switch-restore-closure-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<C extends 'switch' | 'restore', A extends readonly GitCommandArgument<C>[]> = [CheckedCommandArguments<C, A, ${profile}>] extends [never] ? false : true;\nexport type NativeSwitchRestoreClosureCases = readonly [\n${[...typeRows.switch, ...typeRows.restore].map((row) => `  Check<Accepted<'${row.command}', ${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n')}\n];\n`;
  const outputs = [
    [new URL('test/fixtures/switch-restore-closure-corpus.json', root), fixture],
    [new URL('test/types/switch-restore-closure-corpus.ts', root), types],
  ];
  for (const [url, text] of outputs) {
    if (check) {
      if ((await readFile(url, 'utf8')) !== text) throw new Error(`${url.pathname} is stale`);
    } else {
      await writeFile(url, text);
    }
  }
  console.log(`Generated/checked ${cases.length} independent switch/restore closure outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

// Independent native oracle for git add's post-parse mode, value and pathspec-file rules.
// Each case runs in one dirty seeded repository; the index is reset after every case.
import { spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-add-rules-'));
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
  // Edit mode applies the unchanged patch, so reaching it is an ordinary success.
  GIT_EDITOR: 'true',
};
/** Execute native Git with file-backed stdin and report abnormal termination. */
function git(args) {
  // Interactive selection reads one unrecognized answer and then end of input.
  const input = openSync(join(base, 'oracle-stdin'), 'r');
  try {
    const result = spawnSync('git', args, {
      cwd: directory,
      env,
      stdio: [input, 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 60000,
    });
    if (result.error || result.signal) {
      throw result.error ?? new Error(`Git terminated: ${result.signal}`);
    }
    return result;
  } finally {
    closeSync(input);
  }
}
/** Keep literal native words independent of the production parser. */
const operand = (value) => ({ operand: value });
/** Spell documented API tokens without importing production validation. */
const serialize = (tokens) =>
  tokens.flatMap((token) =>
    !Array.isArray(token)
      ? [token.operand]
      : token.length === 1
        ? token
        : token[0].startsWith('--')
          ? [`${token[0]}=${token[1]}`]
          : token,
  );
const LF_FILE = '../oracle-paths';
const NUL_FILE = '../oracle-paths-nul';
// Pathspec files live outside the work tree so that --all never stages them.
const words = [
  ['-n'],
  ['-v'],
  ['-i'],
  ['-p'],
  ['-e'],
  ['-u'],
  ['-A'],
  ['--no-all'],
  ['--ignore-removal'],
  ['--no-ignore-removal'],
  ['--renormalize'],
  ['--refresh'],
  ['--ignore-missing'],
  ['--chmod', '+x'],
  ['--chmod', 'x'],
  ['--chmod', '-x'],
  ['--chmod', ''],
  ['--chmod', '+xx'],
  ['--pathspec-from-file', LF_FILE],
  ['--pathspec-from-file', ''],
  ['--no-pathspec-from-file'],
  ['--pathspec-file-nul'],
  ['--unified', '1'],
  ['--unified', '-1'],
  ['--unified', '-2'],
  ['--inter-hunk-context', '1'],
  ['--inter-hunk-context', '-1'],
  ['--inter-hunk-context', '-2'],
  ['--no-auto-advance'],
  operand('file'),
];
/** Final cmd_add rule diagnostics in Git 2.55.0; any other failure aborts generation. */
const RULE_DIAGNOSTICS = [
  /^fatal: '--(unified|inter-hunk-context)' cannot be negative$/,
  /^fatal: options '--dry-run' and '--interactive\/--patch' cannot be used together$/,
  /^fatal: options '--pathspec-from-file' and '--(interactive\/--patch|edit)' cannot be used together$/,
  /^fatal: the option '--(unified|inter-hunk-context|no-auto-advance)' requires '--interactive\/--patch'$/,
  /^fatal: options '-A' and '-u' cannot be used together$/,
  /^fatal: the option '--ignore-missing' requires '--dry-run'$/,
  /^fatal: --chmod param '[^']*' must be either -x or \+x$/,
  /^fatal: '--pathspec-from-file' and pathspec arguments cannot be used together$/,
  /^fatal: the option '--pathspec-file-nul' requires '--pathspec-from-file'$/,
];
/** Read NUL-separated input whenever the final native state selects NUL mode. */
const pathspecInput = (tokens) =>
  tokens.some((token) => Array.isArray(token) && token[0] === '--pathspec-file-nul')
    ? tokens.map((token) =>
        Array.isArray(token) && token[0] === '--pathspec-from-file' && token[1] === LF_FILE
          ? [token[0], NUL_FILE]
          : token,
      )
    : tokens;
try {
  await mkdir(directory);
  await writeFile(join(base, 'oracle-stdin'), 'file\n');
  await writeFile(join(base, 'oracle-paths'), 'file\n');
  await writeFile(join(base, 'oracle-paths-nul'), 'file\0');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') {
    throw new Error('The oracle requires Git 2.55.0');
  }
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  await writeFile(join(directory, 'file'), 'one\n');
  if (git(['add', '--', 'file']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) {
    throw new Error('Cannot seed oracle');
  }
  // A tracked modification gives update, edit and patch modes real work to reach.
  await writeFile(join(directory, 'file'), 'one\ntwo\n');
  const cases = [];
  /** Record one classified native outcome and restore the seeded index. */
  const record = (tokens) => {
    const argv = ['add', ...serialize(tokens)];
    const result = git(argv);
    if (![0, 128, 129].includes(result.status)) {
      throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    }
    const diagnostic = result.stderr.split('\n').find((line) => /^(fatal|error):/.test(line));
    // A state failure (unmatched pathspec, unreadable file) must never be recorded as a rule.
    if (result.status !== 0 && !RULE_DIAGNOSTICS.some((pattern) => pattern.test(diagnostic ?? ''))) {
      throw new Error(`Unexpected diagnostic ${JSON.stringify(argv)}: ${result.stderr}`);
    }
    cases.push({
      command: 'add',
      tokens,
      argv,
      valid: result.status === 0,
      status: result.status,
      diagnostic: diagnostic ?? '',
    });
    if (git(['reset', '-q']).status !== 0) throw new Error('Cannot restore oracle index');
  };
  const sequences = [];
  for (const first of words) {
    for (const second of words) if (first !== second) sequences.push([first, second]);
  }
  // Mode words share one last-wins variable; every ordered triple exercises the final state.
  const modes = [['-u'], ['-A'], ['--no-all'], ['--ignore-removal'], ['--no-ignore-removal']];
  for (const a of modes) {
    for (const b of modes) {
      for (const c of modes) if (a !== b && b !== c && a !== c) sequences.push([a, b, c]);
    }
  }
  // Later empty or negated pathspec files restore the unset pointer before final rules.
  const files = [['--pathspec-from-file', ''], ['--no-pathspec-from-file']];
  const followers = [operand('file'), ['--pathspec-file-nul'], ['-i'], ['-p'], ['-e']];
  for (const reset of files) {
    for (const follower of followers) {
      sequences.push(
        [['--pathspec-from-file', LF_FILE], reset, follower],
        [follower, ['--pathspec-from-file', LF_FILE], reset],
        [reset, ['--pathspec-from-file', LF_FILE], follower],
      );
    }
  }
  // Interactive modes dominate later checks; edit mode precedes final non-edit checks.
  for (const mode of [['-i'], ['-p'], ['-e']]) {
    for (const [a, b] of [
      [['-A'], ['-u']],
      [['--chmod', 'x'], ['--ignore-missing']],
      [['--pathspec-file-nul'], operand('file')],
      [['--unified', '1'], ['--inter-hunk-context', '1']],
    ]) {
      sequences.push([mode, a, b]);
    }
  }
  const unique = new Map(
    sequences.map((tokens) => pathspecInput(tokens)).map((tokens) => [JSON.stringify(tokens), tokens]),
  );
  for (const tokens of unique.values()) record(tokens);
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; isolated seeded repository with one modified tracked file; index reset after every case; GIT_EDITOR=true; pathspec files outside the work tree with LF or NUL input according to the final NUL mode; file-backed stdin with one unrecognized interactive answer',
      cases,
    },
    null,
    2,
  )}\n`;
  // The contract compiler is near its heap limit, so literal checks take two pair and two
  // triple rows per native outcome family plus the pointer-reset triples; the runtime test still replays every case.
  const typeRows = [];
  const taken = new Map();
  for (const row of cases) {
    const family = `${row.diagnostic.replace(/'[^']*'/g, "''")}:${row.tokens.length}`;
    // Every pointer-reset triple is kept: unpinned and pinned filename profiles disagree there.
    const pointerReset =
      row.tokens.length === 3 &&
      row.tokens.some(
        (token) =>
          Array.isArray(token) &&
          (token[0] === '--no-pathspec-from-file' ||
            (token[0] === '--pathspec-from-file' && token[1] === '')),
      );
    if (pointerReset) {
      typeRows.push(row);
    } else if ((taken.get(family) ?? 0) < 2) {
      taken.set(family, (taken.get(family) ?? 0) + 1);
      typeRows.push(row);
    }
  }
  // Pin the Git 2.55.0 filename pointer profile; unpinned literal checks accept any profile.
  const types = `// Generated by node scripts/add-rule-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<A extends readonly GitCommandArgument<'add'>[]> = [CheckedCommandArguments<'add', A, { integerProfile: 'bounded'; firstPassEmpty: true; booleanSource: 'modern'; filenameProfile: 'optional'; decimalCallbacks: { 'unified-context': 'modern'; 'revision-count': 'modern'; 'strip-count': 'modern'; 'daemon-count': 'modern'; 'daemon-timeout': 'modern'; 'daemon-init-timeout': 'modern' } }>] extends [never] ? false : true;\nexport type NativeAddRuleCases = readonly [\n${typeRows.map((row) => `  Check<Accepted<${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n')}\n];\n`;
  for (const [path, content] of [
    ['test/fixtures/add-rule-corpus.json', fixture],
    ['test/types/add-rule-corpus.ts', types],
  ]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if ((await readFile(target, 'utf8').catch(() => '')) !== content) {
        throw new Error(`${path} is stale`);
      }
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent add rule outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

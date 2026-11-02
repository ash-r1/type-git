// Independent native oracle for status/commit empty pathspecs and pathless commit --only.
// Every commit case is a dry run, so the seeded repository never changes between cases.
import { spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-status-commit-paths-'));
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
// The pathspec file lives outside the work tree and names the modified tracked file.
const PATHS = '../oracle-paths';
/** Static diagnostics these cases may reach in Git 2.55.0; any other failure aborts generation. */
const RULE_DIAGNOSTICS = [
  /^fatal: empty string is not a valid pathspec\. please use \. instead if you meant to match all paths$/,
  /^fatal: No paths with --include\/--only does not make sense\.$/,
  /^fatal: options '[^']*' and '[^']*'(?: and '[^']*')* cannot be used together$/,
  /^fatal: '--pathspec-from-file' and pathspec arguments cannot be used together$/,
];
try {
  await mkdir(directory);
  await writeFile(join(base, 'oracle-stdin'), '');
  await writeFile(join(base, 'oracle-paths'), 'file\n');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') {
    throw new Error('The oracle requires Git 2.55.0');
  }
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  await writeFile(join(directory, 'file'), 'one\n');
  if (git(['add', '--', 'file']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) {
    throw new Error('Cannot seed oracle');
  }
  await writeFile(join(directory, 'file'), 'one\ntwo\n');
  const head = git(['rev-parse', 'HEAD']).stdout.trim();
  const cases = [];
  /** Record one classified native outcome; a dry run that finds nothing to commit exits 1. */
  const record = (command, tokens) => {
    const argv = [command, ...serialize(tokens)];
    const result = git(argv);
    const usage = result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr;
    const diagnostic = result.stderr.split('\n').find((line) => /^(fatal|error):/.test(line));
    const valid = result.status === 0 || result.status === 1 || usage;
    if (!valid && !(result.status === 128 && RULE_DIAGNOSTICS.some((p) => p.test(diagnostic ?? '')))) {
      throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    }
    if (valid && diagnostic) {
      throw new Error(`Unexpected diagnostic ${JSON.stringify(argv)}: ${result.stderr}`);
    }
    cases.push({ command, tokens, argv, valid, status: result.status, diagnostic: diagnostic ?? '' });
  };
  // status: every operand is a pathspec, before or after the end marker; help exits first.
  for (const prefix of [[], [['--short']], [['--porcelain', 'v2']], [['-z']]]) {
    for (const operands of [[operand('')], [operand('file')], [operand('file'), operand('')]]) {
      record('status', [...prefix, ...operands]);
      record('status', [...prefix, ['--'], ...operands]);
    }
  }
  record('status', [['-h'], operand('')]);
  record('status', [operand(''), ['-h']]);
  // commit: only-mode exemptions with last-wins negations, all under --dry-run.
  const words = [
    ['--only'],
    ['-o'],
    ['--no-only'],
    ['--allow-empty'],
    ['--no-allow-empty'],
    ['--amend'],
    ['--no-amend'],
    ['--fixup', 'HEAD'],
    ['--fixup', 'amend:HEAD'],
    ['--fixup', ''],
    ['--no-fixup'],
    ['--pathspec-from-file', PATHS],
    operand('file'),
    operand(''),
  ];
  const sequences = [];
  for (const a of words) {
    sequences.push([['--dry-run'], a]);
    for (const b of words) if (a !== b) sequences.push([['--dry-run'], a, b]);
  }
  // Ordered exemption/cancellation triples after --only exercise the final prepare_index state.
  const exemptions = [['--allow-empty'], ['--no-allow-empty'], ['--amend'], ['--no-amend'], ['--fixup', 'HEAD'], ['--fixup', 'amend:HEAD'], ['--no-fixup']];
  for (const a of exemptions) {
    for (const b of exemptions) {
      for (const c of exemptions) if (a !== b && b !== c && a !== c) sequences.push([['--dry-run'], ['--only'], a, b, c]);
    }
  }
  // Status formats imply a dry run; help exits before either final check.
  sequences.push(
    [['--short'], operand('')],
    [['--porcelain'], ['--only']],
    [['--only'], ['-h']],
    [['--only'], operand(''), ['-h']],
    [['--dry-run'], ['--'], operand('file'), operand('')],
  );
  const unique = new Map(sequences.map((tokens) => [JSON.stringify(tokens), tokens]));
  for (const tokens of unique.values()) record('commit', tokens);
  if (git(['rev-parse', 'HEAD']).stdout.trim() !== head) throw new Error('A case wrote a commit');
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; isolated seeded repository with one modified unstaged tracked file; commit cases are dry runs or status formats; pathspec file outside the work tree naming that file; empty file-backed stdin',
      cases,
    },
    null,
    2,
  )}\n`;
  // The contract compiler is near its heap limit, so literal checks take two rows per command,
  // native outcome family and length; the runtime test replays every case.
  const typeRows = [];
  const taken = new Map();
  for (const row of cases) {
    const family = `${row.command}:${row.valid}:${row.diagnostic.replace(/'[^']*'/g, "''")}:${row.tokens.length}`;
    if ((taken.get(family) ?? 0) < 2) {
      taken.set(family, (taken.get(family) ?? 0) + 1);
      typeRows.push(row);
    }
  }
  const profile = "{ integerProfile: 'bounded'; firstPassEmpty: true; booleanSource: 'modern'; decimalCallbacks: { 'unified-context': 'modern'; 'revision-count': 'modern'; 'strip-count': 'modern'; 'daemon-count': 'modern'; 'daemon-timeout': 'modern'; 'daemon-init-timeout': 'modern' } }";
  const types = `// Generated by node scripts/status-commit-path-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<C extends 'status' | 'commit', A extends readonly GitCommandArgument<C>[]> = [CheckedCommandArguments<C, A, ${profile}>] extends [never] ? false : true;\nexport type NativeStatusCommitPathCases = readonly [\n${typeRows.map((row) => `  Check<Accepted<${JSON.stringify(row.command)}, ${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n')}\n];\n`;
  for (const [path, content] of [
    ['test/fixtures/status-commit-path-corpus.json', fixture],
    ['test/types/status-commit-path-corpus.ts', types],
  ]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if ((await readFile(target, 'utf8').catch(() => '')) !== content) {
        throw new Error(`${path} is stale`);
      }
    } else await writeFile(target, content);
  }
  console.log(
    `Generated/checked ${cases.length} independent status/commit path outcomes (${typeRows.length} compiler rows).`,
  );
} finally {
  await rm(base, { recursive: true, force: true });
}

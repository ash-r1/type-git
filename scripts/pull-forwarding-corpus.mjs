// Independent native oracle for the options and operands git pull forwards to git fetch.
// Each case runs in a fresh copy of one shallow clone of a local two-commit upstream.
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-pull-forwarding-'));
const upstream = join(base, 'upstream');
const template = join(base, 'template');
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
  GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.test',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.test',
};
const expected = process.env.TYPE_GIT_PULL_ORACLE_VERSION ?? '2.55.0';
/** Execute native Git without a terminal; abnormal termination aborts generation. */
function git(args, cwd = directory) {
  const result = spawnSync('git', args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 60000,
  });
  if (result.error || result.signal) {
    throw result.error ?? new Error(`Git terminated: ${result.signal}`);
  }
  return result;
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
          : [`${token[0]}${token[1]}`],
  );
// A forwarded word that fetch can only accept as an option name; it never runs a command.
const PROBE = '--type-git-forwarded-probe';
const words = [
  ['--depth', '1'],
  ['--depth', '0'],
  ['--depth', 'x'],
  ['--no-depth'],
  ['--deepen', '1'],
  ['--deepen', '0'],
  ['--deepen', '-1'],
  ['--no-deepen'],
  ['--unshallow'],
  ['--jobs', '2'],
  ['--jobs', 'x'],
  ['--jobs', ''],
  ['--jobs'],
  ['-j'],
  ['--no-jobs'],
  ['--all'],
  ['--no-all'],
  ['--cleanup', 'strip'],
  ['--rebase'],
  operand('origin'),
];
/** Pull and fetch diagnostics for the modeled forwarding rules; any other failure aborts. */
const RULE_DIAGNOSTICS = [
  /^fatal: options '--deepen' and '--depth' cannot be used together$/,
  /^fatal: options '--depth' and '--unshallow' cannot be used together$/,
  /^fatal: negative depth in --deepen is not supported$/,
  /^fatal: depth .* is not a positive number$/,
  /^error: (option `(jobs|deepen)'|switch `j') (expects a numerical value|expects an integer value with an optional k\/m\/g suffix|requires a value)$/,
  /^error: value \S+ for option `(jobs|deepen)' not in range \[-2147483648,2147483647\]$/,
  /^fatal: fetch --all does not take a repository argument$/,
  /^fatal: fetch --all does not make sense with refspecs$/,
  /^error: unknown option `type-git-forwarded-probe'$/,
];
/** Record one classified pull outcome in a fresh copy of the seeded clone. */
async function run(tokens, dryRun) {
  await rm(directory, { recursive: true, force: true });
  await cp(template, directory, { recursive: true });
  const firstOperand = tokens.findIndex((token) => !Array.isArray(token) || token[0] === '--');
  const at = firstOperand < 0 ? tokens.length : firstOperand;
  const full = dryRun ? [...tokens.slice(0, at), ['--dry-run'], ...tokens.slice(at)] : tokens;
  const argv = ['pull', ...serialize(full)];
  const result = git(argv);
  if (![0, 1, 128, 129].includes(result.status)) {
    throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
  }
  const diagnostic =
    result.stderr.split('\n').find((line) => /^(fatal|error):/.test(line)) ?? '';
  if (result.status !== 0 && !RULE_DIAGNOSTICS.some((pattern) => pattern.test(diagnostic))) {
    throw new Error(`Unexpected diagnostic ${JSON.stringify(argv)}: ${result.stderr}`);
  }
  return { tokens: full, argv, valid: result.status === 0, status: result.status, diagnostic };
}
try {
  await mkdir(upstream);
  const version = git(['--version'], base).stdout.trim();
  if (version !== `git version ${expected}`) {
    throw new Error(`The oracle requires Git ${expected}, found ${version}`);
  }
  if (git(['init', '-qb', 'main'], upstream).status !== 0) throw new Error('Cannot initialize');
  for (const message of ['one', 'two']) {
    await writeFile(join(upstream, 'file'), `${message}\n`);
    if (
      git(['add', '--', 'file'], upstream).status !== 0 ||
      git(['commit', '-qm', message], upstream).status !== 0
    ) {
      throw new Error('Cannot seed upstream');
    }
  }
  // A shallow clone makes depth, deepen and unshallow reach real transfers.
  const url = pathToFileURL(upstream).href;
  if (git(['clone', '-q', '--depth', '1', url, template], base).status !== 0) {
    throw new Error('Cannot clone upstream');
  }
  const cases = [];
  const record = async (tokens, dryRun = true) => {
    cases.push({ command: 'pull', dryRun, ...(await run(tokens, dryRun)) });
  };
  const sequences = [];
  for (const first of words) {
    for (const second of words) {
      if (first !== second && Array.isArray(first)) sequences.push([first, second]);
    }
  }
  // Final values: pull keeps only the last --depth/--jobs but forwards every --deepen word.
  sequences.push(
    [['--jobs', 'x'], ['--jobs', '2']],
    [['--jobs', '2'], ['--jobs', 'x']],
    [['--depth', 'x'], ['--depth', '1']],
    [['--deepen', '1'], ['--no-deepen'], ['--depth', '1']],
    [['--deepen', '1'], ['--deepen', '0'], ['--unshallow']],
    [['--deepen', '-1'], ['--deepen', '1']],
    [['--depth', '1'], ['--no-depth'], ['--unshallow']],
  );
  // Value boundaries: fetch parses each forwarded word with its own OPT_INTEGER grammar.
  const boundaries = [
    [['--deepen', 'x']],
    [['--deepen', 'x'], ['--deepen', '1']],
    [['--deepen', '1k']],
    [['--deepen', '2147483648']],
    [['--jobs', '1k']],
    [['--jobs', '0x10']],
    [['--jobs', '2147483648']],
    [['-j', '2']],
    [['-j', 'x']],
    [['--depth', '']],
    [['--depth', '2147483648']],
  ];
  sequences.push(...boundaries);
  // Pull consumes --; fetch then reparses every forwarded repository and refspec word.
  sequences.push(
    [['--'], operand(PROBE)],
    [operand('origin'), operand(PROBE)],
    [['--'], operand('origin'), operand(PROBE)],
    [['--'], operand('origin'), operand('main')],
  );
  const unique = new Map(sequences.map((tokens) => [JSON.stringify(tokens), tokens]));
  for (const tokens of unique.values()) await record(tokens);
  // Without --dry-run a valueless count takes the forwarded repository word as its value.
  for (const tokens of [
    [['-j'], operand('2')],
    [['--jobs'], operand('2')],
    [['-j'], operand('origin')],
    [['-j']],
  ]) {
    await record(tokens, false);
  }
  const fixture = `${JSON.stringify(
    {
      profile: `Git ${expected}; fresh copy of a depth-1 file:// clone of a two-commit upstream for every case; --dry-run inserted after the options unless dryRun is false; isolated configuration`,
      cases,
    },
    null,
    2,
  )}\n`;
  // The contract compiler is near its heap limit: take two rows per native outcome family.
  // Literal checks pin the Git 2.55.0 bounded integer profile; unpinned checks accept any profile.
  const typeRows = [];
  const taken = new Map();
  const pinned = new Set(boundaries.map((tokens) => JSON.stringify(tokens)));
  for (const row of cases.filter((candidate) => candidate.dryRun)) {
    // Every separator and boundary row is kept: they pin the forwarded-operand and value checks.
    const source = JSON.stringify(row.tokens.filter((token) => token[0] !== '--dry-run'));
    // Initial-depth atoi width is a runtime-observed profile with no literal context pin.
    if (row.tokens.some((token) => token[0] === '--depth' && token[1] === '2147483648')) continue;
    if (pinned.has(source) || row.tokens.some((token) => Array.isArray(token) && token[0] === '--')) {
      typeRows.push(row);
      continue;
    }
    const family = `${row.valid}:${row.diagnostic.replace(/'[^']*'|`[^']*'|depth \S+/g, '')}`;
    if ((taken.get(family) ?? 0) < 2) {
      taken.set(family, (taken.get(family) ?? 0) + 1);
      typeRows.push(row);
    }
  }
  const types = `// Generated by node scripts/pull-forwarding-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<A extends readonly GitCommandArgument<'pull'>[]> = [CheckedCommandArguments<'pull', A, { integerProfile: 'bounded' }>] extends [never] ? false : true;\nexport type NativePullForwardingCases = readonly [\n${typeRows.map((row) => `  Check<Accepted<${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n')}\n];\n`;
  for (const [path, content] of [
    ['test/fixtures/pull-forwarding-corpus.json', fixture],
    ['test/types/pull-forwarding-corpus.ts', types],
  ]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if ((await readFile(target, 'utf8').catch(() => '')) !== content) {
        throw new Error(`${path} is stale`);
      }
    } else if (process.argv.includes('--dry')) {
      console.log(content.slice(0, 2000));
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent pull forwarding outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

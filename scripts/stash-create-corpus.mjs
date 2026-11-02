// Independent Git outcomes for stash create, whose child never parses options.
// Every word after "create" is joined with spaces into the stash message, so the oracle
// records both the exit and the stored message for clean and modified worktrees.
import { spawnSync } from 'node:child_process';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-stash-create-'));
const env = { ...nativeOracleBaseEnv(), HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', LC_ALL: 'C', GIT_PAGER: 'cat', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test', GIT_AUTHOR_DATE: '2005-04-07T22:13:13Z', GIT_COMMITTER_DATE: '2005-04-07T22:13:13Z' };
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CONFIG_PARAMETERS', 'GIT_PREFIX']) delete env[name];
/** Execute the selected pinned Git only in the owned create fixture repository. */
function git(args) {
  const result = spawnSync('git', args, { cwd: directory, env, input: '', encoding: 'utf8', timeout: 60000 });
  if (result.error || result.signal) throw result.error ?? new Error(`Git terminated: ${result.signal}`);
  return result;
}
/** Represent a literal argv word independently of the option resolver. */
const operand = value => ({ operand: value });
try {
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  await writeFile(join(directory, 'file'), 'one\n');
  if (git(['add', 'file']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) throw new Error('Cannot seed oracle');
  // Words chosen from every parse-options entry point an option parser would react to:
  // help and its long forms, completion, both terminators, typo detection, clusters,
  // unknown options, and message bytes (empty, spaces, non-ASCII, control characters).
  const words = ['message', '', ' ', '-h', '-hx', '-xh', '--help', '--help-all', '--he', '--', '--end-of-options',
    '--git-completion-helper', '-no-message', '-q', '--quiet', '--message=x', '-m', '--unknown', '-',
    'é', 'tab\there', 'line\nbreak', 'cr\rhere', '\u0001'];
  const pairs = ['message', '', '-h', '--help', '--', '--end-of-options', '-no-message', '--unknown'];
  const sequences = [[], ...words.map(word => [word])];
  for (const first of pairs) for (const second of pairs) sequences.push([first, second]);
  for (const middle of ['--', '--end-of-options']) {
    sequences.push(['message', middle, '-h'], ['-q', middle, '--help'], [middle, middle, middle]);
  }
  const cases = [];
  for (const state of ['clean', 'modified']) {
    await writeFile(join(directory, 'file'), state === 'clean' ? 'one\n' : 'two\n');
    // A same-content rewrite leaves the file stat-dirty, and create then exits 1 silently
    // (its quick tracked-change check sees the stat change, the refresh finds nothing).
    // Settle the index so each state is decided by content, not by the clock.
    if (git(['update-index', '-q', '--refresh']).status > 1) throw new Error('Cannot refresh oracle index');
    for (const sequence of sequences) {
      const argv = ['stash', 'create', ...sequence];
      const result = git(argv);
      if (![0, 129].includes(result.status)) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
      const oid = result.stdout.trim();
      let message = null;
      if (result.status === 0 && oid) {
        if (!/^[0-9a-f]{40}$/.test(oid)) throw new Error(`Unexpected create output ${JSON.stringify(argv)}`);
        const shown = git(['log', '-1', '--format=%B', oid]);
        if (shown.status !== 0) throw new Error(`Cannot read stash message for ${JSON.stringify(argv)}`);
        message = shown.stdout.replace(/\n+$/, '');
        const joined = sequence.join(' ');
        if (state !== 'modified' || (joined ? message !== `On main: ${joined}` : !/^WIP on main: [0-9a-f]+ seed$/.test(message))) throw new Error(`Unexpected stash message for ${JSON.stringify(argv)}: ${JSON.stringify(message)}`);
      } else if (result.status === 0 && (result.stdout || state === 'modified')) {
        throw new Error(`Modified worktree created no stash for ${JSON.stringify(argv)}`);
      }
      const valid = result.status === 0 || (result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr);
      const outcome = { valid, status: result.status, created: message !== null, message, diagnostic: result.stderr.split('\n')[0] };
      const tokens = sequence.map(operand);
      cases.push({ command: 'stash create', state, tokens, argv, ...outcome });
      cases.push({ command: 'stash', state, tokens: [operand('create'), ...tokens], argv, ...outcome });
    }
  }
  const fixture = JSON.stringify({ profile: 'Git 2.55.0; isolated seeded repository in clean and modified worktree states; every create word is message text joined by single spaces; stdin empty', cases }, null, 2) + '\n';
  const unique = new Map(cases.map(row => [JSON.stringify([row.command, row.tokens]), row]));
  const types = `// Generated by node scripts/stash-create-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument, GitCommandName } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[]> = [CheckedCommandArguments<C, A, { stashParent: 'modern' }>] extends [never] ? false : true;\nexport type NativeStashCreateCases = readonly [\n` + [...unique.values()].map(row => `  Check<Accepted<${JSON.stringify(row.command)}, ${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
  for (const [path, content] of [['test/fixtures/stash-create-corpus.json', fixture], ['test/types/stash-create-corpus.ts', types]]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length / 2} native stash create runs recorded as ${cases.length} wrapper cases.`);
} finally { await rm(directory, { recursive: true, force: true }); }

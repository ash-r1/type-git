// Independent native oracle for the --max-depth and --find-object combination rules of the
// plumbing diffs (diff-files, diff-index, diff-tree). Outcomes come from Git 2.55.0 itself, run in
// a two-commit repository with a clean and a modified worktree/index; sample values are
// hand-picked from diff.c and diffcore-pickaxe.c. No Type-Git schema or validator decides a case.
import { closeSync, openSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { oracleEnv } from './checkout-oracle.mjs';

const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-diff-plumbing-'));
const work = join(directory, 'work');
const env = { ...oracleEnv(directory), GIT_CEILING_DIRECTORIES: directory };
/** Run native Git in the fixture repository with empty file-backed stdin; signals are recorded. */
function git(args) {
  const input = openSync(join(directory, 'oracle-input'), 'r');
  try {
    const result = spawnSync('git', ['-C', work, ...args], { env, stdio: [input, 'pipe', 'pipe'], encoding: 'utf8', timeout: 60000 });
    if (result.error) throw result.error;
    return result;
  } finally { closeSync(input); }
}
/** Run a fixture setup step, which must succeed. */
function setup(args) {
  const result = git(args);
  if (result.status !== 0 || result.signal) throw new Error(`Setup failed: ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}
const operand = value => ({ operand: value });
/** Spell API tokens independently: long values attach with "=", short values are separate words. */
const serialize = tokens => tokens.flatMap(token => {
  if (!Array.isArray(token)) return [token.operand];
  if (token.length === 1) return [token[0]];
  const [flag, value] = token;
  return flag.startsWith('--') ? [`${flag}=${value}`] : [flag, String(value)];
});

/**
 * Classify one run. A diff succeeds with status 0 and no diagnostics. A row ending in -h is a
 * help request: it succeeds when Git exits 129 with only its usage text (a residual -h reaches
 * usage() on stderr, before any option-dependent die). Any other diagnostic (error, fatal or
 * usage) or Git's own BUG() abort is a refusal.
 */
function classify(argv, state, result) {
  if (result.signal) {
    if (result.signal === 'SIGABRT' && /^BUG: /m.test(result.stderr)) return false;
    throw new Error(`Git terminated: ${result.signal} ${JSON.stringify(argv)} (${state})`);
  }
  const help = argv.at(-1) === '-h' && result.status === 129 && /^usage: /.test(result.stdout + result.stderr) && !/^(BUG|fatal|error):/m.test(result.stderr);
  const ok = help || (result.status === 0 && result.stderr === '');
  const failed = (result.status === 129 && /^(error|usage):/m.test(result.stderr)) || (result.status === 128 && /^(fatal|error):/m.test(result.stderr));
  if (!ok && !failed) throw new Error(`Unclassified ${JSON.stringify(argv)} (${state}): ${result.status}: ${result.stdout.slice(0, 200)}${result.stderr.slice(0, 200)}`);
  return ok;
}

/** Restore the clean state, or dirty both the worktree and the index for the "modified" state. */
async function seedState(state) {
  setup(['reset', '-q', '--hard', 'HEAD']);
  if (state === 'modified') {
    await writeFile(join(work, 'dir', 'file'), 'one\ntwo x\n');
    await writeFile(join(work, 'staged'), 'staged x\n');
    setup(['add', 'staged']);
  }
}

try {
  await writeFile(join(directory, 'oracle-input'), '');
  await mkdir(join(work, 'dir'), { recursive: true });
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  setup(['init', '-q']);
  await writeFile(join(work, 'dir', 'file'), 'one\ntwo\n');
  await writeFile(join(work, 'staged'), 'staged\n');
  setup(['add', '.']);
  setup(['commit', '-qm', 'root']);
  await writeFile(join(work, 'dir', 'file'), 'one\ntwo\nthree x\n');
  setup(['commit', '-qam', 'second']);

  // Each command form places the sampled options before its fixed operands. diff-tree on the
  // root commit alone runs no diff, so the pickaxe abort depends on the repository there.
  const forms = [
    { command: 'diff-files', prefix: [], operands: [] },
    { command: 'diff-index', prefix: [], operands: [operand('HEAD')] },
    { command: 'diff-index', prefix: [['--cached']], operands: [operand('HEAD')] },
    { command: 'diff-index', prefix: [['-m']], operands: [operand('HEAD')] },
    { command: 'diff-index', prefix: [['--merge-base']], operands: [operand('HEAD')] },
    { command: 'diff-tree', prefix: [['-r']], operands: [operand('HEAD~1'), operand('HEAD')] },
    { command: 'diff-tree', prefix: [['-r']], operands: [operand('HEAD~1')] },
  ];
  const optionSets = [
    ...[-2, -1, 0, 1, 2147483647].map(depth => [['--max-depth', depth]]),
    [['--max-depth', 1], ['--max-depth', -1]], [['--max-depth', -1], ['--max-depth', 1]],
    [['--max-depth', 0], ['--max-depth', -1]], [['--max-depth', -1], ['--max-depth', 0]],
    [['--max-depth', 1], ['--name-only']],
    [['--find-object', 'HEAD']], [['--find-object', 'HEAD'], ['--pickaxe-all']],
    [['--find-object', 'HEAD'], ['--pickaxe-regex']], [['--pickaxe-regex'], ['--find-object', 'HEAD']],
    [['--find-object', 'HEAD'], ['-i']], [['-i'], ['--find-object', 'HEAD']],
    [['--find-object', 'HEAD'], ['--regexp-ignore-case']],
    [['--find-object', 'HEAD'], ['--pickaxe-regex'], ['-i']],
    [['-S', 'x'], ['--pickaxe-regex']], [['-S', 'x'], ['-i']], [['-G', 'x'], ['-i']],
  ];
  /** Rows with a trailing -h exit with usage before any diff or option-dependent die. */
  const withHelp = [[['--max-depth', 1]], [['--max-depth', 0]], [['--find-object', 'HEAD'], ['--pickaxe-regex']], [['--find-object', 'HEAD'], ['-i']]];

  const states = ['clean', 'modified'];
  const cases = [];
  /** Run one row in every state; it is valid only when Git accepts it in all of them. */
  const record = async (form, tokens) => {
    const argv = [form.command, ...serialize(tokens)];
    const outcomes = [];
    for (const state of states) {
      await seedState(state);
      const result = git(argv);
      outcomes.push({ state, valid: classify(argv, state, result), status: result.signal ?? result.status, diagnostic: (result.stderr.split('\n').find(line => /^(BUG|fatal|error|usage):/.test(line)) ?? '').trim() });
    }
    const failure = outcomes.find(outcome => !outcome.valid);
    const acceptedIn = outcomes.filter(outcome => outcome.valid).map(outcome => outcome.state);
    // diff-tree's pickaxe abort depends on whether the trees produce a diff queue.
    const delegated = form.command === 'diff-tree' && tokens.some(token => Array.isArray(token) && token[0] === '--find-object') ? { delegated: 'repository' } : {};
    cases.push({ command: form.command, tokens, argv, valid: !failure, ...(failure ? { status: failure.status, state: failure.state, diagnostic: failure.diagnostic } : {}), ...(failure && acceptedIn.length ? { acceptedIn } : {}), ...delegated });
  };
  for (const form of forms) {
    for (const options of optionSets) await record(form, [...form.prefix, ...options, ...form.operands]);
    for (const options of withHelp) await record(form, [...form.prefix, ...options, ...form.operands, ['-h']]);
  }

  const profile = 'Git 2.55.0, LC_ALL=C; two-commit repository with a clean and with a modified worktree and index (valid only when both succeed); empty stdin; a residual -h is valid when it prints usage';
  const fixture = JSON.stringify({ profile, cases }, null, 1) + '\n';
  // Literal-type witnesses: a few accepted and refused grammar-decided rows per rule, kept small
  // for the contract type-check heap; every row is still compared with the runtime builder.
  const witness = (command, tokens) => {
    const row = cases.find(entry => entry.command === command && JSON.stringify(entry.tokens) === JSON.stringify(tokens));
    if (!row || row.delegated) throw new Error(`Missing grammar-decided witness ${command} ${JSON.stringify(tokens)}`);
    return row;
  };
  const head = operand('HEAD');
  const witnesses = [
    witness('diff-files', [['--max-depth', 1]]), witness('diff-files', [['--max-depth', 0]]), witness('diff-files', [['--max-depth', -1]]),
    witness('diff-files', [['--max-depth', 1], ['--max-depth', -1]]), witness('diff-files', [['--max-depth', 1], ['-h']]),
    witness('diff-files', [['--find-object', 'HEAD'], ['--pickaxe-regex']]), witness('diff-files', [['--find-object', 'HEAD']]),
    witness('diff-index', [['--max-depth', 1], head]), witness('diff-index', [['--cached'], ['--max-depth', 0], head]),
    witness('diff-index', [['--find-object', 'HEAD'], ['-i'], head]), witness('diff-index', [['--find-object', 'HEAD'], ['--regexp-ignore-case'], head]),
    witness('diff-index', [['-S', 'x'], ['-i'], head]),
    witness('diff-tree', [['-r'], ['--max-depth', 1], operand('HEAD~1'), head]),
  ];
  const types = `// Generated by node scripts/diff-plumbing-option-corpus.mjs from independent Git outcomes.
import type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';
type Check<T extends true> = T;
type Accepted<C extends 'diff-files' | 'diff-index' | 'diff-tree', A> = A extends readonly GitCommandArgument<C>[] ? ([CheckedCommandArguments<C, A, { integerProfile: 'bounded'; firstPassEmpty: true; booleanSource: 'modern' }>] extends [never] ? false : true) : false;
export type NativeDiffPlumbingOptionCases = readonly [\n` + witnesses.map(row => `  Check<Accepted<${JSON.stringify(row.command)}, ${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
  for (const [path, content] of [['test/fixtures/diff-plumbing-option-corpus.json', fixture], ['test/types/diff-plumbing-option-corpus.ts', types]]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent diff-files/diff-index/diff-tree outcomes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

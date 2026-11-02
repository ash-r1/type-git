// Independent native oracle for git diff and git diff --no-index argument dispatch.
// Outcomes come from Git 2.55.0 itself; no Type-Git schema or validator decides a case.
import { closeSync, openSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { oracleEnv } from './checkout-oracle.mjs';

const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-diff-parser-'));
const env = oracleEnv(directory);
/** Run native Git with empty file-backed stdin; abnormal termination fails unless a caller records it. */
function git(args, allowSignal = false) {
  const input = openSync(join(directory, 'oracle-input'), 'r');
  try {
    const result = spawnSync('git', args, { cwd: directory, env, stdio: [input, 'pipe', 'pipe'], encoding: 'utf8', timeout: 60000 });
    if (result.error || (result.signal && !allowSignal)) throw result.error ?? new Error(`Git terminated: ${result.signal} ${JSON.stringify(args)}`);
    return result;
  } finally { closeSync(input); }
}
const operand = value => ({ operand: value });
/** Spell API tokens independently: long values attach with "=", short and --default values are separate words. */
const serialize = tokens => tokens.flatMap(token => !Array.isArray(token) ? [token.operand] : token.length === 1 ? [token[0]] : token[0].startsWith('--') && token[0] !== '--default' ? [`${token[0]}=${token[1]}`] : [token[0], String(token[1])]);
const isHelpToken = token => Array.isArray(token) && token.length === 1 && ['-h', '--help', '--help-all'].includes(token[0]);

try {
  await writeFile(join(directory, 'oracle-input'), '');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  // Two tracked files with different content: a regular diff of the clean worktree is empty with
  // status 0, while a switch to no-index comparison of the same paths reports a difference (1).
  // a contains "--no-index" so that pickaxe, -G and -I values of that word still report the
  // difference after a switch to no-index mode.
  for (const [path, content] of [['a', '--no-index\n'], ['b', 'two\n'], ['x', 'three\n'], ['-a', 'dash\n'], ['d1/f', 'left\n'], ['d2/f', 'right\n']]) {
    await mkdir(join(directory, path, '..'), { recursive: true });
    await writeFile(join(directory, path), content);
  }
  for (const args of [['add', '--', '.'], ['commit', '-qm', 'seed']]) if (git(args).status !== 0) throw new Error('Cannot seed oracle');
  if (git(['diff', '--quiet']).status !== 0 || git(['diff', '--cached', '--quiet']).status !== 0) throw new Error('Oracle worktree is not clean');

  const cases = [];
  const prefixes = [];
  /** Classify one native outcome for the selected API scope. */
  // Literal-type witnesses cover a selected subset: the contract type check is near its memory
  // budget, and every row is still compared with the runtime builder.
  const o = operand;
  const witnesses = new Set([
    ['diff', [['-h']]], ['diff', [['--merge-base']]], ['diff', [['-h'], ['--merge-base']]], ['diff', [['--merge-base'], ['-h']]],
    ['diff', [['--base'], ['--help']]], ['diff', [['-h'], ['--help']]], ['diff', [['--cached'], ['--merge-base']]], ['diff', [['--cached'], ['--base']]],
    ['diff', [['--cached'], ['-h']]], ['diff', [['--cached'], ['-n', 1]]], ['diff', [['--cached'], ['-n', -1]]], ['diff', [['--cached'], ['-n', 1], ['-h']]],
    ['diff', [['--cached'], ['--max-age', 5]]], ['diff', [['--name-only'], ['--name-status'], ['-h']]], ['diff', [['-S', '--']]], ['diff', [['-S', '--no-index'], o('a'), o('b')]],
    ['diff', [['-n', 3], ['-S', '--no-index']]], ['diff', [['-n', -1], ['-S', '--no-index']]], ['diff', [o('HEAD'), ['-S', '--no-index']]], ['diff', [['--default', '--no-index']]],
    ['diff --no-index', [o('a'), o('b')]], ['diff --no-index', [o('a')]], ['diff --no-index', [o('-'), o('b'), o('x')]], ['diff --no-index', [o('a'), o('-'), o('x')]],
    ['diff --no-index', [['-h'], ['--stat', 'bad']]], ['diff --no-index', [['--stat', 'bad'], ['-h']]],
  ].map(entry => JSON.stringify(entry)));
  const typed = new Set();
  const record = (command, tokens, target = cases) => {
    if (target === cases && witnesses.delete(JSON.stringify([command, tokens]))) typed.add(target.length);
    const argv = command === 'diff --no-index' ? ['diff', '--no-index', ...serialize(tokens)] : ['diff', ...serialize(tokens)];
    // Only long-name prefix probes may reach a native BUG() abort; a crash is never acceptance.
    const result = git(argv, target === prefixes);
    if (result.signal) {
      target.push({ command, tokens, argv, valid: false, status: result.signal, diagnostic: result.stderr.split('\n')[0] });
      return;
    }
    // git diff recognizes only -h in its residual loops; parse_options also has --help and --help-all.
    const help = command === 'diff' ? tokens.some(token => Array.isArray(token) && token.length === 1 && token[0] === '-h') : tokens.some(isHelpToken);
    // parse_options help prints usage on stdout; builtin/diff.c usage() prints it on stderr.
    const usage = result.status === 129 && ((result.stdout.startsWith('usage:') && result.stderr === '') || (result.stdout === '' && result.stderr.startsWith('usage:')));
    const errored = (result.status === 129 && /^(error|warning):/.test(result.stderr)) || (result.status === 128 && /^(fatal|error):/.test(result.stderr));
    let valid;
    if (command === 'diff --no-index') {
      // diff(1)-style statuses: 0 = same, 1 = different; usage is valid only when help was asked for.
      valid = ((result.status === 0 || result.status === 1) && result.stderr === '') || (usage && help);
      if (!valid && !usage && !errored) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    } else {
      // The seeded worktree is clean, so a regular diff is silent with status 0. Status 1 with
      // patch output means the arguments switched to a no-index comparison: a different grammar.
      const switched = result.status === 1 && result.stdout.startsWith('diff --git');
      valid = (result.status === 0 && result.stdout === '' && result.stderr === '') || (usage && help);
      if (!valid && !usage && !errored && !switched) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stdout}${result.stderr}`);
    }
    target.push({ command, tokens, argv, valid, status: result.status, diagnostic: (result.stderr || result.stdout).split('\n')[0] });
  };

  // Residual words left by setup_revisions, without revisions: diff-files or HEAD-by-hand diff-index.
  const residual = [['--base'], ['--ours'], ['--theirs'], ['-q'], ['-h'], ['--help'], ['--merge-base'], ['--cached'], ['--staged']];
  const indexAllowed = new Set(['--cached', '--staged', '--merge-base']);
  /**
   * In the HEAD-by-hand branch any unexpected residual word, including -h, prints the same bare
   * usage. A misuse word before -h is therefore observationally identical to help and is left to
   * the source-ordered model; only sequences whose first unexpected word is unambiguous are kept.
   */
  const observable = sequence => {
    if (!sequence.some(token => token[0] === '--cached' || token[0] === '--staged')) return true;
    const first = sequence.find(token => !indexAllowed.has(token[0]));
    return !first || first[0] === '-h' || !sequence.some(token => token[0] === '-h');
  };
  const sequences = [[]];
  for (const a of residual) {
    sequences.push([a]);
    for (const b of residual) {
      sequences.push([a, b]);
      for (const c of [['-h'], ['--merge-base'], ['--base'], ['--cached']]) sequences.push([a, b, c]);
    }
  }
  for (const sequence of sequences) {
    // A first-word --help is git.c's documentation dispatch, outside this parser.
    if (!observable(sequence) || sequence[0]?.[0] === '--help') continue;
    record('diff', sequence);
    if (sequence.length && sequence.length < 3) record('diff', [...sequence, ['--'], operand('x')]);
  }
  // Revision count and numeric age filters checked after the HEAD-by-hand residual loop.
  for (const mode of [[], [['--cached']], [['--staged'], ['--merge-base']]]) {
    for (const value of [-2, -1, 0, 1, 3, 4]) for (const flag of ['-n', '--max-count']) {
      record('diff', [...mode, [flag, value]]);
      record('diff', [...mode, [flag, value], ['-h']]);
    }
    for (const flag of ['--max-age', '--min-age']) for (const value of [-1, 0, 5]) {
      record('diff', [...mode, [flag, value]]);
      record('diff', [...mode, [flag, value], ['-h']]);
    }
  }
  // setup_revisions validates every option, including diff_setup_done, before -h is reached.
  for (const words of [[['--name-only'], ['--name-status']], [['-S', 'x'], ['-G', 'y']], [['--graph'], ['--reverse']], [['--stat', 'bad']], [['--color', 'bad']], [['--word-diff', 'bad']]]) {
    record('diff', words);
    record('diff', [['-h'], ...words]);
    record('diff', [...words, ['-h']]);
  }
  // Detached option values are raw words for the explicit --no-index scan and the first "--" search.
  // --default names a revision that Git resolves when no other revision is given, so its value
  // is repository-dependent except for the raw-word hazards themselves.
  for (const flag of ['-S', '-G', '-O', '-I', '--default']) {
    for (const value of flag === '--default' ? ['--', '--no-index', 'HEAD'] : ['--', '--no-index', '-h', '--stat', 'HEAD']) {
      record('diff', [[flag, value]]);
      record('diff', [[flag, value], operand('a'), operand('b')]);
    }
    for (const stopper of [[['-n', 3]], [['-n', 0]], [['-n', -1]], [['-O', '']], [['-I', 'x']], [['-I', '-x']], [operand('HEAD')]]) {
      if (stopper[0][0] === flag || flag === '--default') continue;
      record('diff', [...stopper, [flag, '--no-index']]);
    }
    record('diff', [[flag, 'HEAD'], ['--'], operand('--no-index')]);
  }
  record('diff', [['--'], operand('--no-index')]);
  record('diff', [operand('HEAD'), ['--'], operand('--no-index')]);

  // diff --no-index: an ordinary parse_options pass, then two paths and directory-only pathspecs.
  for (const tokens of [
    [], [operand('a')], [operand('a'), operand('b')], [operand('a'), operand('a')], [operand('d1'), operand('d2')], [operand('d1'), operand('d2'), operand('f')],
    [operand('-'), operand('b')], [operand('a'), operand('-')], [operand('-'), operand('d2'), operand('f')], [operand('d1'), operand('-'), operand('f')], [operand('-'), operand('b'), operand('x')], [operand('a'), operand('-'), operand('x')],
    [['--'], operand('-a'), operand('b')], [['-S', '--'], operand('a'), operand('b')], [['-S', '-h'], operand('a'), operand('b')], [['--cached'], operand('a'), operand('b')], [['--merge-base'], operand('a'), operand('b')],
    [['-h']], [['--help']], [['--help-all']], [['-h'], operand('a')], [operand('a'), ['-h']], [['--stat', 'bad'], ['-h']], [['-h'], ['--stat', 'bad']], [['--name-only'], ['--name-status'], operand('a'), operand('b')],
  ]) record('diff --no-index', tokens);

  // Long-name prefixes of the diff option table. Git resolves unique abbreviations; the typed API
  // accepts only canonical spellings, so these rows witness soundness rather than completeness.
  const files = JSON.parse(await readFile(new URL('spec/upstream/git-option-tables.json', root), 'utf8')).files;
  const definitions = files.find(entry => entry.file === 'diff.c').tables.find(table => table.function === 'add_diff_options' && table.name === 'parseopts').options;
  const words = new Set(['--n', '--no', '--no-', '--unknown']);
  for (const option of definitions) if (option.long) {
    for (const name of [option.long, `no-${option.long}`]) for (let size = 1; size <= name.length; size++) words.add(`--${name.slice(0, size)}`);
  }
  // A unique prefix of --output consumes the next path and writes to it; restore the seeded
  // worktree after every probe so that each row starts from the same clean repository.
  const restore = () => {
    if (git(['checkout', '-q', '--', '.']).status !== 0 || git(['clean', '-fdq', '-e', 'oracle-input']).status !== 0) throw new Error('Cannot restore oracle worktree');
  };
  for (const word of [...words].sort()) {
    record('diff', [[word]], prefixes);
    restore();
    record('diff --no-index', [[word], operand('a'), operand('b')], prefixes);
    restore();
  }

  if (witnesses.size) throw new Error(`Unrecorded literal-type witnesses: ${[...witnesses].join(', ')}`);
  const profile = 'Git 2.55.0, LC_ALL=C; clean seeded repository with tracked files, directories and a dash path; empty stdin; setup_revisions residual dispatch (diff-files and HEAD-by-hand diff-index), detached-value raw-word scans, and the ordinary diff --no-index parser; no user repository access';
  const fixture = JSON.stringify({ profile, cases, prefixes }, null, 2) + '\n';
  const types = `// Generated by node scripts/diff-parser-corpus.mjs from independent Git outcomes.
import type { CheckedCommandArguments, CheckedUsageArguments, GitCommandArgument, UsageCommand } from '../../src/commands/types.js';
type Check<T extends true> = T;
type Command = 'diff' | 'diff --no-index';
// Mirror the git.command overloads: ordinary typed arguments, or a native usage-exit tail.
type Ordinary<C extends Command, A> = A extends readonly GitCommandArgument<C>[] ? ([CheckedCommandArguments<C, A, { integerProfile: 'bounded'; firstPassEmpty: true; booleanSource: 'modern' }>] extends [never] ? false : true) : false;
type Usage<C extends Command, A> = C extends UsageCommand ? (A extends readonly unknown[] ? ([CheckedUsageArguments<C, A>] extends [never] ? false : true) : false) : false;
type Accepted<C extends Command, A> = true extends Ordinary<C, A> | Usage<C, A> ? true : false;
export type NativeDiffParserCases = readonly [\n` + cases.filter((_, index) => typed.has(index)).map(row => `  Check<Accepted<${JSON.stringify(row.command)}, ${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
  for (const [path, content] of [['test/fixtures/diff-parser-corpus.json', fixture], ['test/types/diff-parser-corpus.ts', types]]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent diff parser outcomes (${typed.size} literal-type witnesses) and ${prefixes.length} long-name prefix outcomes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

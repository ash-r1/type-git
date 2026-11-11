// Independent native oracle for the git diff option grammar, rule combinations and operand forms.
// Outcomes come from Git 2.55.0 itself; option spellings and value forms are read from the
// upstream extraction (spec/upstream), and sample values are hand-picked from the Git sources.
// No Type-Git schema or validator decides a case.
import { closeSync, openSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { oracleEnv } from './checkout-oracle.mjs';

const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-diff-option-'));
const env = oracleEnv(directory);
/** Run native Git with empty file-backed stdin; only recorded diff runs may end in a signal. */
function git(args, allowSignal = false) {
  const input = openSync(join(directory, 'oracle-input'), 'r');
  try {
    const result = spawnSync('git', args, { cwd: directory, env, stdio: [input, 'pipe', 'pipe'], encoding: 'utf8', timeout: 60000 });
    if (result.error || (result.signal && !allowSignal)) throw result.error ?? new Error(`Git terminated: ${result.signal} ${JSON.stringify(args)}`);
    return result;
  } finally { closeSync(input); }
}
const operand = value => ({ operand: value });
/**
 * Spell API tokens independently. Long values attach with "=" (setup_revisions takes --default
 * only as a separate word); optional short values must be stuck (-U3, -M50%); required short
 * values are separate words.
 */
const optionalShort = new Set(['-U', '-X', '-B', '-M', '-C']);
const serialize = tokens => tokens.flatMap(token => {
  if (!Array.isArray(token)) return [token.operand];
  if (token.length === 1) return [token[0]];
  const [flag, value] = token;
  if (flag === '--default') return [flag, String(value)];
  if (flag.startsWith('--')) return [`${flag}=${value}`];
  return optionalShort.has(flag) ? [`${flag}${value}`] : [flag, String(value)];
});

// Repository states: a clean worktree, then staged and unstaged edits without whitespace errors.
const exitCodeFlags = new Set(['--exit-code', '--quiet']);
async function seedState(state) {
  for (const args of [['reset', '-q', '--hard', 'main'], ['clean', '-fdq', '-e', 'oracle-input', '-e', 'order']]) if (git(args).status !== 0) throw new Error('Cannot restore oracle');
  if (state === 'modified') {
    await writeFile(join(directory, 'x'), 'three\nstaged\n');
    if (git(['add', 'x']).status !== 0) throw new Error('Cannot stage oracle edit');
    await writeFile(join(directory, 'b'), 'two\nunstaged\n');
  }
  if (git(['update-index', '-q', '--refresh']).status > 1) throw new Error('Cannot refresh oracle index');
}

/**
 * Classify one run. A regular diff exits 0; --exit-code/--quiet exit 1 when the modified state
 * has changes. Status 1 from the clean state means the words switched to a no-index
 * comparison, which is a different grammar and therefore not acceptance by git diff.
 */
function classify(argv, state, result) {
  // A native BUG() abort (the --no-ignore-matching-lines negation) is never acceptance.
  if (result.signal) return false;
  const words = argv.slice(1);
  const exitCode = words.some(word => exitCodeFlags.has(word));
  // A requested -h prints usage from the residual loop (exit 129): a help exit, not a refusal.
  const help = result.status === 129 && words.includes('-h') && /^usage:/.test(result.stderr || result.stdout);
  const ok = help || result.status === 0 || (result.status === 1 && exitCode && state === 'modified');
  const failed = (result.status === 129 && /^(error|warning|usage):/.test(result.stderr || result.stdout)) || (result.status === 128 && /^(fatal|error):/m.test(result.stderr));
  const switched = result.status === 1;
  if (!ok && !failed && !switched) throw new Error(`Unclassified ${JSON.stringify(argv)} (${state}): ${result.status}: ${result.stdout.slice(0, 200)}${result.stderr.slice(0, 200)}`);
  return ok;
}

try {
  await writeFile(join(directory, 'oracle-input'), '');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  for (const [path, content] of [['a', 'one\n'], ['b', 'two\n'], ['x', 'three\n'], ['d1/f', 'left\n']]) {
    await mkdir(join(directory, path, '..'), { recursive: true });
    await writeFile(join(directory, path), content);
  }
  for (const args of [['add', '--', '.'], ['commit', '-qm', 'seed'], ['tag', 'base']]) if (git(args).status !== 0) throw new Error('Cannot seed oracle');
  await writeFile(join(directory, 'a'), 'one\nmore\n');
  for (const args of [['commit', '-qam', 'second'], ['branch', 'side', 'base']]) if (git(args).status !== 0) throw new Error('Cannot seed oracle');

  const groups = { options: [], combinations: [], operands: [] };
  /** Record one token sequence in both states; it is valid only when Git accepts it in both. */
  const record = async (group, tokens, extra = {}) => {
    const argv = ['diff', ...serialize(tokens)];
    const outcomes = [];
    for (const state of ['clean', 'modified']) {
      await seedState(state);
      const result = git(argv, true);
      outcomes.push({ state, valid: classify(argv, state, result), status: result.signal ?? result.status, diagnostic: result.status === 0 ? '' : (result.stderr || result.stdout).split('\n')[0] });
    }
    const valid = outcomes.every(outcome => outcome.valid);
    const failure = outcomes.find(outcome => !outcome.valid);
    groups[group].push({ command: 'diff', group, tokens, argv, valid, ...(failure ? { status: failure.status, state: failure.state, diagnostic: failure.diagnostic } : {}), ...extra });
  };

  // Option spellings and value forms from the upstream extraction of diff.c and revision.c.
  const tables = JSON.parse(await readFile(new URL('spec/upstream/git-option-tables.json', root), 'utf8')).files;
  const diffTable = tables.find(entry => entry.file === 'diff.c').tables.find(table => table.function === 'add_diff_options' && table.name === 'parseopts').options;
  const revision = JSON.parse(await readFile(new URL('spec/upstream/git-revision-options.json', root), 'utf8')).options;
  /** Option name -> 'flag' | 'required' | 'optional' (parse-options NOARG/OPTARG flags). */
  const forms = new Map();
  for (const option of diffTable) {
    const flags = option.fields.flags ?? '';
    const form = /NOARG/.test(flags) || /^OPTION_(SET_INT|BIT|BITOP|COUNTUP|NEGBIT)$/.test(option.kind) ? 'flag' : /OPTARG/.test(flags) ? 'optional' : 'required';
    for (const name of [option.long && `--${option.long}`, option.short && `-${option.short}`]) if (name) forms.set(name, form);
    // A negation is a value-less spelling whenever parse-options would accept it.
    if (option.long && !/NONEG/.test(flags)) {
      forms.set(`--no-${option.long}`, 'flag');
      if (option.long.startsWith('no-')) forms.set(`--${option.long.slice(3)}`, 'flag');
    }
  }
  for (const [name, entry] of Object.entries(revision)) {
    forms.set(name, entry.forms.includes('value') ? (entry.forms.includes('flag') ? 'optional' : 'required') : 'flag');
  }
  forms.set('--color', 'optional');
  forms.set('--no-color', 'flag');
  // Covered by the residual-dispatch corpus (diff-parser-corpus) or a separate scope.
  for (const name of ['--no-index', '--cached', '--staged', '--merge-base', '--base', '--ours', '--theirs', '-q', '-h', '--help', '--help-all', '--end-of-options']) forms.delete(name);

  // Sample values from the Git 2.55.0 callbacks; invalid samples probe each value grammar.
  const date = ['2000-01-01', 'yesterday', 'bad', ''];
  const regex = ['x', '[', ''];
  const count = [0, 1, -1];
  const samples = {
    '--unified': count, '-U': [0, 5, -1], '-l': count, '--inter-hunk-context': count,
    '--stat-width': count, '--stat-name-width': count, '--stat-graph-width': count, '--stat-count': count, '--max-depth': count,
    '--dirstat': ['files', 'lines', 'changes', 'cumulative', '10', 'files,10,cumulative', 'bad', ''], '-X': ['files', 'bad', ''],
    '--dirstat-by-file': ['10', 'cumulative', 'bad', ''],
    '--stat': ['80', '80,40', '80,40,5', '-1', 'bad', ''],
    '--color': ['always', 'never', 'auto', 'true', 'false', 'bad', ''],
    '--ws-error-highlight': ['none', 'default', 'all', 'old,new', 'context', 'bad', ''],
    '--abbrev': ['7', '4', '0', '40', '-1', 'bad', ''],
    '--src-prefix': ['a/', ''], '--dst-prefix': ['b/', ''], '--line-prefix': ['>', ''],
    '--output-indicator-new': ['+', 'ab', ''], '--output-indicator-old': ['-', 'ab', ''], '--output-indicator-context': [' ', 'ab', ''],
    '--break-rewrites': ['50%', '50%/60%', '50', 'bad', ''], '-B': ['50%', '50%/60%', 'bad'],
    '--find-renames': ['50%', '50', '0', 'bad', ''], '-M': ['50%', 'bad'],
    '--find-copies': ['50%', '50', 'bad', ''], '-C': ['50%', 'bad'],
    '--ignore-matching-lines': regex, '-I': regex, '--word-diff-regex': ['.', '[', ''], '--color-words': ['.', '[', ''],
    '--diff-algorithm': ['myers', 'minimal', 'patience', 'histogram', 'default', 'bad', ''],
    '--anchored': ['x', ''],
    '--word-diff': ['plain', 'color', 'porcelain', 'none', 'bad', ''],
    '--color-moved': ['no', 'default', 'plain', 'blocks', 'zebra', 'dimmed-zebra', 'dimmed_zebra', 'bad', ''],
    '--color-moved-ws': ['no', 'ignore-space-at-eol', 'ignore-space-change', 'ignore-all-space', 'allow-indentation-change', 'allow-indentation-change,ignore-all-space', 'bad', ''],
    '--relative': ['d1', ''],
    '--ignore-submodules': ['none', 'untracked', 'dirty', 'all', 'bad', ''],
    '--submodule': ['short', 'log', 'diff', 'bad', ''],
    '-S': ['x', ''], '-G': regex, '-O': ['order', ''],
    '--rotate-to': ['b', 'zz', ''], '--skip-to': ['b', 'zz', ''],
    '--find-object': ['HEAD', 'bad', ''],
    '--diff-filter': ['A', 'ACDMRTUXB', 'a', 'd*', '*', 'M*', 'Z', 'AZ', ''],
    '--output': ['out', ''],
    '--after': date, '--since': date, '--before': date, '--until': date, '--since-as-filter': date,
    '--max-age': count, '--min-age': count, '--max-count': count, '--max-count-oldest': count, '-n': count,
    '--max-parents': count, '--min-parents': count, '--skip': count, '--graph-lane-limit': count,
    '--expand-tabs': [0, 8, -1],
    '--ancestry-path': ['base', 'bad'],
    '--author': regex, '--committer': regex, '--grep': regex, '--grep-reflog': ['x'],
    '--branches': ['s*', ''], '--tags': ['b*', ''], '--remotes': ['o*', ''], '--glob': ['refs/heads/*', ''], '--exclude': ['refs/tags/*', ''],
    '--exclude-hidden': ['fetch', 'receive', 'uploadpack', 'bad', ''],
    '--date': ['relative', 'local', 'iso', 'iso8601', 'iso-strict', 'iso-local', 'rfc', 'short', 'raw', 'human', 'unix', 'default', 'format:%Y', 'format-local:%Y', 'bad', ''],
    '--diff-merges': ['off', 'none', 'on', '1', 'first-parent', 'separate', 'm', 'c', 'combined', 'cc', 'dense-combined', 'r', 'remerge', 'bad', ''],
    '--encoding': ['UTF-8', 'none', 'bad', ''],
    '--format': ['oneline', 'format:%H', 'tformat:%H', '%H', 'bad', ''], '--pretty': ['oneline', 'short', 'medium', 'full', 'fuller', 'reference', 'email', 'raw', 'format:%H', 'tformat:%H', '%H', 'bad', ''],
    '--no-kept-objects': ['in-core', 'on-disk', 'bad'], '--no-walk': ['sorted', 'unsorted', 'bad', ''],
    '--notes': ['x', ''], '--show-notes': ['x', ''], '--show-linear-break': ['x', ''],
    '--filter': ['blob:none', 'blob:limit=1k', 'tree:0', 'combine:blob:none+tree:0', 'bad', ''],
    '--default': ['HEAD'], '--unpacked': ['x'], '--encode-email-headers': [],
  };
  // Rows whose outcome Git decides from state the argument grammar cannot see. These rows are
  // checked for soundness only: the builder must not refuse what Git accepted.
  // - repository: refs, objects, stdin, merge state or whether an operand names a revision;
  // - regex: POSIX regcomp acceptance of a pattern ('[' fails to compile);
  // - configuration: pretty.<name> format aliases and the configured -m/on diff-merges mode;
  // - content: --rotate-to/--skip-to paths that must occur in the produced diff;
  // - filesystem: the -O order file and the --output path ('' cannot be opened);
  // - undefined: an empty output-indicator argument makes diff_opt_char read past its terminator.
  const repositoryDependent = new Set(['--all', '--branches', '--tags', '--remotes', '--glob', '--exclude', '--bisect', '--reflog', '--indexed-objects', '--alternate-refs', '--stdin', '--default', '--merge', '--not', '--find-object', '--ancestry-path', '--exclude-hidden', '--single-worktree', '--exclude-promisor-objects', '--notes', '--show-notes', '--no-kept-objects', '--unpacked', '-g', '--walk-reflogs']);
  const regexOptions = new Set(['--author', '--committer', '--grep', '-G', '-I', '--ignore-matching-lines', '--word-diff-regex', '--color-words']);
  /** Classify one token as native-owned, or undefined when the grammar decides it. */
  const delegation = token => {
    if (!Array.isArray(token)) return undefined;
    const [name, value] = token;
    if (repositoryDependent.has(name)) return 'repository';
    if (regexOptions.has(name) && value === '[') return 'regex';
    if ((name === '--format' || name === '--pretty') && value === 'bad') return 'configuration';
    if ((name === '--rotate-to' || name === '--skip-to') && value !== 'b') return 'content';
    if (name === '-O' || name === '--output') return 'filesystem';
    if (/^--output-indicator-/.test(name) && value === '') return 'undefined';
    return undefined;
  };
  /** The first native-owned reason in a token sequence. */
  const delegatedBy = tokens => {
    for (const token of tokens) {
      const reason = delegation(token);
      if (reason) return reason;
    }
    // Without the configured diff.merges/log.diffMerges default, -m and on are separate diffs.
    const merges = tokens.some(token => Array.isArray(token) && (token[0] === '-m' || (token[0] === '--diff-merges' && ['on', 'm'].includes(token[1]))));
    if (merges && tokens.some(token => Array.isArray(token) && token[0] === '--combined-all-paths')) return 'configuration';
    // Words before "--" may name revisions or paths; only the repository decides which.
    const separator = tokens.findIndex(token => Array.isArray(token) && token[0] === '--');
    if (tokens.slice(0, separator < 0 ? tokens.length : separator).some(token => !Array.isArray(token))) return 'repository';
    return undefined;
  };
  const extra = tokens => {
    const reason = delegatedBy(tokens);
    return reason ? { delegated: reason } : {};
  };

  for (const [name, form] of [...forms].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (form !== 'required') await record('options', [[name]], extra([[name]]));
    if (form !== 'flag') {
      const values = samples[name];
      if (!values) throw new Error(`${name}: no sample values`);
      for (const value of values) await record('options', [[name, value]], extra([[name, value]]));
    }
  }

  // Rule combinations: pairs over the mode, pickaxe, walk-shape and follow families, in both orders.
  const family = [
    ['--name-only'], ['--name-status'], ['--check'], ['-s'], ['--raw'], ['--stat'], ['--numstat'], ['--patch'], ['--summary'], ['--compact-summary'], ['--quiet'], ['--exit-code'],
    ['-S', 'x'], ['-G', 'x'], ['--find-object', 'HEAD'], ['--pickaxe-regex'], ['--pickaxe-all'],
    ['--graph'], ['--reverse'], ['-g'], ['--boundary'], ['--maximal-only'], ['--children'], ['--parents'], ['--show-linear-break'], ['--no-walk'], ['--do-walk'],
    ['--grep-reflog', 'x'], ['--graph-lane-limit', 1], ['--combined-all-paths'], ['-c'], ['--cc'], ['-m'], ['--remerge-diff'], ['--filter', 'blob:none'], ['--objects'],
    ['--follow'], ['--full-diff'], ['--left-right'], ['--cherry-pick'], ['--left-only'], ['--first-parent'], ['--simplify-by-decoration'], ['--since-as-filter', '2000-01-01'],
    ['--max-count', 1], ['--max-count-oldest', 1], ['--skip', 1], ['-n', 1], ['--max-depth', 1],
  ];
  for (let i = 0; i < family.length; i++) for (let j = 0; j < family.length; j++) if (i !== j) {
    const pair = [family[i], family[j]];
    await record('combinations', pair, extra(pair));
  }
  // --follow needs exactly one pathspec, with or without the explicit separator.
  for (const tokens of [
    [['--follow'], operand('a')], [['--follow'], ['--'], operand('a')], [['--follow'], ['--'], operand('a'), operand('b')], [['--follow'], operand('a'), operand('b')],
    [['--follow'], ['--full-diff'], operand('a')], [['--follow'], ['--stdin']], [['--follow'], ['--stdin'], ['--'], operand('a')],
    // A later count re-enables walking; the last --max-depth wins.
    [['--no-walk'], ['-n', 1], ['--graph']], [['-n', 1], ['--no-walk'], ['--graph']], [['--max-depth', 1], ['--max-depth', -1]], [['--max-depth', -1], ['--max-depth', 0]],
    [['--max-depth', 1], ['-h']], [['--max-depth', 1], ['--'], operand('a')], [['--max-depth', 1], ['--cached']],
  ]) await record('combinations', tokens, extra(tokens));

  // Operand forms. Whether a word names a commit, blob or path is decided by the repository,
  // so every row before a separator is delegated; the rows witness that the builder keeps each form.
  for (const words of [
    ['HEAD'], ['base', 'HEAD'], ['base..HEAD'], ['base...HEAD'], ['side...HEAD'], ['^base', 'HEAD'], ['HEAD^!'], ['HEAD^@'], ['base', 'side', 'HEAD'],
    ['HEAD:a'], ['HEAD:a', 'base:a'], ['HEAD:a', 'base:a', 'HEAD:b'], ['HEAD', 'HEAD:a'], ['HEAD:a', 'a'], ['missing'], ['a'], ['a', 'b'], ['d1'],
  ]) {
    const ops = words.map(operand);
    for (const tokens of [ops, [...ops, ['--'], operand('a')], [['--merge-base'], ...ops], [['--cached'], ...ops], [['--max-depth', 1], ...ops]]) {
      await record('operands', tokens, { delegated: 'repository' });
    }
  }
  for (const tokens of [[['--'], operand('a')], [['--'], operand('a'), operand('missing')], [['--'], operand('-a')], [['--'], operand('--')], [['--'], operand('HEAD')], [operand('HEAD:a'), ['--'], operand('a')]]) {
    await record('operands', tokens, extra(tokens));
  }

  const profile = 'Git 2.55.0, LC_ALL=C; two-commit repository with tag base and branch side, run clean and with staged and unstaged edits (valid only when both succeed); empty stdin; option spellings from spec/upstream diff.c add_diff_options and revision.c extraction';
  const fixture = JSON.stringify({ profile, cases: [...groups.options, ...groups.combinations, ...groups.operands] }, null, 1) + '\n';
  // Literal-type witnesses: one accepted and one refused row per new rule family, kept small for
  // the contract type-check heap; every row is still compared with the runtime builder.
  const witnesses = [
    [['--max-depth', 1]], [['--max-depth', -1]], [['--max-depth', 1], ['--max-depth', -1]], [['--max-depth', 1], ['-h']],
    [['--no-walk'], ['--graph']], [['--no-walk'], ['-n', 1], ['--graph']], [['--graph'], ['--reverse']],
    [['--name-only'], ['--name-status']], [['--stat', '80,40']], [['--color', 'bad']], [['--no-no-patch']],
  ].map(tokens => {
    const row = [...groups.options, ...groups.combinations].find(entry => JSON.stringify(entry.tokens) === JSON.stringify(tokens));
    if (!row || row.delegated) throw new Error(`Missing grammar-decided witness ${JSON.stringify(tokens)}`);
    return row;
  });
  const types = `// Generated by node scripts/diff-option-corpus.mjs from independent Git outcomes.
import type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';
type Check<T extends true> = T;
type Accepted<A> = A extends readonly GitCommandArgument<'diff'>[] ? ([CheckedCommandArguments<'diff', A, { integerProfile: 'bounded'; firstPassEmpty: true; booleanSource: 'modern' }>] extends [never] ? false : true) : false;
export type NativeDiffOptionCases = readonly [\n` + witnesses.map(row => `  Check<Accepted<${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
  for (const [path, content] of [['test/fixtures/diff-option-corpus.json', fixture], ['test/types/diff-option-corpus.ts', types]]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  const total = Object.values(groups).reduce((sum, rows) => sum + rows.length, 0);
  console.log(`Generated/checked ${total} independent diff outcomes (${groups.options.length} option, ${groups.combinations.length} combination, ${groups.operands.length} operand).`);
} finally { await rm(directory, { recursive: true, force: true }); }

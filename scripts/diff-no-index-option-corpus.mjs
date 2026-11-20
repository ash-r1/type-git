// Independent native oracle for the git diff --no-index option grammar, rule combinations and
// operand forms. Outcomes come from Git 2.55.0 itself, run outside any repository; option
// spellings and value forms are read from the upstream extraction (spec/upstream), and sample
// values are hand-picked from the Git sources. No Type-Git schema or validator decides a case.
import { closeSync, openSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { oracleEnv } from './checkout-oracle.mjs';

const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-diff-no-index-'));
const work = join(directory, 'work');
// Never discover a repository above the comparison directory.
const env = { ...oracleEnv(directory), GIT_CEILING_DIRECTORIES: directory };
/** Run native Git outside any repository with empty file-backed stdin; signals are recorded. */
function git(args) {
  const input = openSync(join(directory, 'oracle-input'), 'r');
  try {
    const result = spawnSync('git', args, { cwd: work, env, stdio: [input, 'pipe', 'pipe'], encoding: 'utf8', timeout: 60000 });
    if (result.error) throw result.error;
    return result;
  } finally { closeSync(input); }
}
/** Represent a literal argv word independently of the option resolver. */
const operand = value => ({ operand: value });
/**
 * Spell API tokens independently. Long values attach with "="; optional short values must be
 * stuck (-U3, -M50%); required short values are separate words.
 */
const optionalShort = new Set(['-U', '-X', '-B', '-M', '-C']);
const serialize = tokens => tokens.flatMap(token => {
  if (!Array.isArray(token)) return [token.operand];
  if (token.length === 1) return [token[0]];
  const [flag, value] = token;
  if (flag.startsWith('--')) return [`${flag}=${value}`];
  return optionalShort.has(flag) ? [`${flag}${value}`] : [flag, String(value)];
});

/**
 * Seed the comparison paths. In the "same" state left and right have equal content; in the
 * "different" state right gains a line containing "x" so that -S x and -G x match.
 */
async function seedState(state) {
  await rm(work, { recursive: true, force: true });
  for (const [path, content] of [
    ['left', 'one\ntwo\n'], ['right', state === 'same' ? 'one\ntwo\n' : 'one\ntwo x\n'], ['order', 'right\nleft\n'],
    // Option-like paths compared after "--": "--stat" against right and left against "-h".
    ['--stat', 'one\ntwo\n'], ['-h', state === 'same' ? 'one\ntwo\n' : 'one\n'], ['d1/f', 'one\n'], ['d2/f', state === 'same' ? 'one\n' : 'one x\n'], ['d1/g', 'g\n'], ['d2/g', 'g\n'],
  ]) {
    await mkdir(join(work, path, '..'), { recursive: true });
    await writeFile(join(work, path), content);
  }
}

/**
 * Classify one run. No-index comparison reports diff(1)-style statuses: 0 when the paths are the
 * same and 1 when they differ. Any diagnostic (error, fatal, warning or usage) is a refusal; a
 * signal (native BUG() abort) is never acceptance.
 */
function classify(argv, state, result) {
  // Only Git's own BUG() abort is a recorded refusal; any other signal leaves the run incomplete.
  if (result.signal) {
    if (result.signal === 'SIGABRT' && /^BUG: /m.test(result.stderr)) return false;
    throw new Error(`Git terminated: ${result.signal} ${JSON.stringify(argv)} (${state})`);
  }
  const ok = (result.status === 0 || result.status === 1) && result.stderr === '';
  const failed = (result.status === 129 && /^(error|warning|usage):/.test(result.stderr || result.stdout)) || (result.status === 128 && /^(fatal|error):/m.test(result.stderr)) || (result.status === 1 && /^(error|fatal|warning):/m.test(result.stderr));
  if (!ok && !failed) throw new Error(`Unclassified ${JSON.stringify(argv)} (${state}): ${result.status}: ${result.stdout.slice(0, 200)}${result.stderr.slice(0, 200)}`);
  return ok;
}

try {
  await writeFile(join(directory, 'oracle-input'), '');
  await mkdir(work);
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['rev-parse', '--git-dir']).status === 0) throw new Error('The no-index oracle must run outside a repository');

  const groups = { options: [], combinations: [], operands: [] };
  const files = [operand('left'), operand('right')];
  /** Record one token sequence in both states; it is valid only when Git accepts it in both. */
  const record = async (group, tokens, extra = {}) => {
    const argv = ['diff', '--no-index', ...serialize(tokens)];
    const outcomes = [];
    for (const state of ['same', 'different']) {
      await seedState(state);
      const result = git(argv);
      outcomes.push({ state, valid: classify(argv, state, result), status: result.signal ?? result.status, diagnostic: (result.stderr || '').split('\n')[0] });
    }
    const valid = outcomes.every(outcome => outcome.valid);
    const failure = outcomes.find(outcome => !outcome.valid);
    // A row accepted in only one state still binds the soundness check of a delegated row.
    const acceptedIn = outcomes.filter(outcome => outcome.valid).map(outcome => outcome.state);
    groups[group].push({ command: 'diff --no-index', group, tokens, argv, valid, ...(failure ? { status: failure.status, state: failure.state, diagnostic: failure.diagnostic } : {}), ...(failure && acceptedIn.length ? { acceptedIn } : {}), ...extra });
  };

  // Option spellings and value forms from the upstream extraction of diff.c add_diff_options.
  const tables = JSON.parse(await readFile(new URL('spec/upstream/git-option-tables.json', root), 'utf8')).files;
  const diffTable = tables.find(entry => entry.file === 'diff.c').tables.find(table => table.function === 'add_diff_options' && table.name === 'parseopts').options;
  /** Option name -> 'flag' | 'required' | 'optional' (parse-options NOARG/OPTARG flags). */
  const forms = new Map();
  for (const option of diffTable) {
    const flags = option.fields.flags ?? '';
    const form = /NOARG/.test(flags) || /^OPTION_(SET_INT|BIT|BITOP|COUNTUP|NEGBIT)$/.test(option.kind) ? 'flag' : /OPTARG/.test(flags) ? 'optional' : 'required';
    for (const name of [option.long && `--${option.long}`, option.short && `-${option.short}`]) if (name) forms.set(name, form);
    if (option.long && !/NONEG/.test(flags)) {
      forms.set(`--no-${option.long}`, 'flag');
      if (option.long.startsWith('no-')) forms.set(`--${option.long.slice(3)}`, 'flag');
    }
  }
  forms.set('--color', 'optional');
  forms.set('--no-color', 'flag');
  // Help exits and the mode word itself are covered by the parser corpus (diff-parser-corpus).
  for (const name of ['--no-index', '-h', '--help', '--help-all']) forms.delete(name);

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
    // An empty output indicator makes diff_opt_char read past its terminator (undefined
    // behavior), so its observed outcome is not recorded.
    '--output-indicator-new': ['+', 'ab'], '--output-indicator-old': ['-', 'ab'], '--output-indicator-context': [' ', 'ab'],
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
    '-S': ['x', ''], '-G': regex, '-O': ['order', 'missing', ''],
    '--rotate-to': ['right', 'zz', ''], '--skip-to': ['right', 'zz', ''],
    '--find-object': ['HEAD', 'bad', ''],
    '--diff-filter': ['A', 'ACDMRTUXB', 'a', 'd*', '*', 'M*', 'Z', 'AZ', ''],
    '--output': ['out', ''],
  };
  // Rows whose outcome Git decides from state the argument grammar cannot see. These rows are
  // checked for soundness only: the builder must not refuse what Git accepted.
  // - repository: --find-object names an object, which needs a repository;
  // - regex: POSIX regcomp acceptance of a pattern ('[' fails to compile);
  // - content: --rotate-to/--skip-to paths that must occur in the produced diff;
  // - filesystem: the -O order file, the --output path and whether a path is a directory.
  const regexOptions = new Set(['-G', '-I', '--ignore-matching-lines', '--word-diff-regex', '--color-words']);
  /** Classify one token as native-owned, or undefined when the grammar decides it. */
  const delegation = token => {
    // Whether a path is a directory (and so may take pathspecs) is decided by the filesystem.
    if (!Array.isArray(token)) return ['d1', 'd2', 'missing'].includes(token.operand) ? 'filesystem' : undefined;
    const [name, value] = token;
    if (name === '--find-object') return 'repository';
    if (regexOptions.has(name) && value === '[') return 'regex';
    if (name === '--rotate-to' || name === '--skip-to') return 'content';
    if (name === '-O' || name === '--output') return 'filesystem';
    return undefined;
  };
  /** Row metadata naming the first native-owned reason, if any. */
  const extra = tokens => {
    const reason = tokens.map(delegation).find(Boolean);
    return reason ? { delegated: reason } : {};
  };

  for (const [name, form] of [...forms].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (form !== 'required') await record('options', [[name], ...files], extra([[name]]));
    if (form !== 'flag') {
      const values = samples[name];
      if (!values) throw new Error(`${name}: no sample values`);
      for (const value of values) await record('options', [[name, value], ...files], extra([[name, value]]));
    }
  }

  // Rule combinations: ordered pairs over the output-format, exit-status, pickaxe, follow,
  // depth and path-rewriting families.
  const family = [
    ['--name-only'], ['--name-status'], ['--check'], ['-s'], ['--raw'], ['--stat'], ['--numstat'], ['--patch'], ['--summary'], ['--compact-summary'],
    ['--quiet'], ['--exit-code'], ['--no-exit-code'],
    ['-S', 'x'], ['-G', 'x'], ['--find-object', 'HEAD'], ['--pickaxe-regex'], ['--pickaxe-all'],
    ['--follow'], ['--max-depth', 1], ['--relative'], ['-R'], ['--find-renames'], ['--find-copies-harder'],
  ];
  for (let i = 0; i < family.length; i++) for (let j = 0; j < family.length; j++) if (i !== j) {
    const pair = [family[i], family[j]];
    await record('combinations', [...pair, ...files], extra(pair));
  }
  // The last of a negatable pair wins; options may follow the paths.
  for (const tokens of [
    [['--follow'], ['--no-follow'], ...files], [['--no-follow'], ['--follow'], ...files], [['--quiet'], ['--no-quiet'], ['--name-only'], ['--check'], ...files],
    [['--max-depth', 1], ['--max-depth', -1], ...files], [['--max-depth', 0], operand('d1'), operand('d2')], [['--max-depth', 1], operand('d1'), operand('d2'), operand('f')],
    [operand('left'), ['--stat'], operand('right')], [...files, ['--name-only']], [...files, ['--name-only'], ['--name-status']],
  ]) await record('combinations', tokens, extra(tokens));

  // Operand forms. Two paths are required and a pathspec may follow only two directories, which
  // the filesystem decides; rows with more than two paths, a directory or a missing path are
  // therefore delegated, and "-" (standard input) rows are compared exactly.
  const fsOperand = word => ['d1', 'd2', 'missing'].includes(word);
  for (const words of [
    [], ['left'], ['left', 'right'], ['left', 'left'], ['-', 'right'], ['left', '-'], ['-', '-'],
    ['d1', 'd2'], ['d1', 'd2', 'f'], ['d1', 'd2', 'f', 'g'], ['d1', 'd2', ':(exclude)f'], ['d1', 'right'], ['left', 'd2'], ['left', 'missing'], ['left', 'right', 'f'],
    ['-', 'd2'], ['d1', '-'], ['-', 'right', 'f'], ['d1', 'd2', '-'],
  ]) {
    const ops = words.map(operand);
    const delegated = words.length > 2 && !words.slice(0, 2).includes('-') || words.some(fsOperand);
    for (const tokens of [ops, [['--'], ...ops]]) await record('operands', tokens, delegated ? { delegated: 'filesystem' } : {});
  }
  // "--" ends options: a later word is a path even when it looks like an option (both exist).
  for (const tokens of [[operand('left'), ['--'], operand('right')], [['--'], operand('--stat'), operand('right')], [['--'], operand('left'), operand('-h')]]) {
    await record('operands', tokens);
  }

  const profile = 'Git 2.55.0, LC_ALL=C; run outside any repository (GIT_CEILING_DIRECTORIES) on two files and two directories, with equal and with different content (valid only when both succeed); empty stdin; option spellings from spec/upstream diff.c add_diff_options';
  const fixture = JSON.stringify({ profile, cases: [...groups.options, ...groups.combinations, ...groups.operands] }, null, 1) + '\n';
  // Literal-type witnesses: a few accepted and refused grammar-decided rows per rule family, kept
  // small for the contract type-check heap; every row is still compared with the runtime builder.
  const witnesses = [
    [['--name-only'], ['--name-status'], ...files], [['--quiet'], ['--check'], ...files], [['--quiet'], ['--stat'], ...files],
    [['-S', 'x'], ['-G', 'x'], ...files], [['-G', 'x'], ['--pickaxe-regex'], ...files], [['-S', 'x'], ['--pickaxe-regex'], ...files],
    [['--follow'], ...files], [['--follow'], ['--no-follow'], ...files], [['--stat', 'bad'], ...files], [['--max-depth', 1], ...files],
    [operand('left')], [operand('-'), operand('-')], [['--'], operand('--stat'), operand('right')],
  ].map(tokens => {
    const row = Object.values(groups).flat().find(entry => JSON.stringify(entry.tokens) === JSON.stringify(tokens));
    if (!row || row.delegated) throw new Error(`Missing grammar-decided witness ${JSON.stringify(tokens)}`);
    return row;
  });
  const types = `// Generated by node scripts/diff-no-index-option-corpus.mjs from independent Git outcomes.
import type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';
type Check<T extends true> = T;
type Accepted<A> = A extends readonly GitCommandArgument<'diff --no-index'>[] ? ([CheckedCommandArguments<'diff --no-index', A, { integerProfile: 'bounded'; firstPassEmpty: true; booleanSource: 'modern' }>] extends [never] ? false : true) : false;
export type NativeDiffNoIndexOptionCases = readonly [\n` + witnesses.map(row => `  Check<Accepted<${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
  for (const [path, content] of [['test/fixtures/diff-no-index-option-corpus.json', fixture], ['test/types/diff-no-index-option-corpus.ts', types]]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  const total = Object.values(groups).reduce((sum, rows) => sum + rows.length, 0);
  console.log(`Generated/checked ${total} independent diff --no-index outcomes (${groups.options.length} option, ${groups.combinations.length} combination, ${groups.operands.length} operand).`);
} finally { await rm(directory, { recursive: true, force: true }); }

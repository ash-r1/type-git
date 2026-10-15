// Native oracle independent of the retained-argv partition and parser interpreters.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const observe = process.argv.includes('--observe');
const observedOutput = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length);
if (observe && !observedOutput) throw new Error('--observe requires an explicit --output path');
let recording = false;
const directory = await mkdtemp(join(tmpdir(), 'type-git-stash-show-'));
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('GIT_'))), HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', LC_ALL: 'C', GIT_PAGER: 'cat', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test' };
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete env[name];
/** Run the selected native binary; only observation records may retain abnormal termination. */
function git(args) {
  const result = spawnSync('git', args, { cwd: directory, env, input: '', encoding: 'utf8', timeout: 60000 });
  if ((result.error || result.signal) && !(observe && recording)) throw result.error ?? new Error(`Git terminated: ${result.signal}; argv=${JSON.stringify(args)}; stderr=${result.stderr}`);
  return result;
}
/** Keep candidate literal words independent of the production argument interpreters. */
const operand = value => ({ operand: value });
// API spelling rules, separate from the model under test.
const attached = new Set(['-U', '-X', '-B', '-M', '-C', '-l', '-I', '-S', '-G', '-O', '-n']);
// Required short values preserve a separate empty argv word.
const requiredAttached = new Set(['-l', '-I', '-S', '-G', '-O', '-n']);
/** Apply documented spelling without reading the production argument parser. */
const serialize = tokens => tokens.flatMap(token => !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : requiredAttached.has(token[0]) && token[1] === '' ? token : attached.has(token[0]) ? [`${token[0]}${token[1]}`] : token[0].startsWith('--') && token[0] !== '--default' ? [`${token[0]}=${token[1]}`] : token);
try {
  const required = observe ? '2.55.0' : '2.56.0';
  if (git(['--version']).stdout.trim() !== `git version ${required}`) throw new Error(`This oracle mode requires Git ${required}`);
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  await writeFile(join(directory, 'file'), 'one\n');
  if (git(['add', 'file']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) throw new Error('Cannot seed oracle');
  await writeFile(join(directory, 'file'), 'two\n');
  if (git(['stash', 'push', '-qm', 'fixture']).status !== 0) throw new Error('Cannot create stash');
  for (const name of ['foo', 'one', 'two', '-h', '-unknown', '-L', '--default', '-G', '--color=bad', '--include-untracked', '--include-untracked=1']) {
    if (git(['update-ref', `refs/tags/${name}`, 'refs/stash']).status !== 0) throw new Error('Cannot establish literal ref');
  }
  const cases = [];
  /** Preserve abnormal native results as observations rather than inventing argument validity. */
  const record = (command, tokens) => {
    const argv = [...command.split(' '), ...serialize(tokens)];
    const result = git(argv);
    if (result.error || result.signal) {
      cases.push({ command, tokens, argv, valid: null, status: result.status, signal: result.signal, errorCode: result.error?.code ?? null, diagnostic: result.stderr.split('\n')[0] });
      return;
    }
    const valid = result.status === 0 || (result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr);
    if (![0, 1, 128, 129].includes(result.status)) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    cases.push({ command, tokens, argv, valid, status: result.status, diagnostic: result.stderr.split('\n')[0] });
  };
  const sequences = [[], [operand('foo')], [operand('foo'), operand('one')]];
  const early = [['--color', 'bad'], ['--unified', 'bad'], ['-G', ''], ['--default', 'foo'], ['-n', 'bad'], ['--include-untracked']];
  for (const token of early) for (const help of [['-h'], ['--help'], operand('--help-all')]) {
    sequences.push([token, help], [help, token], [operand('foo'), token, help]);
  }
  const words = new Set(['--unknown', '--no-only-untracked', '-uh', '-uxh', '-xuh', '-include-untracked', '-only-untracked', '-no-color']);
  const tables = JSON.parse(await readFile(new URL('spec/upstream/git-option-tables.json', root), 'utf8')).files.find(file => file.file === 'builtin/stash.c').tables;
  for (const option of tables.find(table => table.function === 'show_stash').options) if (option.long) {
    for (const name of [option.long, `no-${option.long}`]) for (let size = 1; size <= name.length; size++) words.add(`--${name.slice(0, size)}`);
  }
  for (const word of [...words].sort()) for (const suffix of ['', '=1']) {
    sequences.push([operand(word + suffix), ['-h']], [operand(word + suffix)], [['--'], operand(word + suffix)]);
  }
  const tails = [[], [operand('foo')], [['-h']], [operand('-unknown')],
    [operand('foo'), operand('one')], [['-h'], operand('-unknown')],
    [['--default', 'foo']], [['--default', '-L']], [operand('-G'), operand('foo')],
    [operand('-G'), operand('-L')], [['--color', 'bad']], [['--include-untracked']],
    [operand('--include-untracked=1')]];
  for (const prefix of [[], [['--']], [operand('--end-of-options')], [['--'], [ '--' ]]]) {
    for (const tail of tails) sequences.push([...prefix, ...tail]);
  }
  for (const value of ['', 'true', 'TRUE', 'false', '0', '-1', '2147483648', 'always', 'auto', 'never', 'bad']) {
    sequences.push([['--color', value]], [['--color', value], ['-h']], [['--'], ['--color', value]]);
  }
  // Explicit empty required values are separate words and still participate in the partition.
  sequences.push([['-G', ''], ['-S', '']], [['-G', ''], ['-S', ''], ['-h']], [['-h'], ['-G', ''], ['-S', '']], [['-G', ''], operand('foo')], [['-G', ''], operand('foo'), ['-h']]);
  for (const flag of ['-I', '-O']) sequences.push([[flag, ''], ['-p']], [[flag, ''], ['-p'], ['-h']]);
  recording = true;
  for (const tokens of new Map(sequences.map(tokens => [JSON.stringify(tokens), tokens])).values()) {
    record('stash show', tokens);
    record('stash', [operand('show'), ...tokens]);
  }
  if (observe) {
    const report = { profile: 'Unpatched Git 2.55.0; native observations, not a normal-success assertion corpus', cases, summary: { total: cases.length, abnormal: cases.filter(row => row.signal || row.errorCode).length, ordinary: cases.filter(row => !row.signal && !row.errorCode).length } };
    await writeFile(observedOutput, JSON.stringify(report, null, 2) + '\n');
    console.log(`Recorded ${cases.length} native observations; ${report.summary.abnormal} abnormal terminations; no validity assertion for those results.`);
  } else {
  const fixture = JSON.stringify({ profile: 'Git 2.56.0 (argv lifetime fix); pinned Git 2.55 option vocabulary; isolated seeded stash and valid plain/dash-prefixed refs; initial KEEP_UNKNOWN_OPT help, retained-word partition, revision/diff callbacks and end markers; stdin empty', cases }, null, 2) + '\n';
  const outputs = [['test/fixtures/stash-show-corpus.json', fixture]];
  // Group the dictionary fixtures for readability; all files compile together in the standard project.
  const chunkSize = 400;
  for (let offset = 0; offset < cases.length; offset += chunkSize) {
    const part = Math.floor(offset / chunkSize) + 1;
    const types = `// Generated by node scripts/stash-show-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument, GitCommandName } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[]> = [CheckedCommandArguments<C, A, { stashParent: 'modern'; integerProfile: 'bounded'; booleanSource: 'modern'; firstPassEmpty: true; decimalCallbacks: { 'unified-context': 'modern'; 'revision-count': 'modern'; 'strip-count': 'modern'; 'daemon-count': 'modern'; 'daemon-timeout': 'modern'; 'daemon-init-timeout': 'modern' } }>] extends [never] ? false : true;\nexport type NativeStashShowCases${part} = readonly [\n` + cases.slice(offset, offset + chunkSize).map(row => `  Check<Accepted<${JSON.stringify(row.command)}, ${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
    outputs.push([`test/types/stash-show-corpus-${part}.ts`, types]);
  }
  for (const [path, content] of outputs) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent stash show outcomes.`);
  }
} finally { await rm(directory, { recursive: true, force: true }); }

// Independent oracle for the mandatory OPTION_SUBCOMMAND pass and its child parsers.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-mandatory-subcommand-'));
const env = { ...process.env, HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', GIT_TEST_DISALLOW_ABBREVIATED_OPTIONS: 'false', LC_ALL: 'C', GIT_PAGER: 'cat', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test', GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z' };
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CONFIG_PARAMETERS', 'GIT_PAGER_IN_USE']) delete env[name];
function git(args) {
  const result = spawnSync('git', args, { cwd: directory, env, input: '', encoding: 'utf8', timeout: 60000 });
  if (result.error || result.signal) throw result.error ?? new Error(`Git terminated: ${result.signal}`);
  return result;
}
const operand = value => ({ operand: value });
const serialize = tokens => tokens.flatMap(token => !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : token[0].startsWith('--') ? [`${token[0]}=${token[1]}`] : token);
try {
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  await writeFile(join(directory, 'file'), 'one\n');
  if (git(['add', 'file']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) throw new Error('Cannot seed oracle');
  for (const name of ['-h', '--', '--help-all']) if (git(['update-ref', `refs/heads/${name}`, 'HEAD']).status !== 0) throw new Error('Cannot seed refs');
  // The sample language is defined here, independently of the Type-Git registry.
  const operations = ['migrate', 'verify', 'list', 'exists', 'optimize'];
  const words = new Set(['', '-', '--', '--end-of-options', '-h', '-hh', '-hx', '-xh', '--help-all', '--unknown', '--no-verify', '-no-verify', '--list', '-list', '--verify', '-verify', '--help-all=1']);
  for (const operation of operations) for (let length = 1; length <= operation.length; length++) words.add(operation.slice(0, length));
  const sequences = [[]];
  for (const word of words) {
    sequences.push([operand(word)], [operand(word), ['-h']], [['-h'], operand(word)], [operand(word), operand('--help-all')]);
    for (const operation of operations) sequences.push([operand(word), operand(operation), operand('--help-all')]);
  }
  for (const operation of operations) {
    for (const prefix of [[], [['--']], [operand('--end-of-options')], [['-h']], [operand('unknown')]]) {
      for (const tail of [[['-h']], [['--help']], [operand('--help')], [operand('--help-all')], [operand('--unknown'), ['-h']], [['--']], [operand('--end-of-options')]]) sequences.push([...prefix, operand(operation), ...tail]);
    }
  }
  sequences.push(
    [operand('verify')], [operand('verify'), ['--help-all']], [operand('verify'), ['--verbose']], [operand('verify'), operand('extra')],
    [operand('exists'), operand('refs/heads/main')], [operand('exists'), ['--'], operand('refs/heads/main')], [operand('exists'), ['--'], operand('refs/heads/-h')],
    [operand('list')], [operand('list'), ['--count', 1]], [operand('list'), ['--count', 'bad'], ['-h']],
    [operand('list'), ['--shell'], ['--python']], [operand('list'), ['--shell'], ['--python'], ['-h']],
    [operand('list'), ['--count', -1], ['--'], ['-h']],
    [operand('migrate')], [operand('migrate'), ['--ref-format', 'bad']], [operand('migrate'), ['--ref-format', 'bad'], ['-h']],
    [operand('migrate'), ['--ref-format', '--help-all'], ['-h']],
    [operand('optimize'), ['--all']], [operand('optimize'), operand('extra')],
    [['-h'], operand('list'), ['--count', 'bad']], [['-h'], operand('migrate'), ['--ref-format', 'bad']],
    [operand('--help-all'), operand('list'), ['--count', 'bad']],
    [operand('unknown'), operand('list'), ['--count', 'bad'], ['-h']],
    [['--'], operand('list'), ['--count', 1]],
  );
  const cases = [];
  for (const tokens of new Map(sequences.map(tokens => [JSON.stringify(tokens), tokens])).values()) {
    const argv = ['refs', ...serialize(tokens)];
    const result = git(argv);
    const valid = result.status === 0 || (result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr);
    if (![0, 1, 2, 128, 129, 255].includes(result.status)) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    cases.push({ command: 'refs', tokens, argv, valid, status: result.status, diagnostic: result.stderr.split('\n')[0] });
  }
  const outputs = [['test/fixtures/mandatory-subcommand-corpus.json', JSON.stringify({ profile: 'Git 2.55.0; independent mandatory refs dispatch, exact operation prefixes, help ordering, unknowns, boundaries and child constraints in a fixed-date isolated repository; global --help and completion excluded', cases }, null, 2) + '\n']];
  for (let start = 0; start < cases.length; start += 400) {
    const types = `// @typecheck-isolated: native mandatory OPTION_SUBCOMMAND outcomes.\n// Generated by node scripts/mandatory-subcommand-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<A extends readonly GitCommandArgument<'refs'>[]> = [CheckedCommandArguments<'refs', A>] extends [never] ? false : true;\nexport type NativeMandatorySubcommandCases = readonly [\n` + cases.slice(start, start + 400).map(row => `  Check<Accepted<${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
    outputs.push([`test/types/mandatory-subcommand-corpus-${start / 400 + 1}.ts`, types]);
  }
  for (const [path, content] of outputs) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent mandatory subcommand outcomes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

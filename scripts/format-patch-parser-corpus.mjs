// Independent native oracle for the format-patch option and revision passes.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-format-oracle-'));
const env = { ...process.env, HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', LC_ALL: 'C', GIT_PAGER: 'cat', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test' };
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete env[name];
function git(args) {
  const result = spawnSync('git', args, { cwd: directory, env, input: '', encoding: 'utf8', timeout: 60000 });
  if (result.error || result.signal) throw result.error ?? new Error(`Git terminated: ${result.signal}`);
  return result;
}
const operand = value => ({ operand: value });
const count = ['--max-count', '0'];
try {
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-q']).status !== 0) throw new Error('Cannot initialize oracle repository');
  await writeFile(join(directory, 'file'), 'x\ny\n');
  if (git(['add', 'file']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) throw new Error('Cannot seed oracle repository');
  const cases = [];
  const record = (command, tokens) => {
    const argv = [...command.split(' '), ...tokens.flatMap(token => !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : token[0].startsWith('--') && token[0] !== '--default' ? [`${token[0]}=${token[1]}`] : token)];
    const result = git(argv);
    const text = result.stderr + result.stdout;
    const valid = result.status === 0 || (result.status === 129 && text.startsWith('usage:'));
    // A callback such as thread_callback can fail with status 129 and no diagnostic.
    const invalid = !valid && [128, 129].includes(result.status);
    if (!valid && !invalid) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${text}`);
    cases.push({ command, tokens, argv, valid, status: result.status, diagnostic: (result.status === 0 ? result.stderr : text).split('\n')[0] });
  };
  function permutations(values) {
    return values.length ? values.flatMap((value, i) => permutations(values.filter((_, j) => i !== j)).map(rest => [value, ...rest])) : [[]];
  }
  const sequences = [[], [count], [['--color', 'bad']], [['--thread', 'bad']],
    [['-n'], ['-k']], [['-n'], ['-N'], ['-k']],
    [['--subject-prefix', ''], ['-k']], [['--rfc'], ['-k']], [['--rfc', ''], ['-k']],
    [['--cover-from-description', 'bad']],
    [['--cover-from-description', 'bad'], ['--cover-from-description', 'auto']],
    [['--name-only']], [['--name-status']], [['--check']],
    [['--'], ['--color', 'bad']],
    [['--output-directory', 'out'], ['--output-directory', 'out']],
  ];
  for (const early of [['--thread', 'bad'], ['--start-number', 'bad'], ['--cover-from-description', 'bad']]) {
    sequences.push(...permutations([early, ['--color', 'bad'], ['-h'], operand('HEAD')]));
  }
  for (const pre of [
    [['-n'], ['-k']], [['--subject-prefix', ''], ['-k']], [['--rfc'], ['-k']],
    [['--output-directory', 'out'], ['--output-directory', 'out']],
    [['--name-only']], [['--cover-from-description', 'bad']],
  ]) for (const help of [['-h'], ['--help'], operand('--help-all')]) sequences.push([...pre, help], [help, ...pre]);
  for (const value of ['-h', '--help', '--help-all', '--thread=bad', '--thread', '-o', '-nh', '-qh', '-xqh', '-no-color', '--', '--end-of-options']) {
    for (const flag of ['-G', '--default']) sequences.push([[flag, value], ['-h']]);
  }
  for (const value of ['', 'shallow', 'deep', 'SHALLOW', 'bad']) sequences.push([['--thread', value]], [['--thread', value], ['-h']], [['-h'], ['--thread', value]]);
  for (const value of ['0', '-1', '2147483647', '2147483648', '0x10', 'bad']) sequences.push([['--start-number', value]], [['--start-number', value], ['-h']]);
  for (const flag of ['-n', '-N', '-s', '-q']) {
    sequences.push([['-G', flag], operand('x'), count], [['--default', flag], operand('HEAD'), count]);
  }
  sequences.push(
    [['--thread', 'bad'], ['--no-thread'], ['-h']],
    [['--cover-from-description', 'bad'], ['--no-cover-from-description']],
    [['-o', 'out'], ['-h'], ['-o', 'out']],
    [['--start-number', 'bad'], ['--start-number', '0'], ['-h']],
  );
  for (const tokens of sequences) {
    // stdout is always selected, so native probing cannot create patch files.
    // Empty range avoids output while preserving revision/path parsing.
    record('format-patch', [['--stdout'], ...tokens, operand('HEAD..HEAD')]);
  }
  const fixture = JSON.stringify({ profile: 'Git 2.55.0; seeded repository; format-patch parser phases; stdout and empty revision range; no user repository access', cases }, null, 2) + '\n';
  const types = `// Generated by node scripts/format-patch-parser-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument, GitCommandName } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[]> = [CheckedCommandArguments<C, A>] extends [never] ? false : true;\nexport type NativeFormatPatchParserCases = readonly [\n` + cases.map(row => `  Check<Accepted<${JSON.stringify(row.command)}, ${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
  for (const [path, content] of [['test/fixtures/format-patch-parser-corpus.json', fixture], ['test/types/format-patch-parser-corpus.ts', types]]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent format-patch parser outcomes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

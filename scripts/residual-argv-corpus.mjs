// Independent native oracle for the non-exiting initial pass and residual revision argv.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-residual-oracle-'));
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
  const originalBranch = git(['symbolic-ref', '--short', 'HEAD']).stdout.trim();
  if (git(['checkout', '-qb', 'previous']).status !== 0 || git(['checkout', '-q', originalBranch]).status !== 0) throw new Error('Cannot establish previous checkout');
  const cases = [];
  const record = (command, tokens) => {
    const argv = [command, ...tokens.flatMap(token => !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : token[0].startsWith('--') && token[0] !== '--default' ? [`${token[0]}=${token[1]}`] : token)];
    const result = git(argv);
    if (![0, 128, 129].includes(result.status)) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    cases.push({ command, tokens, argv, valid: result.status === 0, status: result.status, diagnostic: result.stderr.split('\n')[0] });
  };
  for (const command of ['log', 'show', 'whatchanged']) {
    const prefix = command === 'whatchanged' ? [['--i-still-use-this']] : [];
    const sequences = [
      [['-G', '-L'], ['-h']], [['--default', '-L'], ['-h']],
      [['-n', '-L'], operand('1,1:file'), operand('0')],
      [['-n', '-L'], operand('1,1:file'), operand('bad')],
      [['-G', '--decorate'], operand('x'), count],
      [['--default', '--decorate'], operand('HEAD'), count],
      [['-G', '--decorate=bad'], count],
      [['--'], ['--color', 'bad']], [count, ['--'], ['--color', 'bad']],
      [['-G', '--'], ['-h']], [['--default', '--end-of-options'], ['--color', 'bad']],
      [['--default', '--end-of-options'], ['--color', 'always'], operand('HEAD')],
      [operand('--end-of-options'), operand('HEAD'), ['--'], operand('--color=bad')],
      [['--default', '--quiet'], operand('HEAD'), count],
      [['-G', '-qSx'], count], [['-G', '-q'], count], [['-G', '-q'], operand('x'), count],
      [count, ['--'], ['--']], [['--default', '--format=oneline'], count, operand('HEAD')],
    ];
    // An early option consumes a word that formerly belonged to a deferred tuple.
    for (const incoming of ['--decorate', '--no-decorate', '--quiet', '-q']) {
      for (const number of ['0', '1', 'bad', '-1']) sequences.push([['-n', incoming], operand(number)]);
    }
    for (const tokens of sequences) record(command, [...prefix, ...tokens]);
  }
  const exportSequences = [
    [['--'], ['--color', 'bad']], [['--'], ['--color', 'always'], operand('HEAD')],
    [['-G', '--'], ['-h']], [['-G', '-qh']], [count, ['--'], ['--']],
    [count, ['--'], ['--color', 'bad']],
    [['--default', '--progress=1']], [['--default', '--progress=1'], operand('HEAD')],
    [['--default', '--progress'], ['--color', 'bad']],
    [['--default', '--end-of-options'], ['--color', 'bad']],
    [['--default', '--end-of-options'], ['--color', 'always'], operand('HEAD')],
  ];
  for (const value of ['0', '1', 'bad', '-1']) exportSequences.push([['-n', '--no-data'], operand(value)]);
  for (const tokens of exportSequences) record('fast-export', tokens);
  for (const command of ['cherry-pick', 'revert']) for (const tokens of [
    [['--quit']], [['--quit'], ['--']],
    [['--quit'], ['--'], ['--color', 'bad']],
    [['--quit'], ['-G', '-m']],
    [['--quit'], ['-G', '--mainline=1']],
    [['--quit'], ['--'], ['--']],
  ]) record(command, tokens);
  for (const command of ['cherry-pick', 'revert']) {
    record(command, [['--no-commit'], { operand: '-' }]);
    if (git(['reset', '--hard', 'HEAD']).status !== 0) throw new Error('Cannot restore isolated oracle repository');
  }
  const fixture = JSON.stringify({ profile: 'Git 2.55.0; seeded repository; non-exiting initial pass; no signing, remote or user repository access', cases }, null, 2) + '\n';
  const types = `// Generated by node scripts/residual-argv-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument, GitCommandName } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[]> = [CheckedCommandArguments<C, A>] extends [never] ? false : true;\nexport type NativeResidualArgvCases = readonly [\n` + cases.map(row => `  Check<Accepted<${JSON.stringify(row.command)}, ${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
  for (const [path, content] of [['test/fixtures/residual-argv-corpus.json', fixture], ['test/types/residual-argv-corpus.ts', types]]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent residual-argv outcomes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

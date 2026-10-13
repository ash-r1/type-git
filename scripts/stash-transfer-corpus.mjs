// Independent Git outcomes for stash import/export option passes and retained operands.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-stash-transfer-'));
const env = { ...process.env, HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', LC_ALL: 'C', GIT_PAGER: 'cat', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test' };
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete env[name];
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
  await writeFile(join(directory, 'file'), 'two\n');
  const stash = git(['stash', 'create']);
  if (stash.status !== 0 || !/^[0-9a-f]+\n$/.test(stash.stdout)) throw new Error('Cannot create stash object');
  await writeFile(join(directory, 'file'), 'one\n');
  const exported = git(['stash', 'export', '--print', stash.stdout.trim()]);
  if (exported.status !== 0 || !/^[0-9a-f]+\n$/.test(exported.stdout)) throw new Error('Cannot create export chain');
  const tables = JSON.parse(await readFile(new URL('spec/upstream/git-option-tables.json', root), 'utf8')).files.find(file => file.file === 'builtin/stash.c').tables;
  const cases = [];
  const record = (command, tokens) => {
    const argv = [...command.split(' '), ...serialize(tokens)];
    const result = git(argv);
    const valid = result.status === 0 || (result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr);
    if (![0, 1, 128, 129].includes(result.status)) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    cases.push({ command, tokens, argv, valid, status: result.status, diagnostic: result.stderr.split('\n')[0] });
  };
  for (const sub of ['import', 'export']) {
    // Both literal dash words resolve to valid objects for the operation being tested.
    // Import requires an export chain; export requires an ordinary stash commit.
    const oid = (sub === 'import' ? exported : stash).stdout.trim();
    for (const name of ['file', '-h', '--']) if (git(['update-ref', `refs/tags/${name}`, oid]).status !== 0) throw new Error('Cannot establish literal ref');
    const table = tables.find(table => table.function === `${sub}_stash` && table.name === 'options');
    const words = new Set(['--n', '--no', '--no-', '--unknown']);
    for (const option of table.options) if (option.long) {
      for (const name of [option.long, `no-${option.long}`, `no-no-${option.long}`]) {
        for (let size = 1; size <= name.length; size++) words.add(`--${name.slice(0, size)}`);
      }
    }
    const sequences = [];
    for (const word of [...words].sort()) for (const suffix of ['', '=', '=1', '=bad']) sequences.push([operand(word + suffix), ['-h'], ['-h']]);
    for (const word of ['-h', '-qh', '-xqh', '-no-print', '-print', '-to-ref', '-unknown']) sequences.push([operand(word), ['-h'], ['-h']]);
    sequences.push([['-h']], [['--help']], [operand('--help-all')],
      [operand('one'), operand('two'), ['-h']], [['-h'], operand('-unknown')]);
    const tails = [[], [operand('file')], [['--']], [['--'], ['-h']],
      [operand('--end-of-options'), ['-h']], [operand('file'), ['--']],
      [operand('file'), ['-h']], [operand('file'), ['--'], ['-h']],
      [operand('file'), operand('file')]];
    const prefixes = sub === 'import' ? [[]] : [[], [['--print']], [['--to-ref', 'refs/exported']]];
    for (const prefix of prefixes) for (const tail of tails) sequences.push([...prefix, ...tail]);
    if (sub === 'export') {
      for (const prefix of [[['--print'], ['--to-ref', 'refs/exported']],
        [['--to-ref', 'refs/exported'], ['--print']], [['--print'], ['--print']],
        [['--to-ref', 'refs/first'], ['--to-ref', 'refs/last']]]) {
        sequences.push(prefix, [...prefix, ['-h']]);
      }
    }
    for (const tokens of new Map(sequences.map(tokens => [JSON.stringify(tokens), tokens])).values()) {
      record(`stash ${sub}`, tokens);
      record('stash', [operand(sub), ...tokens]);
    }
  }
  const fixture = JSON.stringify({ profile: 'Git 2.55.0; isolated seeded repository; valid stash and exported-chain refs for literal --/-h; retained separators, help ordering, long prefixes and destination rules; stdin empty', cases }, null, 2) + '\n';
  const types = `// Generated by node scripts/stash-transfer-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument, GitCommandName } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[]> = [CheckedCommandArguments<C, A>] extends [never] ? false : true;\nexport type NativeStashTransferCases = readonly [\n` + cases.map(row => `  Check<Accepted<${JSON.stringify(row.command)}, ${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
  for (const [path, content] of [['test/fixtures/stash-transfer-corpus.json', fixture], ['test/types/stash-transfer-corpus.ts', types]]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent stash transfer outcomes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

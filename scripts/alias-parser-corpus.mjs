// Independent Git oracle for the clone/fetch/push aliases and ordinary option passes.
import { spawnSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-alias-parsers-'));
const env = { ...process.env, HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', GIT_TEST_DISALLOW_ABBREVIATED_OPTIONS: 'false', LC_ALL: 'C', GIT_PAGER: 'cat', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test', GIT_EDITOR: 'true', GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z' };
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CONFIG_PARAMETERS', 'GIT_PAGER_IN_USE']) delete env[name];
function git(args) {
  const input = openSync(join(directory, args.includes('--pathspec-file-nul') ? 'oracle-input-nul' : 'oracle-input'), 'r');
  try {
    const result = spawnSync('git', args, { cwd: directory, env, stdio: [input, 'pipe', 'pipe'], encoding: 'utf8', timeout: 60000 });
    if (result.error || result.signal) throw result.error ?? new Error(`Git terminated: ${result.signal}`);
    return result;
  } finally { closeSync(input); }
}
const operand = value => ({ operand: value });
const serialize = tokens => tokens.flatMap(token => !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : token[0].startsWith('--') ? [`${token[0]}=${token[1]}`] : token);
try {
  await writeFile(join(directory, 'oracle-input'), 'file\n');
  await writeFile(join(directory, 'oracle-input-nul'), 'file\0');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  for (const path of ['file']) await writeFile(join(directory, path), 'one\n');
  if (git(['add', '--', '.']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) throw new Error('Cannot seed oracle');
  if (git(['init', '--bare', '-q', 'remote.git']).status !== 0 || git(['remote', 'add', 'origin', 'remote.git']).status !== 0 || git(['push', '-q', 'origin', 'main']).status !== 0) throw new Error('Cannot seed local remote');
  for (const [key, value] of [['remote.-h.url', 'remote.git'], ['remote.-h.fetch', '+refs/heads/*:refs/remotes/dash/*'], ['branch.main.remote', 'origin'], ['branch.main.merge', 'refs/heads/main']]) if (git(['config', key, value]).status !== 0) throw new Error('Cannot seed dash-named remote');
  const files = JSON.parse(await readFile(new URL('spec/upstream/git-option-tables.json', root), 'utf8')).files;
  const cases = [];
  const record = (command, tokens) => {
    const argv = [command, ...serialize(tokens)];
    const result = git(argv);
    const valid = result.status === 0 || (result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr);
    if (![0, 1, 128, 129].includes(result.status)) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    cases.push({ command, tokens, argv, valid, status: result.status, diagnostic: result.stderr.split('\n')[0] });
    if (cases.length % 1000 === 0) console.log(`Recorded ${cases.length} native alias parser outcomes.`);
  };
  for (const command of ['clone', 'fetch', 'push']) {
    const table = files.find(file => file.file === `builtin/${command}.c`).tables.find(table => table.function === `cmd_${command}` && table.name === (command === 'push' ? 'options' : `builtin_${command}_options`));
    const words = new Set(['--n', '--no', '--no-', '--unknown']);
    for (const option of table.options) if (option.long) {
      for (const name of [option.long, `no-${option.long}`, `no-no-${option.long}`]) {
        for (let size = 1; size <= name.length; size++) words.add(`--${name.slice(0, size)}`);
      }
    }
    const sequences = [];
    for (const word of [...words].sort()) for (const suffix of ['', '=', '=1', '=bad']) sequences.push([operand(word + suffix), ['-h'], ['-h']]);
    for (const word of ['-h', '-vqh', '-qxh', '-xqh', '-no-progress', '-quiet', '-j1h', '-jbad', '-4h', '-6h']) sequences.push([operand(word), ['-h'], ['-h']]);
    sequences.push([operand('origin'), ['-h']], [['-h'], operand('-unknown')]);
    if (command === 'clone') {
      sequences.push([], [operand('one'), operand('two'), operand('three')], [operand('one'), operand('two'), operand('three'), ['-h']], [['--'], operand('remote.git'), ['-h']], [operand('--end-of-options'), operand('remote.git'), operand('clone-output')]);
      for (const word of ['--recur', '--no-recur', '--recursive', '--no-recursive', '--recurse-submodules', '--no-recurse-submodules']) sequences.push([operand(word), ['-h']], [operand(word + '=bad'), ['-h']]);
    } else {
      for (const remote of ['origin', '-h']) sequences.push([['--dry-run'], ['--'], operand(remote), operand('main')], [['--dry-run'], operand('--end-of-options'), operand(remote), operand('main')]);
      if (command === 'fetch') for (const word of ['--negotiation-', '--negotiation-r', '--negotiation-t', '--no-negotiation-', '--negotiation-tip', '--negotiation-restrict']) sequences.push([operand(word + '=HEAD'), ['-h']]);
      if (command === 'push') for (const word of ['--all', '--branches', '--bra', '--no-branches', '--no-bra']) sequences.push([['--dry-run'], operand(word), operand('origin')], [operand(word), ['--tags'], ['-h']]);
    }
    for (const tokens of new Map(sequences.map(tokens => [JSON.stringify(tokens), tokens])).values()) record(command, tokens);
  }
  const outputs = [['test/fixtures/alias-parser-corpus.json', JSON.stringify({ profile: 'Git 2.55.0; fixed commit dates, seeded local remote with main and dash-named remote; ordinary alias-aware clone/fetch/push option passes; all transfers local and push/fetch final probes dry-run', cases }, null, 2) + '\n']];
  for (const command of ['clone', 'fetch', 'push']) {
    const rows = cases.filter(row => row.command === command);
    for (let start = 0; start < rows.length; start += 400) {
      const types = `// @typecheck-isolated: native ${command} alias parser outcomes.\n// Generated by node scripts/alias-parser-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<A extends readonly GitCommandArgument<${JSON.stringify(command)}>[]> = [CheckedCommandArguments<${JSON.stringify(command)}, A>] extends [never] ? false : true;\nexport type NativeAliasParserCases = readonly [\n` + rows.slice(start, start + 400).map(row => `  Check<Accepted<${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
      outputs.push([`test/types/alias-parser-${command}-corpus-${start / 400 + 1}.ts`, types]);
    }
  }
  for (const [path, content] of outputs) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent alias parser outcomes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

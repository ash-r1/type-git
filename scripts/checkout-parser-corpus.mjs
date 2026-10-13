// Independent Git oracle for the checkout-family and reset option passes.
import { spawnSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-checkout-parsers-'));
const env = { ...process.env, HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', LC_ALL: 'C', GIT_PAGER: 'cat', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test', GIT_EDITOR: 'true', GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z' };
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
const serialize = tokens => tokens.flatMap(token => !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : token[0] === '-t' ? [`${token[0]}${token[1]}`] : token[0].startsWith('--') ? [`${token[0]}=${token[1]}`] : token);
try {
  await writeFile(join(directory, 'oracle-input'), 'file\n');
  await writeFile(join(directory, 'oracle-input-nul'), 'file\0');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  for (const path of ['file', '-h', '--', '--end-of-options', '--unified=bad']) await writeFile(join(directory, path), 'one\n');
  if (git(['add', '--', '.']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) throw new Error('Cannot seed oracle');
  for (const name of ['bad', '1', '-h', '--']) if (git(['update-ref', `refs/heads/${name}`, 'HEAD']).status !== 0) throw new Error('Cannot seed branch refs');
  const files = JSON.parse(await readFile(new URL('spec/upstream/git-option-tables.json', root), 'utf8')).files;
  const tables = files.find(file => file.file === 'builtin/checkout.c').tables;
  const cases = [];
  const record = (command, tokens) => {
    const argv = [command, ...serialize(tokens)];
    const result = git(argv);
    const valid = result.status === 0 || (result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr);
    if (![0, 1, 128, 129].includes(result.status)) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    cases.push({ command, tokens, argv, valid, status: result.status, diagnostic: result.stderr.split('\n')[0] });
  };
  for (const command of ['checkout', 'switch', 'restore', 'reset']) {
    const functions = [`cmd_${command}`, 'add_common_options', ...(command !== 'restore' ? ['add_common_switch_branch_options'] : []), ...(command !== 'switch' ? ['add_checkout_path_options'] : [])];
    const options = command === 'reset'
      ? files.find(file => file.file === 'builtin/reset.c').tables.find(table => table.function === 'cmd_reset' && table.name === 'options').options
      : tables.filter(table => functions.includes(table.function)).flatMap(table => table.options);
    if (options.some(option => option.kind === 'OPTION_ALIAS')) throw new Error('Audit aliases before extending this oracle');
    const words = new Set(['--n', '--no', '--no-', '--unknown']);
    for (const option of options) if (option.long) {
      for (const name of [option.long, `no-${option.long}`, `no-no-${option.long}`]) {
        for (let size = 1; size <= name.length; size++) words.add(`--${name.slice(0, size)}`);
      }
    }
    const sequences = [];
    for (const word of [...words].sort()) for (const suffix of ['', '=', '=1', '=bad']) sequences.push([operand(word + suffix), ['-h'], ['-h']]);
    for (const word of ['-h', '-qh', '-qxh', '-xqh', '-no-merge', '-quiet', '-th', '-tinherit', '-tbad', '-SWh', '-23h']) sequences.push([operand(word), ['-h'], ['-h']]);
    sequences.push([operand('main'), ['-h']], [['-h'], operand('-unknown')], [['--'], ['-h']], [operand('--end-of-options'), ['-h']]);
    for (const flag of command === 'reset' ? ['--recurse-submodules'] : ['--conflict', '--recurse-submodules']) for (const value of ['', 'bad', 'merge', 'diff3', 'zdiff3', 'MERGE', 'yes', '0', '-1', '2147483648']) sequences.push([[flag, value], ['-h']], [['-h'], [flag, value]]);
    if (command === 'switch') {
      sequences.push([], [['--detach']], [['--no-detach']], [['--detach'], operand('main')], [['--'], operand('main'), ['--']], [operand('--end-of-options'), operand('main'), ['--']]);
      for (const tokens of [ [['--detach'], ['--no-track']], [['--detach'], ['--track']], [['--merge'], ['--discard-changes']], [['--merge'], ['--force']], [['--no-merge'], ['--discard-changes']], [['--conflict', 'diff3'], ['--no-merge'], ['--discard-changes']] ]) sequences.push([...tokens, operand('main')], [...tokens, ['-h']]);
    } else if (command === 'restore') {
      sequences.push([], [['--'], operand('file'), ['--'], ['-h']], [operand('--end-of-options'), operand('file'), ['--'], ['-h']]);
      for (const tokens of [ [], [['--staged']], [['--no-staged']], [['--worktree']], [['--no-worktree']], [['--staged'], ['--no-worktree']], [['--no-staged'], ['--worktree']], [['--source', 'HEAD']], [['--merge'], ['--source', 'HEAD']], [['--source', 'HEAD'], ['--ours']], [['--merge'], ['--ours']], [['--ignore-unmerged'], ['--merge']], [['--pathspec-from-file', '-']], [['--pathspec-file-nul']] ]) sequences.push([...tokens, operand('file')], [...tokens, ['-h']]);
      for (const flag of ['--unified', '--inter-hunk-context']) for (const value of ['bad', '-2', '-1', '0', '1']) sequences.push([[flag, value], operand('file')], [[flag, value], ['-h']]);
    }
    if (command === 'checkout' || command === 'reset') {
      sequences.push([]);
      for (const prefix of [[], [operand('--end-of-options')]]) {
        for (const words of [['--', '-h'], ['main', '--', '-h'], ['file', 'file', '--', '-h'], ['main', 'file', '--', '-h'], ['--', '--', '-h'], ['main', '--', '--', '-h'], ['--', '--unified=bad']]) sequences.push([...prefix, ...words.map(operand)]);
      }
      const flags = command === 'checkout' ? ['--force', '--merge', '--detach', '--ours', '--theirs'] : ['--soft', '--mixed', '--hard', '--merge', '--keep'];
      for (const flag of flags) sequences.push([[flag], ['--'], operand('file')], [[flag], ['--'], ['-h']], [[flag], ['-h']]);
      for (const flag of ['--unified', '--inter-hunk-context']) for (const value of ['bad', '-2', '-1', '0', '1']) sequences.push([[flag, value], ['-h']]);
    }
    for (const tokens of new Map(sequences.map(tokens => [JSON.stringify(tokens), tokens])).values()) record(command, tokens);
  }
  const outputs = [['test/fixtures/checkout-parser-corpus.json', JSON.stringify({ profile: 'Git 2.55.0; seeded repository with tracked dash paths and valid dash-prefixed branch refs; file-backed LF/NUL stdin; ordinary checkout/switch/restore/reset passes and retained operand separators', cases }, null, 2) + '\n']];
  for (const command of ['checkout', 'switch', 'restore', 'reset']) {
    const rows = cases.filter(row => row.command === command);
    for (let start = 0; start < rows.length; start += 400) {
      const types = `// @typecheck-isolated: native ${command} parser outcomes.\n// Generated by node scripts/checkout-parser-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<A extends readonly GitCommandArgument<${JSON.stringify(command)}>[]> = [CheckedCommandArguments<${JSON.stringify(command)}, A>] extends [never] ? false : true;\nexport type NativeCheckoutParserCases = readonly [\n` + rows.slice(start, start + 400).map(row => `  Check<Accepted<${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
      outputs.push([`test/types/checkout-parser-${command}-corpus-${start / 400 + 1}.ts`, types]);
    }
  }
  for (const [path, content] of outputs) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent checkout parser outcomes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

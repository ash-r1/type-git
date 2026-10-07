// Independent native oracle for common worktree commands' ordinary option passes.
import { spawnSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-worktree-parsers-'));
const env = { ...process.env, HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', LC_ALL: 'C', GIT_PAGER: 'cat', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test', GIT_EDITOR: 'true' };
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete env[name];
function git(args) {
  // File-backed stdin avoids an EPIPE race when native help exits before reading.
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
  for (const path of ['file', '-h', '--', '--end-of-options', '--unified=bad']) await writeFile(join(directory, path), 'one\n');
  if (git(['add', '--', '.']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) throw new Error('Cannot seed oracle');
  const files = JSON.parse(await readFile(new URL('spec/upstream/git-option-tables.json', root), 'utf8')).files;
  const cases = [];
  const record = (command, tokens) => {
    const argv = [command, ...serialize(tokens)];
    const result = git(argv);
    const valid = result.status === 0 || (result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr);
    if (![0, 1, 128, 129].includes(result.status)) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    cases.push({ command, tokens, argv, valid, status: result.status, diagnostic: result.stderr.split('\n')[0] });
  };
  for (const command of ['add', 'rm', 'mv', 'clean']) {
    const table = files.find(file => file.file === `builtin/${command}.c`).tables.find(table => table.name === (command === 'clean' ? 'options' : `builtin_${command}_options`));
    const words = new Set(['--n', '--no', '--no-', '--unknown']);
    for (const option of table.options) if (option.long) {
      for (const name of [option.long, `no-${option.long}`, `no-no-${option.long}`]) {
        for (let size = 1; size <= name.length; size++) words.add(`--${name.slice(0, size)}`);
      }
    }
    const sequences = [];
    for (const word of [...words].sort()) for (const suffix of ['', '=', '=1', '=bad']) sequences.push([operand(word + suffix), ['-h'], ['-h']]);
    for (const word of ['-h', '-nh', '-nxh', '-xnh', '-dry-run', '-no-color', '-U1h', '-e']) sequences.push([operand(word), ['-h'], ['-h']]);
    sequences.push([operand('file'), ['-h']], [['-h'], operand('-unknown')], [['-n'], ['--help']]);
    const prefix = command === 'mv' ? [['-n'], ['-f']] : [['-n']];
    const tails = command === 'mv'
      ? [[], [operand('file')], [operand('file'), operand('target')], [['--'], operand('file'), operand('target')],
        [operand('file'), ['--'], ['-h']], [operand('file'), operand('--end-of-options'), ['-h']]]
      : [[], [operand('file')], [['--'], ['-h']], [operand('--end-of-options'), ['-h']],
        [operand('file'), ['--'], ['-h']], [['--'], operand('--'), ['-h']]];
    for (const tail of tails) sequences.push([...prefix, ...tail]);
    if (command === 'add' || command === 'rm') {
      sequences.push([['-n'], ['--pathspec-file-nul']], [['--pathspec-file-nul'], ['-h']],
        [['-n'], ['--pathspec-from-file', '-'], ['--pathspec-file-nul']],
        [['-n'], ['--pathspec-from-file', '-'], operand('file')]);
    }
    if (command === 'add') {
      for (const flag of ['--unified', '--inter-hunk-context']) for (const value of ['-2', '-1', '0', '1', 'bad', '2147483648']) {
        sequences.push([[flag, value], ['-h']], [['-h'], [flag, value]], [['-n'], [flag, value]]);
      }
      for (const value of ['+x', '-x', '', 'bad']) sequences.push([['--chmod', value], ['-h']], [['-n'], ['--chmod', value], operand('file')]);
      sequences.push([['-n'], ['-A'], ['-u']], [['-n'], ['-A'], ['-u'], ['-h']],
        [['-n'], ['--patch']], [['-n'], ['--patch'], ['-h']]);
    }
    if (command === 'clean') sequences.push([['-n'], ['-x'], ['-X']], [['-x'], ['-X'], ['-h']], [['-n'], ['-e', 'file']]);
    for (const tokens of new Map(sequences.map(tokens => [JSON.stringify(tokens), tokens])).values()) record(command, tokens);
  }
  const fixture = JSON.stringify({ profile: 'Git 2.55.0; isolated clean seeded repository and tracked dash-prefixed files; two terminal help words for spelling probes, dry-run for final path/rule probes; file-backed stdin with file LF or NUL according to the pathspec input mode', cases }, null, 2) + '\n';
  const outputs = [['test/fixtures/worktree-parser-corpus.json', fixture]];
  for (const command of ['add', 'rm', 'mv', 'clean']) {
    const rows = cases.filter(row => row.command === command);
    const types = `// @typecheck-isolated: native ${command} spelling and parser outcomes.\n// Generated by node scripts/worktree-parser-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<A extends readonly GitCommandArgument<${JSON.stringify(command)}>[]> = [CheckedCommandArguments<${JSON.stringify(command)}, A>] extends [never] ? false : true;\nexport type NativeWorktreeParserCases = readonly [\n` + rows.map(row => `  Check<Accepted<${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
    outputs.push([`test/types/worktree-parser-${command}-corpus.ts`, types]);
  }
  for (const [path, content] of outputs) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent worktree parser outcomes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

// Independent Git oracle for the reference subcommands and verification ordinary option passes.
import { spawnSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-ref-subcommands-'));
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
  await writeFile(join(directory, 'oracle-input'), 'refs/heads/main\n');
  await writeFile(join(directory, 'oracle-input-nul'), 'refs/heads/main\0');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  await writeFile(join(directory, 'file'), 'one\n');
  if (git(['add', 'file']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) throw new Error('Cannot seed oracle');
  for (const name of ['bad', '1', '-h', '--', '--help-all']) if (git(['update-ref', `refs/heads/${name}`, 'HEAD']).status !== 0) throw new Error('Cannot seed refs');
  const files = JSON.parse(await readFile(new URL('spec/upstream/git-option-tables.json', root), 'utf8')).files;
  const scopes = JSON.parse(await readFile(new URL('spec/git-command-scopes.json', root), 'utf8'));
  const commands = ['refs migrate', 'refs verify', 'refs list', 'refs exists', 'refs optimize', 'show-ref', 'symbolic-ref', 'verify-tag', 'verify-commit'];
  const cases = [];
  const record = (command, tokens) => {
    const argv = [...command.split(' '), ...serialize(tokens)];
    const result = git(argv);
    const warningsOnly = result.stderr.split('\n').filter(Boolean).every(line => line.startsWith('warning: '));
    const valid = result.status === 0 || (result.status === 129 && result.stdout.startsWith('usage:') && warningsOnly);
    // refs migrate returns error() (-1), exposed by the process as status 255.
    if (![0, 1, 2, 128, 129, 255].includes(result.status)) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    cases.push({ command, tokens, argv, valid, status: result.status, diagnostic: result.stderr.split('\n')[0] });
    if (cases.length % 1000 === 0) console.log(`Recorded ${cases.length} native reference subcommand outcomes.`);
  };
  for (const command of commands) {
    const definitions = scopes[command].tables.flatMap(id => {
      const [file, functionName, name] = id.split(':');
      return files.find(entry => entry.file === file).tables.find(table => (table.function ?? 'global') === functionName && table.name === name).options;
    });
    if (definitions.some(option => option.kind === 'OPTION_ALIAS')) throw new Error('Audit aliases before extending this corpus');
    const words = new Set(['--n', '--no', '--no-', '--unknown']);
    for (const option of definitions) if (option.long) for (const name of [option.long, `no-${option.long}`, `no-no-${option.long}`]) for (let size = 1; size <= name.length; size++) words.add(`--${name.slice(0, size)}`);
    const sequences = [];
    for (const word of [...words].sort()) for (const suffix of ['', '=', '=1', '=bad']) sequences.push([operand(word + suffix), operand('--help-all'), operand('--help-all')]);
    for (const word of ['-h', '-hh', '-hx', '-hv', '-vqh', '-qxh', '-xqh', '-no-verbose', '-verbose', '-sh', '-sbad']) sequences.push([operand(word), operand('--help-all')]);
    sequences.push([operand('refs/heads/main'), operand('--help-all')], [operand('--help-all'), operand('-unknown')]);
    if (command === 'refs list') {
      sequences.push([['--'], ['-h']], [operand('--end-of-options'), ['-h']], [['--stdin'], ['--'], ['-h']], [['--start-after', 'refs/heads/main'], ['--'], ['-h']], [['--count', '-1'], ['--'], ['-h']], [['--shell'], ['--python']], [['--shell'], ['--no-shell'], ['--python']]);
    } else if (command === 'refs exists') {
      sequences.push([], [['--']], [['--'], operand('refs/heads/main')], [['--'], operand('refs/heads/main'), ['-h']]);
    } else if (command === 'refs verify' || command === 'refs optimize') {
      sequences.push([['--'], operand('extra')], [operand('--end-of-options'), operand('extra')]);
    } else if (command === 'refs migrate') {
      sequences.push([], [['--ref-format', 'bad']], [['--'], operand('extra')]);
    } else if (command === 'show-ref') {
      sequences.push([['-h']], [['-h'], ['--verify']], [['-h'], ['--exists']], [['-h'], ['--verify'], operand('--help-all')], [['--verify'], ['--exists'], ['-h']], [['--verify'], ['--'], operand('refs/heads/main')], [['--exists'], ['--'], operand('refs/heads/main')], [['--head'], ['--'], ['-h']], [operand('--end-of-options'), ['-h']]);
    } else if (command === 'symbolic-ref') {
      sequences.push([], [['-m', ''], operand('HEAD')], [['-m', ''], ['-h']], [['--delete'], operand('HEAD')], [['--'], operand('HEAD')], [['--'], operand('HEAD'), operand('refs/heads/main'), operand('extra')]);
    } else {
      // Signature validity is repository/keyring dependent; only grammar/help
      // and missing-operand failures are classified in this corpus.
      sequences.push([], [['--']], [operand('--end-of-options')]);
    }
    for (const tokens of new Map(sequences.map(tokens => [JSON.stringify(tokens), tokens])).values()) record(command, tokens);
  }
  const outputs = [['test/fixtures/ref-subcommand-corpus.json', JSON.stringify({ profile: 'Git 2.55.0; fixed dates, clean repository with known refs; refs subcommands and ref/signature parser prefixes, short clusters, help timing, consumed boundaries and selected context-free final rules; show-ref -h is a native HEAD flag; no signature results classified', cases }, null, 2) + '\n']];
  for (const command of commands) {
    const rows = cases.filter(row => row.command === command);
    for (let start = 0; start < rows.length; start += 400) {
      const types = `// @typecheck-isolated: native ${command} reference parser outcomes.\n// Generated by node scripts/ref-subcommand-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<A extends readonly GitCommandArgument<${JSON.stringify(command)}>[]> = [CheckedCommandArguments<${JSON.stringify(command)}, A>] extends [never] ? false : true;\nexport type NativeRefSubcommandCases = readonly [\n` + rows.slice(start, start + 400).map(row => `  Check<Accepted<${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
      outputs.push([`test/types/ref-subcommand-${command.replaceAll(' ', '-')}-corpus-${start / 400 + 1}.ts`, types]);
    }
  }
  for (const [path, content] of outputs) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent reference subcommand outcomes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

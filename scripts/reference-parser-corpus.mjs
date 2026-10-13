// Independent native oracle for reference/status commands, LASTARG_DEFAULT and callback timing.
import { spawnSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-reference-parsers-'));
const env = { ...process.env, HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', LC_ALL: 'C', GIT_PAGER: 'cat', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test', GIT_EDITOR: 'true' };
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CONFIG_PARAMETERS', 'GIT_PAGER_IN_USE']) delete env[name];
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
const serialize = (command, tokens) => tokens.flatMap(token => !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : (({ tag: ['-n'], branch: ['-t'], status: ['-u', '-M'], commit: ['-u', '-S'] })[command]?.includes(token[0])) ? [`${token[0]}${token[1]}`] : token[0].startsWith('--') ? [`${token[0]}=${token[1]}`] : token);
try {
  await writeFile(join(directory, 'oracle-input'), 'file\n');
  await writeFile(join(directory, 'oracle-input-nul'), 'file\0');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  for (const path of ['file', '-h', '--', '--end-of-options', '--unified=bad']) await writeFile(join(directory, path), 'one\n');
  if (git(['add', '--', '.']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) throw new Error('Cannot seed oracle');
  for (const name of ['bad', '1', '-h', '--', 'file']) if (git(['update-ref', `refs/tags/${name}`, 'HEAD']).status !== 0) throw new Error('Cannot establish valid callback object refs');
  await writeFile(join(directory, 'file'), 'two\n');
  await writeFile(join(directory, '-h'), 'two\n');
  if (git(['add', '--', 'file', '-h']).status !== 0) throw new Error('Cannot stage fixture change');
  const files = JSON.parse(await readFile(new URL('spec/upstream/git-option-tables.json', root), 'utf8')).files;
  const cases = [];
  const record = (command, tokens) => {
    const argv = [command, ...serialize(command, tokens)];
    const result = git(argv);
    const valid = result.status === 0 || (result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr);
    if (![0, 1, 128, 129].includes(result.status)) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    cases.push({ command, tokens, argv, valid, status: result.status, diagnostic: result.stderr.split('\n')[0] });
  };
  for (const command of ['branch', 'tag', 'status', 'commit']) {
    const table = files.find(file => file.file === `builtin/${command === 'status' ? 'commit' : command}.c`).tables.find(table => table.function === `cmd_${command}` && table.name === (command === 'status' || command === 'commit' ? `builtin_${command}_options` : 'options'));
    const words = new Set(['--n', '--no', '--no-', '--unknown']);
    for (const option of table.options) if (option.long) {
      for (const name of [option.long, `no-${option.long}`, `no-no-${option.long}`]) {
        for (let size = 1; size <= name.length; size++) words.add(`--${name.slice(0, size)}`);
      }
    }
    const sequences = [];
    for (const word of [...words].sort()) for (const suffix of ['', '=', '=1', '=bad']) sequences.push([operand(word + suffix), ['-h'], ['-h']]);
    for (const word of ['-h', '-vh', '-vxh', '-xvh', '-no-color', '-quiet', '-n1h', '-tinherit', '-tbad']) sequences.push([operand(word), ['-h'], ['-h']]);
    sequences.push([operand('file'), ['-h']], [['-h'], operand('-unknown')], [...(command === 'commit' ? [['--dry-run']] : command === 'status' ? [] : [['--list']]), ['--'], ['-h']]);
    if (command === 'branch' || command === 'tag') {
      for (const flag of ['--contains', '--no-contains', '--merged', '--no-merged', '--points-at']) {
        sequences.push([operand(flag), ['-h'], ['--color', 'bad']], [operand(flag), ['-h'], ['--color', 'never']], [operand(flag)],
          [[flag, '']], [[flag, ''], ['-h']], [[flag, 'bad'], ['-h']],
          [['--list'], operand(flag), ['--'], ['-h']]);
      }
    }
    if (command !== 'commit') {
      const modes = ['', ' ', ',,', 'always', 'never', 'auto', 'plain', 'column', 'row', 'dense', 'nodense',
        'always,never', 'never,always', 'never,row', 'auto,row', 'row,never', 'never,dense,row',
        ' never , row ,,dense ', 'always,never,always', 'no-dense', 'nocolumn', 'Always', 'row\tnever', 'row\n', 'bad'];
      for (const value of modes) {
        sequences.push([['--column', value], ['-h']], [['-h'], ['--column', value]], [['--column', value]]);
        if (command === 'tag') sequences.push([['--column', value], ['-n', '0']], [['--column', value], ['-n', '-1']]);
      }
      if (command === 'tag') sequences.push([['--column'], ['--no-column'], ['-n']], [['--no-column'], ['--column'], ['-n']], [['--column', 'never'], ['--column'], ['-n']]);
    }
    if (command === 'status' || command === 'commit') {
      const prefix = command === 'commit' ? [['--dry-run']] : [];
      for (const value of ['', 'no', 'NO', 'false', 'OFF', 'true', 'Yes', 'ON', 'normal', 'NORMAL', 'all', 'ALL', '0', '-0', '-1', '2147483647', '2147483648', '-2147483648', '-2147483649', '0x10', '0b10', '010', '08', '1k', '2g', '  +1', '1 ', '1\\n', 'bad']) {
        sequences.push([...prefix, ['--untracked-files', value]], [['--untracked-files', value], ['-h']], [...prefix, ['--untracked-files', value], ['--untracked-files', 'normal']], [['--untracked-files', value], ['--no-untracked-files'], ...prefix]);
        if (command === 'status') sequences.push([['--ignored', 'matching'], ['--untracked-files', value]]);
      }
    }
    if (command === 'status') {
      for (const flag of ['--untracked-files', '--ignored', '--ignore-submodules', '--find-renames', '--porcelain']) {
        for (const value of ['', 'bad', '1', 'v2', 'no', 'all']) sequences.push([[flag, value]], [[flag, value], ['-h']]);
      }
    }
    if (command === 'commit') {
      for (const flag of ['--untracked-files', '--cleanup', '--unified', '--inter-hunk-context']) for (const value of ['', 'bad', '-1', '-2', '0']) {
        sequences.push([[flag, value], ['-h']], [['--dry-run'], [flag, value]]);
      }
      sequences.push([['--dry-run']], [['--dry-run'], ['--'], ['-h']], [['--dry-run'], ['--all'], ['--only']], [['--all'], ['--only'], ['-h']]);
    }
    for (const tokens of new Map(sequences.map(tokens => [JSON.stringify(tokens), tokens])).values()) record(command, tokens);
  }
  const fixture = JSON.stringify({ profile: 'Git 2.55.0; isolated seeded repository, staged change, valid refs bad/1/-h/--/file, captured stdout and no pager; ordinary parsers, LASTARG_DEFAULT, column token grammar and selected final rules; file-backed stdin', cases }, null, 2) + '\n';
  const outputs = [['test/fixtures/reference-parser-corpus.json', fixture]];
  for (const command of ['branch', 'tag', 'status', 'commit']) {
    const rows = cases.filter(row => row.command === command);
    for (let start = 0; start < rows.length; start += 400) {
    const shard = rows.slice(start, start + 400);
    const types = `// @typecheck-isolated: native ${command} spelling and parser outcomes.\n// Generated by node scripts/reference-parser-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<A extends readonly GitCommandArgument<${JSON.stringify(command)}>[]> = [CheckedCommandArguments<${JSON.stringify(command)}, A>] extends [never] ? false : true;\nexport type NativeReferenceParserCases = readonly [\n` + shard.map(row => `  Check<Accepted<${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
    outputs.push([`test/types/reference-parser-${command}-corpus-${start / 400 + 1}.ts`, types]);
    }
  }
  for (const [path, content] of outputs) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent reference parser outcomes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

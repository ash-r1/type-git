// Independent native oracle. Candidate words come from pinned native names, not the resolver.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-stash-parsers-'));
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
  for (const path of ['-h', '--', '--patch', '--no-patch', '--unified=bad']) await writeFile(join(directory, path), 'tracked\n');
  if (git(['add', '--', '.']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) throw new Error('Cannot seed oracle');
  // A literal -h after -- is an object operand in store, not help. Give it a
  // valid stash object so this boundary case does not depend on a missing ref.
  await writeFile(join(directory, 'file'), 'two\n');
  const stash = git(['stash', 'create']);
  if (stash.status !== 0 || !/^[0-9a-f]+\n$/.test(stash.stdout)) throw new Error('Cannot create fixture stash object');
  await writeFile(join(directory, 'file'), 'one\n');
  if (git(['update-ref', 'refs/tags/-h', stash.stdout.trim()]).status !== 0) throw new Error('Cannot establish literal -h ref');
  const upstream = JSON.parse(await readFile(new URL('spec/upstream/git-option-tables.json', root), 'utf8'));
  const tables = upstream.files.find(file => file.file === 'builtin/stash.c').tables;
  const cases = [];
  const record = (command, tokens) => {
    const argv = [...command.split(' '), ...serialize(tokens)];
    const result = git(argv);
    const valid = result.status === 0 || (result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr);
    if (![0, 1, 128, 129].includes(result.status)) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    cases.push({ command, tokens, argv, valid, status: result.status, diagnostic: result.stderr.split('\n')[0] });
  };
  for (const sub of ['apply', 'pop', 'drop', 'clear', 'branch', 'store', 'push', 'save', '']) {
    const command = sub ? `stash ${sub}` : 'stash';
    const table = tables.find(table => table.function === `${sub || 'push'}_stash` && table.name === 'options');
    const words = new Set(['--n', '--no', '--no-', '--unknown']);
    for (const option of table.options) if (option.long) {
      for (const name of [option.long, `no-${option.long}`, `no-no-${option.long}`]) {
        for (let size = 1; size <= name.length; size++) words.add(`--${name.slice(0, size)}`);
      }
    }
    const sequences = [];
    // Two help words keep every string-taking spelling on a non-mutating help path.
    for (const word of [...words].sort()) for (const suffix of ['', '=', '=1', '=bad']) {
      sequences.push([operand(word + suffix), ['-h'], ['-h']]);
    }
    for (const word of ['-h', '-qh', '-qxh', '-xqh', '-quiet', '-no-color', '-mh', '-m', '-U1h']) {
      sequences.push([operand(word), ['-h'], ['-h']]);
    }
    sequences.push([operand('file'), ['-h']], [['-h'], operand('-unknown')], ...(sub ? [[['--help'], operand('-unknown')]] : []),
      [operand('one'), operand('two'), operand('three'), ['-h']]);
    if (sub === 'clear' || sub === 'store') sequences.push([['--'], ['-h']], [operand('--end-of-options'), ['-h']]);
    if (sub === 'push' || sub === 'save' || sub === '') {
      for (const value of ['-2', '-1', '0', '1', 'bad', '2147483648', '0x10']) for (const flag of ['--unified', '--inter-hunk-context']) {
        sequences.push([[flag, value], ['-h']], [['-h'], [flag, value]], [[flag, value]]);
      }
      sequences.push([['--unified', '-2'], ['--unified', '-1']],
        [['--patch'], ['--include-untracked']], [['--patch'], ['--include-untracked'], ['-h']],
        [['--no-auto-advance']], [['--no-auto-advance'], ['-h']],
        [['--staged'], ['--include-untracked']], [['--staged'], ['--include-untracked'], ['-h']],
        [['-m', '--'], ['-h']], [['--'], operand('file')]);
      if (sub !== 'save') sequences.push([['--pathspec-file-nul']], [['--pathspec-file-nul'], ['-h']],
        [['--pathspec-from-file', '-'], ['--pathspec-file-nul']],
        [['--pathspec-from-file', ''], ['--pathspec-file-nul']]);
      else sequences.push([['--'], ['--unified', 'bad']], [operand('--end-of-options'), ['--unified', 'bad']]);
    }
    if (!sub) {
      const prefixes = [[], [['--patch']], [['--patch'], ['--no-patch']], [['--unified', '-1']]];
      const tails = [[], [operand('file')], [operand('file'), ['-h']],
        [['--']], [['--'], operand('file')], [['--'], ['-h']],
        [operand('file'), ['--'], ['-h']], [operand('--end-of-options'), operand('file')],
        [operand('--end-of-options'), ['--'], operand('file')],
        [operand('file'), ['--patch']], [operand('file'), ['--no-patch']],
        [operand('file'), ['--unified', 'bad']], [['--'], ['--unified', 'bad']]];
      for (const prefix of prefixes) for (const tail of tails) sequences.push([...prefix, ...tail]);
      for (const path of ['file', '-h', '--']) sequences.push([['-m', path], ['--'], operand('file')]);
      // Contrast explicit push's interleaved parser with assumed push on identical words.
      for (const tail of tails) record('stash push', tail);
      for (const name of tables.find(table => table.function === 'cmd_stash').options.map(option => option.long).filter(Boolean)) {
        for (let size = 1; size <= name.length; size++) sequences.push([operand(`-${name.slice(0, size)}`), ['-h'], ['-h']]);
      }
    }
    const distinct = new Map(sequences.map(tokens => [JSON.stringify(tokens), tokens]));
    for (const tokens of distinct.values()) record(command, tokens);
  }
  const fixture = JSON.stringify({ profile: 'Git 2.55.0; isolated clean seeded repository with a valid refs/tags/-h stash object; native long prefixes with and without equals, two terminal help words, short clusters, assumed-push operand boundaries, wrapper subcommand typos and selected repository-independent final constraints; stdin empty', cases }, null, 2) + '\n';
  const types = `// Generated by node scripts/stash-parser-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument, GitCommandName } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[]> = [CheckedCommandArguments<C, A>] extends [never] ? false : true;\nexport type NativeStashParserCases = readonly [\n` + cases.map(row => `  Check<Accepted<${JSON.stringify(row.command)}, ${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
  for (const [path, content] of [['test/fixtures/stash-parser-corpus.json', fixture], ['test/types/stash-parser-corpus.ts', types]]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent stash parser outcomes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

// Independent native oracle. No Type-Git schemas or validators determine outcomes.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-phased-exits-'));
const env = { ...process.env, HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', LC_ALL: 'C', GIT_PAGER: 'cat' };
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete env[name];
function git(args) {
  const result = spawnSync('git', args, { cwd: directory, env, encoding: 'utf8', timeout: 60000 });
  if (result.error || result.signal) throw result.error ?? new Error(`Git terminated: ${result.signal}`);
  return result;
}
function permutations(values) {
  return values.length ? values.flatMap((value, i) => permutations(values.filter((_, j) => i !== j)).map(rest => [value, ...rest])) : [[]];
}
try {
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-q']).status !== 0) throw new Error('Cannot initialize oracle repository');
  const sites = {
    log: ['--decorate', 'bad'], show: ['--decorate', 'bad'], whatchanged: ['--decorate', 'bad'],
    'fast-export': ['--progress', 'bad'], 'cherry-pick': ['--mainline', 'bad'], revert: ['--mainline', 'bad'],
  };
  const cases = [];
  for (const [command, early] of Object.entries(sites)) {
    const sequences = permutations([early, ['--color', 'bad'], ['-h'], { operand: 'missing-revision' }]);
    sequences.push(
      [['--color', 'bad'], ['-h']], [['-h'], ['--color', 'bad']],
      [['--color', 'bad'], ['--help']], [['--no-color'], ['--help'], early],
      [['--color', 'bad'], ['--'], { operand: '-h' }],
      [['-h'], ['--'], ['--color', 'bad']],
      [['-h'], ['--'], ['--'], early],
      [['--max-count', 'garbage'], ['-h']], [['-h'], ['--max-count', 'garbage']],
      [['--color', 'bad']],
      [early, ['--'], { operand: '-h' }],
    );
    if (['cherry-pick', 'revert'].includes(command)) sequences.push(
      [['--quit'], ['--abort'], ['-h']], [['-h'], ['--quit'], ['--abort']],
      [['--color', 'bad'], ['--quit'], ['--abort'], ['-h']],
    );
    // Split values are independent argv words in the first pass: they can become
    // help, another option, a cluster, or an argument consumed by an early option.
    for (const value of ['-h', '--help', '--help-all', '--decorate=bad', '--decorate', '-L', '-qh', '-xqh', '-no-color', '--progress=bad', '--mainline=bad', '--help=bad']) {
      for (const flag of ['-G', '--default']) {
        // In the log family -L consumes this -h, leaving no initial-pass exit.
        // Residual argv validation after a non-exiting pass is a separate audit.
        if (value === '-L' && ['log', 'show', 'whatchanged'].includes(command)) continue;
        sequences.push([[flag, value], ['-h']]);
      }
    }
    if (['log', 'show', 'whatchanged'].includes(command)) sequences.push(
      [['-n', '-h']], [['--default', '-h']],
      [['-n', '-L'], ['--decorate', 'bad'], ['-h']],
      [['-n', '--decorate=bad'], ['-h']],
      [['-n', '-L'], ['--'], ['-h']],
    );
    const flags = command === 'fast-export' ? ['--reencode'] : ['log', 'show', 'whatchanged'].includes(command) ? ['--decorate'] : command === 'cherry-pick' ? ['--empty'] : [];
    const values = ['', 'true', 'TRUE', 'yes', 'false', 'off', '0', '-1', '2147483647', '2147483648', '-2147483648', '-2147483649', '0x10', '0b1', '08', '1k', '2g', 'short', 'SHORT', 'full', 'auto', 'abort', 'ABORT', 'stop', 'drop', 'keep', ' true', 'true ', 'bad', '-h'];
    for (const flag of flags) for (const value of values) sequences.push([[flag, value], ['-h']], [['-h'], [flag, value]]);
    for (const tokens of sequences) {
      const argv = [command, ...tokens.flatMap(token => !Array.isArray(token) ? [token.operand] : token.length === 1 ? [token[0]] : token[0].startsWith('--') && token[0] !== '--default' ? [`${token[0]}=${token[1]}`] : [token[0], token[1]])];
      const result = git(argv);
      const text = result.stderr + result.stdout;
      const valid = result.status === 129 && text.startsWith('usage:');
      const invalid = (result.status === 129 && result.stderr.startsWith('error:')) || (result.status === 128 && /^(fatal|error):/.test(result.stderr));
      if (!valid && !invalid) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${text}`);
      cases.push({ command, tokens, argv, valid, status: result.status, diagnostic: text.split('\n')[0] });
    }
  }
  const fixture = JSON.stringify({ profile: 'Git 2.55.0, LC_ALL=C; KEEP_UNKNOWN_OPT initial parser exits; signed 32-bit boolean integers with native binary prefixes', cases }, null, 2) + '\n';
  const types = `// Generated by node scripts/phased-parser-exit-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument, GitCommandName } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[]> = [CheckedCommandArguments<C, A>] extends [never] ? false : true;\nexport type NativePhasedExitCases = readonly [\n` + cases.map(row => `  Check<Accepted<${JSON.stringify(row.command)}, ${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
  for (const [path, content] of [['test/fixtures/phased-parser-exit-corpus.json', fixture], ['test/types/phased-parser-exit-corpus.ts', types]]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent phased parser outcomes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

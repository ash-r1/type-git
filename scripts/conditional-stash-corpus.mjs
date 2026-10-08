// Independent Git oracle: paired repository states and native trace2 child argv.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-stash-oracle-'));
const trace = join(directory, 'trace.json');
const env = { ...process.env, HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', LC_ALL: 'C', GIT_PAGER: 'cat', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test', GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' };
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_TRACE2_EVENT']) delete env[name];
function git(args, traced = false) {
  const result = spawnSync('git', args, { cwd: directory, env: traced ? { ...env, GIT_TRACE2_EVENT: trace } : env, input: '', encoding: 'utf8', timeout: 60000 });
  if (result.error || result.signal) throw result.error ?? new Error(`Git terminated: ${result.signal}`);
  return result;
}
const operand = value => ({ operand: value });
const serialize = tokens => tokens.flatMap(token => !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : token[0].startsWith('--') && token[0] !== '--default' ? [`${token[0]}=${token[1]}`] : token);
try {
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle repository');
  await writeFile(join(directory, 'file'), 'one\n');
  if (git(['add', 'file']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) throw new Error('Cannot seed oracle repository');
  const sequences = [[], [['--max-count', '0']], [['--color', 'bad']], [['--decorate', 'bad']],
    [['--graph']], [['--reverse']], [['--reverse'], ['--reverse']], [['--no-walk']],
    [['--pretty', 'oneline']], [['--format', '%gs']], [['-g']],
    [operand('--unknown')], [operand('missing-revision')], [operand('HEAD')],
    [['--']], [['--'], ['--color', 'bad']], [['--'], ['-h']],
    [['--'], ['--'], ['--color', 'bad']], [operand('--end-of-options'), operand('HEAD')],
    [['-G', '-L'], ['-h']], [['-G', '--']], [['--default', '--']],
  ];
  for (const value of ['bad', 'auto', 'short', '', '2147483648']) {
    for (const flag of ['--decorate', '--color']) for (const help of [['-h'], ['--help'], operand('--help-all')]) {
      sequences.push([[flag, value], help], [help, [flag, value]]);
    }
  }
  for (const value of ['-h', '--help', '--help-all', '-no-color', '-qh', '--decorate=bad', '--', '--end-of-options']) {
    sequences.push([['-G', value], ['-h']], [['--default', value], ['-h']]);
  }
  for (const value of ['0', '-1', 'bad', '2147483648']) sequences.push([['--max-count', value]]);
  const cases = sequences.flatMap(tokens => [
    { command: 'stash list', tokens, argv: ['stash', 'list', ...serialize(tokens)], outcomes: [] },
    { command: 'stash', tokens: [operand('list'), ...tokens], argv: ['stash', 'list', ...serialize(tokens)], outcomes: [] },
  ]);
  for (const refExists of [false, true]) {
    if (refExists) {
      await writeFile(join(directory, 'file'), 'two\n');
      if (git(['stash', 'push', '-qm', 'saved']).status !== 0) throw new Error('Cannot create isolated stash');
    }
    if ((git(['show-ref', '--verify', '--quiet', 'refs/stash']).status === 0) !== refExists) throw new Error('Wrong repository state');
    for (const row of cases) {
      await writeFile(trace, '');
      const result = git(row.argv, true);
      const valid = result.status === 0 || ([1, 129].includes(result.status) && result.stdout.startsWith('usage:') && !result.stderr);
      if (![0, 1, 128, 129].includes(result.status)) throw new Error(`Unclassified ${JSON.stringify(row.argv)}: ${result.status}: ${result.stderr}`);
      const events = (await readFile(trace, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      const children = events.filter(event => event.event === 'child_start' && event.argv?.[0] === 'git' && event.argv[1] === 'log');
      if (children.length > 1) throw new Error('Unexpected repeated log child');
      const childArgv = children[0]?.argv.slice(1) ?? null;
      const childStatus = childArgv ? git(childArgv).status : null;
      if (childStatus !== null && result.status !== Number(childStatus !== 0)) throw new Error('Unexpected child status mapping');
      row.outcomes.push({ refExists, valid, status: result.status, diagnostic: result.stderr.split('\n')[0], childArgv, childStatus });
    }
  }
  for (const row of cases) row.accepted = row.outcomes.some(outcome => outcome.valid);
  const fixture = JSON.stringify({ profile: 'Git 2.55.0; isolated seeded repository before/after creation of refs/stash; child argv from native trace2; unknown repository state accepts either feasible branch', cases }, null, 2) + '\n';
  const types = `// Generated by node scripts/conditional-stash-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument, GitCommandName } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[]> = [CheckedCommandArguments<C, A>] extends [never] ? false : true;\nexport type NativeConditionalStashCases = readonly [\n` + cases.map(row => `  Check<Accepted<${JSON.stringify(row.command)}, ${JSON.stringify(row.tokens)}> extends ${row.accepted} ? true : false>,`).join('\n') + '\n];\n';
  for (const [path, content] of [['test/fixtures/conditional-stash-corpus.json', fixture], ['test/types/conditional-stash-corpus.ts', types]]) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} argument sequences in both ref states (${cases.length * 2} native outcomes).`);
} finally { await rm(directory, { recursive: true, force: true }); }

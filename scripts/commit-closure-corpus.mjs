// Independent native oracle for the commit completion closure (docs/design/audit-completion.md).
// Cases are real commits, not dry runs, so the refusals in prepare_to_commit and the reword
// checks are reached; the repository is reset to its seed after every case. Pairs over a
// fixed vocabulary witness the closure's mappings; they are not a completeness argument.
import { spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-commit-closure-'));
const directory = join(base, 'repo');
const env = {
  ...nativeOracleBaseEnv(),
  HOME: base,
  XDG_CONFIG_HOME: base,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_COUNT: '0',
  LC_ALL: 'C',
  GIT_PAGER: 'cat',
  GIT_EDITOR: 'true',
  GIT_SEQUENCE_EDITOR: 'true',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.test',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.test',
};
/** Execute native Git with file-backed empty stdin and report abnormal termination. */
function git(args) {
  const input = openSync(join(base, 'oracle-stdin'), 'r');
  try {
    const result = spawnSync('git', args, { cwd: directory, env, stdio: [input, 'pipe', 'pipe'], encoding: 'utf8', timeout: 60000 });
    if (result.error || result.signal) throw result.error ?? new Error(`Git terminated: ${result.signal}`);
    return result;
  } finally {
    closeSync(input);
  }
}
const operand = (value) => ({ operand: value });
/** Spell tokens without importing production serialization: long values attach with '='. */
const serialize = (tokens) =>
  tokens.flatMap((token) =>
    !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : token[0].startsWith('--') ? [`${token[0]}=${token[1]}`] : token,
  );
/** Refusals these cases may reach in Git 2.55.0; any other failure aborts generation. */
const DIAGNOSTICS = [
  /^fatal: options '[^']*' and '[^']*' cannot be used together$/,
  /^fatal: options '[^']*', '[^']*'(?:, and '[^']*')? cannot be used together$/,
  /^fatal: options '-m' and '--fixup:(?:amend|reword)' cannot be used together$/,
  /^fatal: --reset-author can be used only with -C, -c or --amend\.$/,
  /^fatal: unknown option: --fixup=[A-Za-z]+:.*$/,
  /^fatal: could not lookup commit '.*'$/,
  /^fatal: paths '.*' with -a does not make sense$/,
  /^fatal: reword option of '--fixup' and (?:path '.*'|'--patch\/--interactive\/--all\/--include\/--only') cannot be used together$/,
  /^fatal: the option '[^']*' requires '[^']*'$/,
  /^fatal: '--pathspec-from-file' and pathspec arguments cannot be used together$/,
  /^fatal: No paths with --include\/--only does not make sense\.$/,
  /^fatal: empty string is not a valid pathspec\. please use \. instead if you meant to match all paths$/,
  /^fatal: Invalid cleanup mode .*$/,
  /^fatal: '--(?:unified|inter-hunk-context)' cannot be negative$/,
  /^fatal: unsupported porcelain version '.*'$/,
  /^fatal: Invalid untracked files mode '.*'$/,
  /^error: pathspec '.*$/,
  /^error: (?:option|switch) `[^']*' (?:takes no value|requires a value)$/,
];
const MESSAGES = [['-m', 'msg'], ['-m', ''], ['-C', 'HEAD'], ['-c', 'HEAD'], ['-F', '../oracle-message'], ['--squash', 'HEAD']];
const FIXUPS = [['--fixup', 'HEAD'], ['--fixup', 'amend:HEAD'], ['--fixup', 'reword:HEAD'], ['--fixup', 'x:HEAD'], ['--fixup', 'Amend:HEAD'], ['--no-fixup']];
// Edges of the suboption grammar, run alone and before a later --fixup or --no-fixup.
const FIXUP_EDGES = [':HEAD', 'é:HEAD', 'ab1:HEAD', 'x::HEAD', 'amend:x:y', 'amend:', 'amendx:HEAD', 'HEAD~1:file'].map((v) => ['--fixup', v]);
const AUTHORS = [['--author', 'A <a@example.test>'], ['--reset-author'], ['--amend'], ['--allow-empty']];
const MODES = [['-i'], ['-o'], ['-a'], ['--no-all']];
const PATHS = [operand('file'), operand(''), ['--pathspec-from-file', '../oracle-paths'], ['--pathspec-file-nul']];
const OTHERS = [['-U', '1'], ['-U', '-1'], ['-U', '-2'], ['--inter-hunk-context', '1'], ['--inter-hunk-context', '-2'], ['--cleanup', 'bad'], ['--cleanup', 'strip'], ['--long'], ['-z'], ['--porcelain'], ['--untracked-files', 'bad']];
const families = [MESSAGES, FIXUPS, AUTHORS, MODES, PATHS, OTHERS];
try {
  await mkdir(directory);
  await writeFile(join(base, 'oracle-stdin'), '');
  await writeFile(join(base, 'oracle-message'), 'from file\n');
  await writeFile(join(base, 'oracle-paths'), 'file\n');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  await writeFile(join(directory, 'file'), 'one\n');
  if (git(['add', '--', 'file']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) throw new Error('Cannot seed oracle');
  const seed = git(['rev-parse', 'HEAD']).stdout.trim();
  /** Restore the seed commit with one staged and one unstaged change before every case. */
  const reset = async () => {
    if (git(['reset', '-q', '--hard', seed]).status !== 0) throw new Error('Cannot reset oracle');
    await writeFile(join(directory, 'file'), 'one\ntwo\n');
    if (git(['add', '--', 'file']).status !== 0) throw new Error('Cannot stage oracle change');
    await writeFile(join(directory, 'file'), 'one\ntwo\nthree\n');
  };
  const cases = [];
  const record = async (tokens) => {
    await reset();
    const argv = ['commit', ...serialize(tokens)];
    const result = git(argv);
    const diagnostic = result.stderr.split('\n').find((line) => /^(fatal|error):/.test(line)) ?? '';
    // Exit 1 is a well-formed invocation with nothing to commit; usage on stdout is help.
    const usage = result.status === 129 && result.stdout.startsWith('usage:') && !result.stderr;
    const valid = ((result.status === 0 || result.status === 1) && !diagnostic) || usage;
    if (!valid && !DIAGNOSTICS.some((p) => p.test(diagnostic))) {
      throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    }
    cases.push({ command: 'commit', tokens, argv, valid, status: result.status, diagnostic });
  };
  const sequences = [];
  for (const family of families) for (const a of family) sequences.push([a]);
  for (const [i, left] of families.entries()) {
    for (const [j, right] of families.entries()) {
      if (i === j) continue;
      for (const a of left) for (const b of right) sequences.push([a, b]);
    }
  }
  // Within-family pairs decide last-wins and exclusivity inside each family.
  for (const family of families) for (const a of family) for (const b of family) if (a !== b) sequences.push([a, b]);
  // Interactive and patch modes only where an earlier refusal fires before add -i runs.
  for (const a of [['--interactive'], ['-p']]) for (const b of [['-i'], ['-o'], ['-a'], ['--fixup', 'reword:HEAD'], ['--pathspec-from-file', '../oracle-paths']]) sequences.push([a, b], [b, a]);
  for (const e of FIXUP_EDGES) for (const b of [[], [['--fixup', 'HEAD']], [['--no-fixup']], [['-m', 'msg']]]) sequences.push([e, ...b]);
  // Plain fixups with --amend in only mode, and --reset-author with --amend and a fixup.
  for (const f of [['--fixup', 'HEAD'], ['--fixup', 'amend:HEAD'], ['--no-fixup']]) {
    sequences.push([['-o'], ['--amend'], f], [['--reset-author'], ['--amend'], f], [['--amend'], f, ['--reset-author']]);
  }
  // Reword fixups with each content mode after a message, and with operands.
  for (const m of [[], [['-m', 'msg']]]) for (const b of [...MODES, operand('file')]) sequences.push([...m, ['--fixup', 'reword:HEAD'], b]);
  const unique = new Map(sequences.map((tokens) => [JSON.stringify(tokens), tokens]));
  for (const tokens of unique.values()) await record(tokens);
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; isolated repository reset to its seed commit with a staged and an unstaged change before every case; real commits with GIT_EDITOR=true; message and pathspec files outside the work tree; closure vocabulary pairs; empty file-backed stdin',
      cases,
    },
    null,
    2,
  )}\n`;
  const target = new URL('test/fixtures/commit-closure-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('commit-closure-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} independent commit closure outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}

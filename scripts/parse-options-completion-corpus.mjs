// Native completion exits and their exact single-word condition, independently of validators.
import { oracleEnv, gitRunner, serialize } from './checkout-oracle.mjs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'type-git-parse-options-completion-'));
const git = gitRunner(directory, oracleEnv(directory));
/** Preserve literal native words independently of production parsing. */
const operand = value => ({ operand: value });

const commands = ['add', 'rm', 'mv', 'clean', 'commit', 'status', 'clone', 'fetch', 'push', 'branch', 'checkout', 'switch', 'restore', 'reset', 'tag', 'stash clear', 'stash apply', 'stash drop', 'stash pop', 'stash branch', 'stash store', 'stash push', 'stash save', 'stash import', 'stash export', 'log', 'show', 'reflog show', 'stash show', 'merge', 'rebase', 'cherry-pick', 'revert', 'for-each-ref', 'show-ref', 'symbolic-ref', 'verify-tag', 'verify-commit', 'refs migrate', 'refs verify', 'refs exists', 'refs list', 'refs optimize', 'format-patch', 'whatchanged', 'show-branch', 'refs', 'fast-export', 'reflog', 'stash', 'stash list'];
try {
  await writeFile(join(directory, 'oracle-input'), '');
  await writeFile(join(directory, 'oracle-input-nul'), '');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-qb', 'main']).status !== 0) throw new Error('Cannot initialize oracle');
  await writeFile(join(directory, 'file'), 'one\n');
  if (git(['add', 'file']).status !== 0 || git(['commit', '-qm', 'seed']).status !== 0) throw new Error('Cannot seed oracle');
  // Supply valid object/ref context so opaque stash operands are classified
  // by their grammar rather than by a missing ref in the sample repository.
  await writeFile(join(directory, 'file'), 'two\n');
  const stash = git(['stash', 'create']).stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(stash)) throw new Error('Cannot create oracle stash');
  await writeFile(join(directory, 'file'), 'one\n');
  if (git(['stash', 'store', '-m', 'oracle', stash]).status !== 0) throw new Error('Cannot seed oracle stash');
  for (const word of ['--git-completion-helper', '--git-completion-helper-all']) {
    for (const suffix of ['', '=1']) {
      if (git(['update-ref', `refs/heads/${word}${suffix}`, stash]).status !== 0) throw new Error('Cannot seed dash-prefixed oracle ref');
    }
  }
  const cases = [];
  /** Record the actual native exit and diagnostic for one finite argv. */
  const record = (command, tokens) => {
    const argv = [...command.split(' '), ...serialize(tokens)];
    const result = git(argv);
    const warningsOnly = result.stderr.split('\n').filter(Boolean).every(line => line.startsWith('warning: '));
    const valid = result.status === 0 || (result.status === 129 && result.stdout.startsWith('usage:') && warningsOnly);
    if (![0, 1, 2, 128, 129, 255].includes(result.status)) throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    cases.push({ command, tokens, argv, valid, status: result.status, diagnostic: result.stderr.split('\n')[0] });
  };
  for (const command of commands) {
    for (const word of ['--git-completion-helper', '--git-completion-helper-all']) {
      record(command, [[word]]);
      record(command, [operand(word)]);
      record(command, [operand(word), ['-h']]);
      record(command, [['-h'], operand(word)]);
      record(command, [operand('--help-all'), operand(word)]);
      // Unknown retained words after stash list's ref gate depend on repository
      // existence. They cannot be turned into unconditional grammar rejections.
      if (command !== 'stash list') {
        record(command, [operand(word), operand(word)]);
        record(command, [operand(`${word}=1`)]);
        record(command, [operand(word), ['--']]);
      }
    }
  }
  // Source-audited setup_revisions/diff_opt_parse ONE_SHOT contexts: reached
  // callbacks precede completion, while unknown words await the final usage check.
  for (const command of ['log', 'show', 'reflog show', 'stash show', 'cherry-pick', 'revert', 'format-patch', 'whatchanged', 'fast-export', 'reflog']) {
    for (const word of ['--git-completion-helper', '--git-completion-helper-all']) {
      record(command, [operand('--unknown'), operand(word)]);
      record(command, [operand(word), operand('--unknown')]);
      record(command, [operand('-n1k'), operand(word)]);
      record(command, [operand('-n1'), operand(word)]);
      record(command, [['--reverse'], operand(word)]);
      for (const prefix of ['--co', '--uni=1k', '--graph=1']) record(command, [operand(prefix), operand(word)]);
    }
  }
  for (const operation of ['migrate', 'verify', 'exists', 'list', 'optimize']) for (const word of ['--git-completion-helper', '--git-completion-helper-all']) {
    record('refs', [operand(operation), [word]]);
    record('refs', [operand(operation), operand(word)]);
  }
  const outputs = [['test/fixtures/parse-options-completion-corpus.json', JSON.stringify({ profile: 'Git 2.55.0; valid existing stash and dash-prefixed stash refs; all 51 recorded parse-options initial scopes, singleton completion words as tuples/operands, non-singleton and attached lookalikes, help ordering, mandatory refs child contexts and source-audited ONE_SHOT revision exits. Conditional stash list post-gate unknowns remain deferred; no argv or repository completeness claim.', commands, cases }, null, 2) + '\n']];
  for (let start = 0; start < cases.length; start += 400) {
    const types = `// Generated by node scripts/parse-options-completion-corpus.mjs from independent Git outcomes.\nimport type { CheckedCommandArguments, GitCommandArgument, GitCommandName } from '../../src/commands/types.js';\ntype Check<T extends true> = T;\ntype Accepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[]> = [CheckedCommandArguments<C, A, { integerProfile: 'bounded'; booleanSource: 'modern'; firstPassEmpty: true; conflictStyle: 'immediate'; stashParent: 'modern'; decimalCallbacks: { 'unified-context': 'modern'; 'revision-count': 'modern'; 'strip-count': 'modern'; 'daemon-count': 'modern'; 'daemon-timeout': 'modern'; 'daemon-init-timeout': 'modern' } }>] extends [never] ? false : true;\nexport type NativeCompletionCases = readonly [\n` + cases.slice(start, start + 400).map(row => `  Check<Accepted<${JSON.stringify(row.command)}, ${JSON.stringify(row.tokens)}> extends ${row.valid} ? true : false>,`).join('\n') + '\n];\n';
    outputs.push([`test/types/parse-options-completion-corpus-${start / 400 + 1}.ts`, types]);
  }
  for (const [path, content] of outputs) {
    const target = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale`);
    } else await writeFile(target, content);
  }
  console.log(`Generated/checked ${cases.length} independent completion outcomes for ${commands.length} scopes.`);
} finally { await rm(directory, { recursive: true, force: true }); }

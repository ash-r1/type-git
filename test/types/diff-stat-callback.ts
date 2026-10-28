import type { Git, GitCommandArgument } from '../../src/index.js';
import type { CompoundDecimalLiteral } from '../../src/constraints/compound-decimal-types.js';
declare const git: Git;
declare const dynamic: string;
type Check<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
export type StatTupleCases = readonly [
  Check<Equal<CompoundDecimalLiteral<'0,999,999', 'diff-stat'>, true>>,
  Check<Equal<CompoundDecimalLiteral<',,', 'diff-stat'>, true>>,
  Check<Equal<CompoundDecimalLiteral<'1,2,3,', 'diff-stat'>, false>>,
  Check<Equal<CompoundDecimalLiteral<'1,0x10', 'diff-stat'>, false>>,
  Check<Equal<CompoundDecimalLiteral<'1,2' | '1,2 ', 'diff-stat'>, false>>,
  Check<Equal<CompoundDecimalLiteral<string, 'diff-stat'>, true>>,
];

// log: callback grammar plus the independently measured help phase.
git.command('log', [['--stat-width', '0x10'], ['-h']]);
git.command('log', [['--stat-name-width', '0x10'], ['-h']]);
git.command('log', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('log', [['--stat-count', '0x10'], ['-h']]);
git.command('log', [['-h'], ['--stat', '1,2,3,']]);
git.command('log', [['--help-all'], ['--stat-width', 'bad']]);
git.command('log', [['--stat', '0,999,999'], ['-h']]);
git.command('log', [['--stat-width', '010'], ['-h']]);
git.command('log', [['--stat-width', dynamic], ['-h']]);

// show: callback grammar plus the independently measured help phase.
git.command('show', [['--stat-width', '0x10'], ['-h']]);
git.command('show', [['--stat-name-width', '0x10'], ['-h']]);
git.command('show', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('show', [['--stat-count', '0x10'], ['-h']]);
git.command('show', [['-h'], ['--stat', '1,2,3,']]);
git.command('show', [['--help-all'], ['--stat-width', 'bad']]);
git.command('show', [['--stat', '0,999,999'], ['-h']]);
git.command('show', [['--stat-width', '010'], ['-h']]);
git.command('show', [['--stat-width', dynamic], ['-h']]);

// diff: callback grammar plus the independently measured help phase.
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff', [['--stat-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff', [['--stat-name-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff', [['--stat-graph-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff', [['--stat-count', '0x10'], ['-h']]);
// @ts-expect-error Continuing diff callbacks also run after short help.
git.command('diff', [['-h'], ['--stat', '1,2,3,']]);
git.command('diff', [['--stat', '0,999,999'], ['-h']]);
git.command('diff', [['--stat-width', '010'], ['-h']]);
git.command('diff', [['--stat-width', dynamic], ['-h']]);

// diff-files: callback grammar plus the independently measured help phase.
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-files', [['--stat-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-files', [['--stat-name-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-files', [['--stat-graph-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-files', [['--stat-count', '0x10'], ['-h']]);
// @ts-expect-error Continuing diff callbacks also run after short help.
git.command('diff-files', [['-h'], ['--stat', '1,2,3,']]);
git.command('diff-files', [['--stat', '0,999,999'], ['-h']]);
git.command('diff-files', [['--stat-width', '010'], ['-h']]);
git.command('diff-files', [['--stat-width', dynamic], ['-h']]);

// diff-index: callback grammar plus the independently measured help phase.
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-index', [['--stat-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-index', [['--stat-name-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-index', [['--stat-graph-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-index', [['--stat-count', '0x10'], ['-h']]);
// @ts-expect-error Continuing diff callbacks also run after short help.
git.command('diff-index', [['-h'], ['--stat', '1,2,3,']]);
git.command('diff-index', [['--stat', '0,999,999'], ['-h']]);
git.command('diff-index', [['--stat-width', '010'], ['-h']]);
git.command('diff-index', [['--stat-width', dynamic], ['-h']]);

// diff-tree: callback grammar plus the independently measured help phase.
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-tree', [['--stat-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-tree', [['--stat-name-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-tree', [['--stat-graph-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-tree', [['--stat-count', '0x10'], ['-h']]);
// @ts-expect-error Continuing diff callbacks also run after short help.
git.command('diff-tree', [['-h'], ['--stat', '1,2,3,']]);
git.command('diff-tree', [['--stat', '0,999,999'], ['-h']]);
git.command('diff-tree', [['--stat-width', '010'], ['-h']]);
git.command('diff-tree', [['--stat-width', dynamic], ['-h']]);

// diff --no-index: callback grammar plus the independently measured help phase.
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff --no-index', [['--stat-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff --no-index', [['--stat-name-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff --no-index', [['--stat-graph-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff --no-index', [['--stat-count', '0x10'], ['-h']]);
git.command('diff --no-index', [['-h'], ['--stat', '1,2,3,']]);
git.command('diff --no-index', [['--help-all'], ['--stat-width', 'bad']]);
git.command('diff --no-index', [['--stat', '0,999,999'], ['-h']]);
git.command('diff --no-index', [['--stat-width', '010'], ['-h']]);
git.command('diff --no-index', [['--stat-width', dynamic], ['-h']]);

// reflog show: callback grammar plus the independently measured help phase.
git.command('reflog show', [['--stat-width', '0x10'], ['-h']]);
git.command('reflog show', [['--stat-name-width', '0x10'], ['-h']]);
git.command('reflog show', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('reflog show', [['--stat-count', '0x10'], ['-h']]);
git.command('reflog show', [['-h'], ['--stat', '1,2,3,']]);
git.command('reflog show', [['--help-all'], ['--stat-width', 'bad']]);
git.command('reflog show', [['--stat', '0,999,999'], ['-h']]);
git.command('reflog show', [['--stat-width', '010'], ['-h']]);
git.command('reflog show', [['--stat-width', dynamic], ['-h']]);

// stash show: callback grammar plus the independently measured help phase.
git.command('stash show', [['--stat-width', '0x10'], ['-h']]);
git.command('stash show', [['--stat-name-width', '0x10'], ['-h']]);
git.command('stash show', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('stash show', [['--stat-count', '0x10'], ['-h']]);
git.command('stash show', [['-h'], ['--stat', '1,2,3,']]);
git.command('stash show', [['--help-all'], ['--stat-width', 'bad']]);
git.command('stash show', [['--stat', '0,999,999'], ['-h']]);
git.command('stash show', [['--stat-width', '010'], ['-h']]);
git.command('stash show', [['--stat-width', dynamic], ['-h']]);

// cherry-pick: callback grammar plus the independently measured help phase.
git.command('cherry-pick', [['--stat-width', '0x10'], ['-h']]);
git.command('cherry-pick', [['--stat-name-width', '0x10'], ['-h']]);
git.command('cherry-pick', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('cherry-pick', [['--stat-count', '0x10'], ['-h']]);
git.command('cherry-pick', [['-h'], ['--stat', '1,2,3,']]);
git.command('cherry-pick', [['--help-all'], ['--stat-width', 'bad']]);
git.command('cherry-pick', [['--stat', '0,999,999'], ['-h']]);
git.command('cherry-pick', [['--stat-width', '010'], ['-h']]);
git.command('cherry-pick', [['--stat-width', dynamic], ['-h']]);

// revert: callback grammar plus the independently measured help phase.
git.command('revert', [['--stat-width', '0x10'], ['-h']]);
git.command('revert', [['--stat-name-width', '0x10'], ['-h']]);
git.command('revert', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('revert', [['--stat-count', '0x10'], ['-h']]);
git.command('revert', [['-h'], ['--stat', '1,2,3,']]);
git.command('revert', [['--help-all'], ['--stat-width', 'bad']]);
git.command('revert', [['--stat', '0,999,999'], ['-h']]);
git.command('revert', [['--stat-width', '010'], ['-h']]);
git.command('revert', [['--stat-width', dynamic], ['-h']]);

// rev-list: callback grammar plus the independently measured help phase.
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('rev-list', [['--stat-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('rev-list', [['--stat-name-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('rev-list', [['--stat-graph-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('rev-list', [['--stat-count', '0x10'], ['-h']]);
// @ts-expect-error Continuing diff callbacks also run after short help.
git.command('rev-list', [['-h'], ['--stat', '1,2,3,']]);
git.command('rev-list', [['--stat', '0,999,999'], ['-h']]);
git.command('rev-list', [['--stat-width', '010'], ['-h']]);
git.command('rev-list', [['--stat-width', dynamic], ['-h']]);

// backfill: callback grammar plus the independently measured help phase.
git.command('backfill', [['--stat-width', '0x10'], ['-h']]);
git.command('backfill', [['--stat-name-width', '0x10'], ['-h']]);
git.command('backfill', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('backfill', [['--stat-count', '0x10'], ['-h']]);
git.command('backfill', [['-h'], ['--stat', '1,2,3,']]);
git.command('backfill', [['--help-all'], ['--stat-width', 'bad']]);
git.command('backfill', [['--stat', '0,999,999'], ['-h']]);
git.command('backfill', [['--stat-width', '010'], ['-h']]);
git.command('backfill', [['--stat-width', dynamic], ['-h']]);

// last-modified: callback grammar plus the independently measured help phase.
git.command('last-modified', [['--stat-width', '0x10'], ['-h']]);
git.command('last-modified', [['--stat-name-width', '0x10'], ['-h']]);
git.command('last-modified', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('last-modified', [['--stat-count', '0x10'], ['-h']]);
git.command('last-modified', [['-h'], ['--stat', '1,2,3,']]);
git.command('last-modified', [['--help-all'], ['--stat-width', 'bad']]);
git.command('last-modified', [['--stat', '0,999,999'], ['-h']]);
git.command('last-modified', [['--stat-width', '010'], ['-h']]);
git.command('last-modified', [['--stat-width', dynamic], ['-h']]);

// diff-pairs: callback grammar plus the independently measured help phase.
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-pairs', [['--stat-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-pairs', [['--stat-name-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-pairs', [['--stat-graph-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('diff-pairs', [['--stat-count', '0x10'], ['-h']]);
git.command('diff-pairs', [['-h'], ['--stat', '1,2,3,']]);
git.command('diff-pairs', [['--help-all'], ['--stat-width', 'bad']]);
git.command('diff-pairs', [['--stat', '0,999,999'], ['-h']]);
git.command('diff-pairs', [['--stat-width', '010'], ['-h']]);
git.command('diff-pairs', [['--stat-width', dynamic], ['-h']]);

// range-diff: callback grammar plus the independently measured help phase.
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('range-diff', [['--stat-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('range-diff', [['--stat-name-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('range-diff', [['--stat-graph-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('range-diff', [['--stat-count', '0x10'], ['-h']]);
git.command('range-diff', [['-h'], ['--stat', '1,2,3,']]);
git.command('range-diff', [['--help-all'], ['--stat-width', 'bad']]);
git.command('range-diff', [['--stat', '0,999,999'], ['-h']]);
git.command('range-diff', [['--stat-width', '010'], ['-h']]);
git.command('range-diff', [['--stat-width', dynamic], ['-h']]);

// replay: callback grammar plus the independently measured help phase.
git.command('replay', [['--stat-width', '0x10'], ['-h']]);
git.command('replay', [['--stat-name-width', '0x10'], ['-h']]);
git.command('replay', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('replay', [['--stat-count', '0x10'], ['-h']]);
git.command('replay', [['-h'], ['--stat', '1,2,3,']]);
git.command('replay', [['--help-all'], ['--stat-width', 'bad']]);
git.command('replay', [['--stat', '0,999,999'], ['-h']]);
git.command('replay', [['--stat-width', '010'], ['-h']]);
git.command('replay', [['--stat-width', dynamic], ['-h']]);

// blame: callback grammar plus the independently measured help phase.
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('blame', [['--stat-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('blame', [['--stat-name-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('blame', [['--stat-graph-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('blame', [['--stat-count', '0x10'], ['-h']]);
git.command('blame', [['-h'], ['--stat', '1,2,3,']]);
git.command('blame', [['--help-all'], ['--stat-width', 'bad']]);
git.command('blame', [['--stat', '0,999,999'], ['-h']]);
git.command('blame', [['--stat-width', '010'], ['-h']]);
git.command('blame', [['--stat-width', dynamic], ['-h']]);

// annotate: callback grammar plus the independently measured help phase.
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('annotate', [['--stat-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('annotate', [['--stat-name-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('annotate', [['--stat-graph-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('annotate', [['--stat-count', '0x10'], ['-h']]);
git.command('annotate', [['-h'], ['--stat', '1,2,3,']]);
git.command('annotate', [['--help-all'], ['--stat-width', 'bad']]);
git.command('annotate', [['--stat', '0,999,999'], ['-h']]);
git.command('annotate', [['--stat-width', '010'], ['-h']]);
git.command('annotate', [['--stat-width', dynamic], ['-h']]);

// format-patch: callback grammar plus the independently measured help phase.
git.command('format-patch', [['--stat-width', '0x10'], ['-h']]);
git.command('format-patch', [['--stat-name-width', '0x10'], ['-h']]);
git.command('format-patch', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('format-patch', [['--stat-count', '0x10'], ['-h']]);
git.command('format-patch', [['-h'], ['--stat', '1,2,3,']]);
git.command('format-patch', [['--help-all'], ['--stat-width', 'bad']]);
git.command('format-patch', [['--stat', '0,999,999'], ['-h']]);
git.command('format-patch', [['--stat-width', '010'], ['-h']]);
git.command('format-patch', [['--stat-width', dynamic], ['-h']]);

// pickaxe: callback grammar plus the independently measured help phase.
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('pickaxe', [['--stat-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('pickaxe', [['--stat-name-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('pickaxe', [['--stat-graph-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('pickaxe', [['--stat-count', '0x10'], ['-h']]);
git.command('pickaxe', [['-h'], ['--stat', '1,2,3,']]);
git.command('pickaxe', [['--help-all'], ['--stat-width', 'bad']]);
git.command('pickaxe', [['--stat', '0,999,999'], ['-h']]);
git.command('pickaxe', [['--stat-width', '010'], ['-h']]);
git.command('pickaxe', [['--stat-width', dynamic], ['-h']]);

// whatchanged: callback grammar plus the independently measured help phase.
git.command('whatchanged', [['--stat-width', '0x10'], ['-h']]);
git.command('whatchanged', [['--stat-name-width', '0x10'], ['-h']]);
git.command('whatchanged', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('whatchanged', [['--stat-count', '0x10'], ['-h']]);
git.command('whatchanged', [['-h'], ['--stat', '1,2,3,']]);
git.command('whatchanged', [['--help-all'], ['--stat-width', 'bad']]);
git.command('whatchanged', [['--stat', '0,999,999'], ['-h']]);
git.command('whatchanged', [['--stat-width', '010'], ['-h']]);
git.command('whatchanged', [['--stat-width', dynamic], ['-h']]);

// shortlog: callback grammar plus the independently measured help phase.
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('shortlog', [['--stat-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('shortlog', [['--stat-name-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('shortlog', [['--stat-graph-width', '0x10'], ['-h']]);
// @ts-expect-error A reached stat scalar consumes decimal text completely.
git.command('shortlog', [['--stat-count', '0x10'], ['-h']]);
git.command('shortlog', [['-h'], ['--stat', '1,2,3,']]);
git.command('shortlog', [['--help-all'], ['--stat-width', 'bad']]);
git.command('shortlog', [['--stat', '0,999,999'], ['-h']]);
git.command('shortlog', [['--stat-width', '010'], ['-h']]);
git.command('shortlog', [['--stat-width', dynamic], ['-h']]);

// fast-export: callback grammar plus the independently measured help phase.
git.command('fast-export', [['--stat-width', '0x10'], ['-h']]);
git.command('fast-export', [['--stat-name-width', '0x10'], ['-h']]);
git.command('fast-export', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('fast-export', [['--stat-count', '0x10'], ['-h']]);
git.command('fast-export', [['-h'], ['--stat', '1,2,3,']]);
git.command('fast-export', [['--help-all'], ['--stat-width', 'bad']]);
git.command('fast-export', [['--stat', '0,999,999'], ['-h']]);
git.command('fast-export', [['--stat-width', '010'], ['-h']]);
git.command('fast-export', [['--stat-width', dynamic], ['-h']]);

// difftool: callback grammar plus the independently measured help phase.
git.command('difftool', [['--stat-width', '0x10'], ['-h']]);
git.command('difftool', [['--stat-name-width', '0x10'], ['-h']]);
git.command('difftool', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('difftool', [['--stat-count', '0x10'], ['-h']]);
git.command('difftool', [['-h'], ['--stat', '1,2,3,']]);
git.command('difftool', [['--help-all'], ['--stat-width', 'bad']]);
git.command('difftool', [['--stat', '0,999,999'], ['-h']]);
git.command('difftool', [['--stat-width', '010'], ['-h']]);
git.command('difftool', [['--stat-width', dynamic], ['-h']]);

// reflog: callback grammar plus the independently measured help phase.
git.command('reflog', [['--stat-width', '0x10'], ['-h']]);
git.command('reflog', [['--stat-name-width', '0x10'], ['-h']]);
git.command('reflog', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('reflog', [['--stat-count', '0x10'], ['-h']]);
git.command('reflog', [['-h'], ['--stat', '1,2,3,']]);
git.command('reflog', [['--help-all'], ['--stat-width', 'bad']]);
git.command('reflog', [['--stat', '0,999,999'], ['-h']]);
git.command('reflog', [['--stat-width', '010'], ['-h']]);
git.command('reflog', [['--stat-width', dynamic], ['-h']]);

// stash list: callback grammar plus the independently measured help phase.
git.command('stash list', [['--stat-width', '0x10'], ['-h']]);
git.command('stash list', [['--stat-name-width', '0x10'], ['-h']]);
git.command('stash list', [['--stat-graph-width', '0x10'], ['-h']]);
git.command('stash list', [['--stat-count', '0x10'], ['-h']]);
git.command('stash list', [['-h'], ['--stat', '1,2,3,']]);
git.command('stash list', [['--help-all'], ['--stat-width', 'bad']]);
git.command('stash list', [['--stat', '0,999,999'], ['-h']]);
git.command('stash list', [['--stat-width', '010'], ['-h']]);
git.command('stash list', [['--stat-width', dynamic], ['-h']]);

const statTuple: GitCommandArgument<'diff'> = ['--stat', '1,,2'];
void statTuple;
// Argument aliases describe shape; preserve the literal when validating a call.
const invalidStatTuple = ['--stat', '1,2,3,'] as const satisfies GitCommandArgument<'diff'>;
// @ts-expect-error A preserved compound literal remains invalid at the command API.
git.command('diff', [invalidStatTuple, ['-h']]);
// @ts-expect-error Ignored help tails still reject NUL.
git.command('log', [['-h'], ['--stat-width', '\0']]);
// @ts-expect-error Flag unions cannot discard their rejecting stat alternative.
git.command('diff', [[null as unknown as '--stat-width' | '--src-prefix', 'bad'], ['-h']]);

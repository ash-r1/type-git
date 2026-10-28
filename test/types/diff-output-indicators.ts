import type { Git } from '../../src/index.js';
declare const git: Git;
declare const dynamic: string;
git.command('diff', [['--output-indicator-new', '+'], ['-h']]);
git.command('diff', [['--output-indicator-new', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff', [['--output-indicator-new', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('diff', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('diff', [['--output-indicator-old', '+'], ['-h']]);
git.command('diff', [['--output-indicator-old', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff', [['--output-indicator-old', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('diff', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('diff', [['--output-indicator-context', '+'], ['-h']]);
git.command('diff', [['--output-indicator-context', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff', [['--output-indicator-context', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('diff', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('diff-files', [['--output-indicator-new', '+'], ['-h']]);
git.command('diff-files', [['--output-indicator-new', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff-files', [['--output-indicator-new', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('diff-files', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('diff-files', [['--output-indicator-old', '+'], ['-h']]);
git.command('diff-files', [['--output-indicator-old', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff-files', [['--output-indicator-old', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('diff-files', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('diff-files', [['--output-indicator-context', '+'], ['-h']]);
git.command('diff-files', [['--output-indicator-context', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff-files', [['--output-indicator-context', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('diff-files', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('diff-index', [['--output-indicator-new', '+'], ['-h']]);
git.command('diff-index', [['--output-indicator-new', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff-index', [['--output-indicator-new', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('diff-index', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('diff-index', [['--output-indicator-old', '+'], ['-h']]);
git.command('diff-index', [['--output-indicator-old', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff-index', [['--output-indicator-old', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('diff-index', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('diff-index', [['--output-indicator-context', '+'], ['-h']]);
git.command('diff-index', [['--output-indicator-context', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff-index', [['--output-indicator-context', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('diff-index', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('diff-tree', [['--output-indicator-new', '+'], ['-h']]);
git.command('diff-tree', [['--output-indicator-new', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff-tree', [['--output-indicator-new', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('diff-tree', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('diff-tree', [['--output-indicator-old', '+'], ['-h']]);
git.command('diff-tree', [['--output-indicator-old', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff-tree', [['--output-indicator-old', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('diff-tree', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('diff-tree', [['--output-indicator-context', '+'], ['-h']]);
git.command('diff-tree', [['--output-indicator-context', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff-tree', [['--output-indicator-context', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('diff-tree', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('rev-list', [['--output-indicator-new', '+'], ['-h']]);
git.command('rev-list', [['--output-indicator-new', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('rev-list', [['--output-indicator-new', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('rev-list', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('rev-list', [['--output-indicator-old', '+'], ['-h']]);
git.command('rev-list', [['--output-indicator-old', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('rev-list', [['--output-indicator-old', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('rev-list', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('rev-list', [['--output-indicator-context', '+'], ['-h']]);
git.command('rev-list', [['--output-indicator-context', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('rev-list', [['--output-indicator-context', 'é'], ['-h']]);
// @ts-expect-error Continuing diff callbacks still run after short help.
git.command('rev-list', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('diff --no-index', [['--output-indicator-new', '+'], ['-h']]);
git.command('diff --no-index', [['--output-indicator-new', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff --no-index', [['--output-indicator-new', 'é'], ['-h']]);
git.command('diff --no-index', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('diff --no-index', [['--output-indicator-old', '+'], ['-h']]);
git.command('diff --no-index', [['--output-indicator-old', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff --no-index', [['--output-indicator-old', 'é'], ['-h']]);
git.command('diff --no-index', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('diff --no-index', [['--output-indicator-context', '+'], ['-h']]);
git.command('diff --no-index', [['--output-indicator-context', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff --no-index', [['--output-indicator-context', 'é'], ['-h']]);
git.command('diff --no-index', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('range-diff', [['--output-indicator-new', '+'], ['-h']]);
git.command('range-diff', [['--output-indicator-new', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('range-diff', [['--output-indicator-new', 'é'], ['-h']]);
git.command('range-diff', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('range-diff', [['--output-indicator-old', '+'], ['-h']]);
git.command('range-diff', [['--output-indicator-old', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('range-diff', [['--output-indicator-old', 'é'], ['-h']]);
git.command('range-diff', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('range-diff', [['--output-indicator-context', '+'], ['-h']]);
git.command('range-diff', [['--output-indicator-context', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('range-diff', [['--output-indicator-context', 'é'], ['-h']]);
git.command('range-diff', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('diff-pairs', [['--output-indicator-new', '+'], ['-h']]);
git.command('diff-pairs', [['--output-indicator-new', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff-pairs', [['--output-indicator-new', 'é'], ['-h']]);
git.command('diff-pairs', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('diff-pairs', [['--output-indicator-old', '+'], ['-h']]);
git.command('diff-pairs', [['--output-indicator-old', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff-pairs', [['--output-indicator-old', 'é'], ['-h']]);
git.command('diff-pairs', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('diff-pairs', [['--output-indicator-context', '+'], ['-h']]);
git.command('diff-pairs', [['--output-indicator-context', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('diff-pairs', [['--output-indicator-context', 'é'], ['-h']]);
git.command('diff-pairs', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('blame', [['--output-indicator-new', '+'], ['-h']]);
git.command('blame', [['--output-indicator-new', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('blame', [['--output-indicator-new', 'é'], ['-h']]);
git.command('blame', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('blame', [['--output-indicator-old', '+'], ['-h']]);
git.command('blame', [['--output-indicator-old', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('blame', [['--output-indicator-old', 'é'], ['-h']]);
git.command('blame', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('blame', [['--output-indicator-context', '+'], ['-h']]);
git.command('blame', [['--output-indicator-context', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('blame', [['--output-indicator-context', 'é'], ['-h']]);
git.command('blame', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('annotate', [['--output-indicator-new', '+'], ['-h']]);
git.command('annotate', [['--output-indicator-new', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('annotate', [['--output-indicator-new', 'é'], ['-h']]);
git.command('annotate', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('annotate', [['--output-indicator-old', '+'], ['-h']]);
git.command('annotate', [['--output-indicator-old', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('annotate', [['--output-indicator-old', 'é'], ['-h']]);
git.command('annotate', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('annotate', [['--output-indicator-context', '+'], ['-h']]);
git.command('annotate', [['--output-indicator-context', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('annotate', [['--output-indicator-context', 'é'], ['-h']]);
git.command('annotate', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('pickaxe', [['--output-indicator-new', '+'], ['-h']]);
git.command('pickaxe', [['--output-indicator-new', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('pickaxe', [['--output-indicator-new', 'é'], ['-h']]);
git.command('pickaxe', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('pickaxe', [['--output-indicator-old', '+'], ['-h']]);
git.command('pickaxe', [['--output-indicator-old', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('pickaxe', [['--output-indicator-old', 'é'], ['-h']]);
git.command('pickaxe', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('pickaxe', [['--output-indicator-context', '+'], ['-h']]);
git.command('pickaxe', [['--output-indicator-context', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('pickaxe', [['--output-indicator-context', 'é'], ['-h']]);
git.command('pickaxe', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('shortlog', [['--output-indicator-new', '+'], ['-h']]);
git.command('shortlog', [['--output-indicator-new', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('shortlog', [['--output-indicator-new', 'é'], ['-h']]);
git.command('shortlog', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('shortlog', [['--output-indicator-old', '+'], ['-h']]);
git.command('shortlog', [['--output-indicator-old', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('shortlog', [['--output-indicator-old', 'é'], ['-h']]);
git.command('shortlog', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('shortlog', [['--output-indicator-context', '+'], ['-h']]);
git.command('shortlog', [['--output-indicator-context', dynamic], ['-h']]);
// @ts-expect-error A reached indicator accepts one UTF-8 byte, not one Unicode character.
git.command('shortlog', [['--output-indicator-context', 'é'], ['-h']]);
git.command('shortlog', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('log', [['--output-indicator-new', '+'], ['-h']]);
git.command('log', [['--output-indicator-new', dynamic], ['-h']]);
git.command('log', [['--output-indicator-new', 'é'], ['-h']]);
git.command('log', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('log', [['--output-indicator-old', '+'], ['-h']]);
git.command('log', [['--output-indicator-old', dynamic], ['-h']]);
git.command('log', [['--output-indicator-old', 'é'], ['-h']]);
git.command('log', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('log', [['--output-indicator-context', '+'], ['-h']]);
git.command('log', [['--output-indicator-context', dynamic], ['-h']]);
git.command('log', [['--output-indicator-context', 'é'], ['-h']]);
git.command('log', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('show', [['--output-indicator-new', '+'], ['-h']]);
git.command('show', [['--output-indicator-new', dynamic], ['-h']]);
git.command('show', [['--output-indicator-new', 'é'], ['-h']]);
git.command('show', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('show', [['--output-indicator-old', '+'], ['-h']]);
git.command('show', [['--output-indicator-old', dynamic], ['-h']]);
git.command('show', [['--output-indicator-old', 'é'], ['-h']]);
git.command('show', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('show', [['--output-indicator-context', '+'], ['-h']]);
git.command('show', [['--output-indicator-context', dynamic], ['-h']]);
git.command('show', [['--output-indicator-context', 'é'], ['-h']]);
git.command('show', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('reflog show', [['--output-indicator-new', '+'], ['-h']]);
git.command('reflog show', [['--output-indicator-new', dynamic], ['-h']]);
git.command('reflog show', [['--output-indicator-new', 'é'], ['-h']]);
git.command('reflog show', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('reflog show', [['--output-indicator-old', '+'], ['-h']]);
git.command('reflog show', [['--output-indicator-old', dynamic], ['-h']]);
git.command('reflog show', [['--output-indicator-old', 'é'], ['-h']]);
git.command('reflog show', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('reflog show', [['--output-indicator-context', '+'], ['-h']]);
git.command('reflog show', [['--output-indicator-context', dynamic], ['-h']]);
git.command('reflog show', [['--output-indicator-context', 'é'], ['-h']]);
git.command('reflog show', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('stash show', [['--output-indicator-new', '+'], ['-h']]);
git.command('stash show', [['--output-indicator-new', dynamic], ['-h']]);
git.command('stash show', [['--output-indicator-new', 'é'], ['-h']]);
git.command('stash show', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('stash show', [['--output-indicator-old', '+'], ['-h']]);
git.command('stash show', [['--output-indicator-old', dynamic], ['-h']]);
git.command('stash show', [['--output-indicator-old', 'é'], ['-h']]);
git.command('stash show', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('stash show', [['--output-indicator-context', '+'], ['-h']]);
git.command('stash show', [['--output-indicator-context', dynamic], ['-h']]);
git.command('stash show', [['--output-indicator-context', 'é'], ['-h']]);
git.command('stash show', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('cherry-pick', [['--output-indicator-new', '+'], ['-h']]);
git.command('cherry-pick', [['--output-indicator-new', dynamic], ['-h']]);
git.command('cherry-pick', [['--output-indicator-new', 'é'], ['-h']]);
git.command('cherry-pick', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('cherry-pick', [['--output-indicator-old', '+'], ['-h']]);
git.command('cherry-pick', [['--output-indicator-old', dynamic], ['-h']]);
git.command('cherry-pick', [['--output-indicator-old', 'é'], ['-h']]);
git.command('cherry-pick', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('cherry-pick', [['--output-indicator-context', '+'], ['-h']]);
git.command('cherry-pick', [['--output-indicator-context', dynamic], ['-h']]);
git.command('cherry-pick', [['--output-indicator-context', 'é'], ['-h']]);
git.command('cherry-pick', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('revert', [['--output-indicator-new', '+'], ['-h']]);
git.command('revert', [['--output-indicator-new', dynamic], ['-h']]);
git.command('revert', [['--output-indicator-new', 'é'], ['-h']]);
git.command('revert', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('revert', [['--output-indicator-old', '+'], ['-h']]);
git.command('revert', [['--output-indicator-old', dynamic], ['-h']]);
git.command('revert', [['--output-indicator-old', 'é'], ['-h']]);
git.command('revert', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('revert', [['--output-indicator-context', '+'], ['-h']]);
git.command('revert', [['--output-indicator-context', dynamic], ['-h']]);
git.command('revert', [['--output-indicator-context', 'é'], ['-h']]);
git.command('revert', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('backfill', [['--output-indicator-new', '+'], ['-h']]);
git.command('backfill', [['--output-indicator-new', dynamic], ['-h']]);
git.command('backfill', [['--output-indicator-new', 'é'], ['-h']]);
git.command('backfill', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('backfill', [['--output-indicator-old', '+'], ['-h']]);
git.command('backfill', [['--output-indicator-old', dynamic], ['-h']]);
git.command('backfill', [['--output-indicator-old', 'é'], ['-h']]);
git.command('backfill', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('backfill', [['--output-indicator-context', '+'], ['-h']]);
git.command('backfill', [['--output-indicator-context', dynamic], ['-h']]);
git.command('backfill', [['--output-indicator-context', 'é'], ['-h']]);
git.command('backfill', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('last-modified', [['--output-indicator-new', '+'], ['-h']]);
git.command('last-modified', [['--output-indicator-new', dynamic], ['-h']]);
git.command('last-modified', [['--output-indicator-new', 'é'], ['-h']]);
git.command('last-modified', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('last-modified', [['--output-indicator-old', '+'], ['-h']]);
git.command('last-modified', [['--output-indicator-old', dynamic], ['-h']]);
git.command('last-modified', [['--output-indicator-old', 'é'], ['-h']]);
git.command('last-modified', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('last-modified', [['--output-indicator-context', '+'], ['-h']]);
git.command('last-modified', [['--output-indicator-context', dynamic], ['-h']]);
git.command('last-modified', [['--output-indicator-context', 'é'], ['-h']]);
git.command('last-modified', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('replay', [['--output-indicator-new', '+'], ['-h']]);
git.command('replay', [['--output-indicator-new', dynamic], ['-h']]);
git.command('replay', [['--output-indicator-new', 'é'], ['-h']]);
git.command('replay', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('replay', [['--output-indicator-old', '+'], ['-h']]);
git.command('replay', [['--output-indicator-old', dynamic], ['-h']]);
git.command('replay', [['--output-indicator-old', 'é'], ['-h']]);
git.command('replay', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('replay', [['--output-indicator-context', '+'], ['-h']]);
git.command('replay', [['--output-indicator-context', dynamic], ['-h']]);
git.command('replay', [['--output-indicator-context', 'é'], ['-h']]);
git.command('replay', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('format-patch', [['--output-indicator-new', '+'], ['-h']]);
git.command('format-patch', [['--output-indicator-new', dynamic], ['-h']]);
git.command('format-patch', [['--output-indicator-new', 'é'], ['-h']]);
git.command('format-patch', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('format-patch', [['--output-indicator-old', '+'], ['-h']]);
git.command('format-patch', [['--output-indicator-old', dynamic], ['-h']]);
git.command('format-patch', [['--output-indicator-old', 'é'], ['-h']]);
git.command('format-patch', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('format-patch', [['--output-indicator-context', '+'], ['-h']]);
git.command('format-patch', [['--output-indicator-context', dynamic], ['-h']]);
git.command('format-patch', [['--output-indicator-context', 'é'], ['-h']]);
git.command('format-patch', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('whatchanged', [['--output-indicator-new', '+'], ['-h']]);
git.command('whatchanged', [['--output-indicator-new', dynamic], ['-h']]);
git.command('whatchanged', [['--output-indicator-new', 'é'], ['-h']]);
git.command('whatchanged', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('whatchanged', [['--output-indicator-old', '+'], ['-h']]);
git.command('whatchanged', [['--output-indicator-old', dynamic], ['-h']]);
git.command('whatchanged', [['--output-indicator-old', 'é'], ['-h']]);
git.command('whatchanged', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('whatchanged', [['--output-indicator-context', '+'], ['-h']]);
git.command('whatchanged', [['--output-indicator-context', dynamic], ['-h']]);
git.command('whatchanged', [['--output-indicator-context', 'é'], ['-h']]);
git.command('whatchanged', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('fast-export', [['--output-indicator-new', '+'], ['-h']]);
git.command('fast-export', [['--output-indicator-new', dynamic], ['-h']]);
git.command('fast-export', [['--output-indicator-new', 'é'], ['-h']]);
git.command('fast-export', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('fast-export', [['--output-indicator-old', '+'], ['-h']]);
git.command('fast-export', [['--output-indicator-old', dynamic], ['-h']]);
git.command('fast-export', [['--output-indicator-old', 'é'], ['-h']]);
git.command('fast-export', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('fast-export', [['--output-indicator-context', '+'], ['-h']]);
git.command('fast-export', [['--output-indicator-context', dynamic], ['-h']]);
git.command('fast-export', [['--output-indicator-context', 'é'], ['-h']]);
git.command('fast-export', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('difftool', [['--output-indicator-new', '+'], ['-h']]);
git.command('difftool', [['--output-indicator-new', dynamic], ['-h']]);
git.command('difftool', [['--output-indicator-new', 'é'], ['-h']]);
git.command('difftool', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('difftool', [['--output-indicator-old', '+'], ['-h']]);
git.command('difftool', [['--output-indicator-old', dynamic], ['-h']]);
git.command('difftool', [['--output-indicator-old', 'é'], ['-h']]);
git.command('difftool', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('difftool', [['--output-indicator-context', '+'], ['-h']]);
git.command('difftool', [['--output-indicator-context', dynamic], ['-h']]);
git.command('difftool', [['--output-indicator-context', 'é'], ['-h']]);
git.command('difftool', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('reflog', [['--output-indicator-new', '+'], ['-h']]);
git.command('reflog', [['--output-indicator-new', dynamic], ['-h']]);
git.command('reflog', [['--output-indicator-new', 'é'], ['-h']]);
git.command('reflog', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('reflog', [['--output-indicator-old', '+'], ['-h']]);
git.command('reflog', [['--output-indicator-old', dynamic], ['-h']]);
git.command('reflog', [['--output-indicator-old', 'é'], ['-h']]);
git.command('reflog', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('reflog', [['--output-indicator-context', '+'], ['-h']]);
git.command('reflog', [['--output-indicator-context', dynamic], ['-h']]);
git.command('reflog', [['--output-indicator-context', 'é'], ['-h']]);
git.command('reflog', [['-h'], ['--output-indicator-context', 'ab']]);
git.command('stash list', [['--output-indicator-new', '+'], ['-h']]);
git.command('stash list', [['--output-indicator-new', dynamic], ['-h']]);
git.command('stash list', [['--output-indicator-new', 'é'], ['-h']]);
git.command('stash list', [['-h'], ['--output-indicator-new', 'ab']]);
git.command('stash list', [['--output-indicator-old', '+'], ['-h']]);
git.command('stash list', [['--output-indicator-old', dynamic], ['-h']]);
git.command('stash list', [['--output-indicator-old', 'é'], ['-h']]);
git.command('stash list', [['-h'], ['--output-indicator-old', 'ab']]);
git.command('stash list', [['--output-indicator-context', '+'], ['-h']]);
git.command('stash list', [['--output-indicator-context', dynamic], ['-h']]);
git.command('stash list', [['--output-indicator-context', 'é'], ['-h']]);
git.command('stash list', [['-h'], ['--output-indicator-context', 'ab']]);
declare const mixed: '+' | 'é';
// @ts-expect-error Known invalid alternatives must survive union validation.
git.command('diff', [['--output-indicator-new', mixed]]);
git.command('diff', [['--output-indicator-new', '']]);
// @ts-expect-error A long concrete literal must not become a dynamic escape hatch.
git.command('diff', [['--output-indicator-new', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']]);
// @ts-expect-error A long concrete literal must not become a dynamic escape hatch.
git.command('diff', [['--output-indicator-old', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']]);
// @ts-expect-error A long concrete literal must not become a dynamic escape hatch.
git.command('diff', [['--output-indicator-context', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']]);

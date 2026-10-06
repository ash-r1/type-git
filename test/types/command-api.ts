import type { Git } from '../../src/core/git.js';
import type { GitCommandArgument } from '../../src/commands/types.js';
declare const git: Git;
git.command('lfs version', []);
git.command('lfs pointer', [['--file', 'file.bin']]);
git.command('lfs pointer', [['--check'], ['--stdin']], { stdin: 'pointer' });
git.command('lfs checkout', [['--ours'], ['--to', 'out'], { operand: 'file' }]);
git.command('lfs checkout', [['--ours'], ['--ours', false]]);
git.command('lfs checkout', [['--ours'], ['--ours', false], ['--theirs'], ['--to', 'out'], { operand: 'file' }]);
git.command('lfs migrate info', [['--pointers', 'ignored earlier'], ['--pointers', 'ignore']]);
git.command('lfs status', [['--porcelain']]);
git.command('lfs checkout', [['--ours'], ['--theirs'], ['--help']]);
// @ts-expect-error unknown command name
git.command('lfs unknown-command', []);
// @ts-expect-error unknown option
git.command('lfs checkout', [['--include', '*.bin']]);
// @ts-expect-error missing value
git.command('lfs pointer', [['--file']]);
// @ts-expect-error numeric option requires a number
git.command('lfs locks', [['--limit', 'one']]);
// @ts-expect-error conflict stages cannot both be selected
git.command('lfs checkout', [['--ours'], ['--theirs'], ['--to', 'out'], { operand: 'file' }]);
// @ts-expect-error conflict stage requires a destination
git.command('lfs checkout', [['--ours']]);
// @ts-expect-error destination requires a stage
git.command('lfs checkout', [['--to', 'out']]);
// @ts-expect-error check cannot take pointer comparison input
git.command('lfs pointer', [['--check'], ['--pointer', 'pointer']]);
// @ts-expect-error prune verification modes conflict
git.command('lfs prune', [['--verify-remote'], ['--no-verify-remote']]);
// @ts-expect-error fetch json and prune conflict
git.command('lfs fetch', [['--json'], ['--prune']]);
// @ts-expect-error config scopes are exclusive
git.command('lfs install', [['--local'], ['--system']]);
// @ts-expect-error unknown behavior
git.command('lfs prune', [['--when-unverified', 'ignore']]);
export const dynamic: GitCommandArgument<'lfs pointer'>[] = [['--file', 'file.bin']];
git.command('lfs pointer', dynamic);

// @ts-expect-error conflict checkout needs exactly one operand
git.command('lfs checkout', [['--ours'], ['--to', 'out']]);
// @ts-expect-error conflict checkout cannot take multiple operands
git.command('lfs checkout', [['--ours'], ['--to', 'out'], { operand: 'a' }, { operand: 'b' }]);
// @ts-expect-error post-checkout hook requires three operands
git.command('lfs post-checkout', [{ operand: 'old' }, { operand: 'new' }]);
git.command('lfs post-checkout', [{ operand: 'old' }, { operand: 'new' }, { operand: '1' }]);
// @ts-expect-error stdin fetch does not take command-line refs after the remote
git.command('lfs fetch', [['--stdin'], { operand: 'origin' }, { operand: 'main' }]);
// @ts-expect-error ordinary push requires a ref without --all or --stdin
git.command('lfs push', [{ operand: 'origin' }]);
git.command('lfs push', [['--all'], { operand: 'origin' }]);
git.command('lfs push', [['--stdin'], { operand: 'origin' }]);
// @ts-expect-error unknown completion shell
git.command('lfs completion', [{ operand: 'powershell' }]);
git.command('lfs completion', [{ operand: 'bash' }]);

// Native parse-options flags use explicit negated spellings, never --flag=false.
git.command('hash-object', []);
git.command('hash-object', [['--stdin']], { stdin: 'hello' });
git.command('hash-object', [['--stdin'], ['--no-stdin'], ['--stdin']]);
git.command('hash-object', [['--path', 'file'], ['--no-path'], ['--no-filters']]);
git.command('hash-object', [['--no-filters'], ['--filters'], ['--path', 'file']]);
// @ts-expect-error Git rejects repeated stdin object requests.
git.command('hash-object', [['--stdin'], ['--stdin']]);
// @ts-expect-error Stdin paths and explicit files cannot be combined.
git.command('hash-object', [['--stdin-paths'], { operand: 'file' }]);
// @ts-expect-error Attribute paths require filters.
git.command('hash-object', [['--path', 'file'], ['--no-filters']]);
// @ts-expect-error Native Git flags do not accept Cobra boolean values.
git.command('hash-object', [['--stdin', false]]);
// @ts-expect-error Options cannot follow an explicit end-of-options marker.
git.command('hash-object', [['--'], ['--stdin']]);

git.command('remote add', [['--mirror'], { operand: 'origin' }, { operand: '.' }]);
git.command('remote add', [['--mirror', 'push'], ['--track', ''], ['--no-track'], { operand: 'origin' }, { operand: '.' }]);
git.command('remote show', [['-v'], ['-n'], { operand: 'origin' }]);
git.command('remote set-head', [['--auto'], { operand: 'origin' }]);
git.command('add', [['--all'], ['--ignore-removal'], ['--update']]);
git.command('add', [['--interactive'], ['--chmod', 'ignored']]);
git.command('add', [['--unified', -1]]);
git.command('rm', [['--pathspec-from-file', '-']], { stdin: 'file' });
git.command('mv', [{ operand: 'old' }, { operand: 'new' }]);
// @ts-expect-error Two operands are required.
git.command('remote add', [{ operand: 'origin' }]);
// @ts-expect-error An empty track value is still an entry for native Git.
git.command('remote add', [['--mirror', 'push'], ['--track', ''], { operand: 'origin' }, { operand: '.' }]);
// @ts-expect-error Automatic and explicit remote head modes differ in arity.
git.command('remote set-head', [['--auto'], { operand: 'origin' }, { operand: 'main' }]);
// @ts-expect-error Independent all and update flags conflict in noninteractive mode.
git.command('add', [['--all'], ['--update']]);
// @ts-expect-error An executable mode is validated outside interactive mode.
git.command('add', [['--chmod', 'invalid']]);
// @ts-expect-error A pathspec file replaces explicit paths.
git.command('rm', [['--pathspec-from-file', '-'], { operand: 'file' }]);
// @ts-expect-error Missing destination.
git.command('mv', [{ operand: 'old' }]);
// @ts-expect-error Ignored-only and all-untracked modes conflict.
git.command('clean', [['-x'], ['-X']]);

git.command('status', [['--long'], ['--short'], ['-z']]);
git.command('status', [['--porcelain', 'v2'], ['-u']]);
git.command('commit', [['--file', ''], ['-m', 'message'], ['--allow-empty']]);
git.command('commit', [['--fixup', 'HEAD'], ['-m', 'extra']]);
git.command('clone', [['--filter', 'blob:none'], ['--recurse-submodules'], ['--also-filter-submodules'], { operand: '.' }]);
git.command('clone', [['--mirror'], ['--no-mirror'], ['--separate-git-dir', 'gitdir'], { operand: '.' }]);
git.command('worktree list', [['--porcelain'], ['-z']]);
git.command('worktree list', [['--verbose'], ['--no-verbose'], ['--porcelain']]);
git.command('worktree add', [['--orphan'], ['-b', 'empty'], { operand: 'dir' }]);
// @ts-expect-error Last output mode is long, incompatible with NUL.
git.command('status', [['--short'], ['--long'], ['-z']]);
// @ts-expect-error Porcelain callback rejects bad values immediately, even when overwritten.
git.command('status', [['--porcelain', 'invalid'], ['--porcelain', '2']]);
// @ts-expect-error Matching ignored files needs untracked output.
git.command('status', [['--ignored', 'matching'], ['--untracked-files', 'no']]);
// @ts-expect-error Empty -m still counts as a literal message.
git.command('commit', [['--fixup', 'amend:HEAD'], ['-m', '']]);
// @ts-expect-error Reword fixup forbids content selection.
git.command('commit', [['--fixup', 'reword:HEAD'], ['--only']]);
// @ts-expect-error Explicit revision cannot be combined with a selected branch.
git.command('clone', [['--revision', 'HEAD'], ['--branch', 'main'], { operand: '.' }]);
// @ts-expect-error Bundle URI and shallow history options conflict.
git.command('clone', [['--bundle-uri', 'file'], ['--depth', '1'], { operand: '.' }]);
// @ts-expect-error Orphan worktree also rejects explicitly disabled tracking.
git.command('worktree add', [['--orphan'], ['--no-track'], { operand: 'dir' }]);
// @ts-expect-error Verbose porcelain is rejected by Git.
git.command('worktree list', [['--porcelain'], ['--verbose']]);

git.command('fetch', [['--porcelain'], ['--recurse-submodules', 'no']]);
git.command('fetch', [['--negotiate-only'], ['--recurse-submodules', 'OFF']]);
git.command('fetch', [['--multiple'], { operand: 'origin' }, { operand: 'backup' }]);
git.command('push', [['--branches'], ['--no-all'], ['--tags']]);
git.command('clone', [['--filter', 'blob:none'], ['--recursive', ''], ['--also-filter-submodules'], { operand: '.' }]);
// @ts-expect-error Explicit recursive fetch is incompatible with porcelain.
git.command('fetch', [['--porcelain'], ['--recurse-submodules']]);
// @ts-expect-error Negotiate only cannot recurse on demand.
git.command('fetch', [['--negotiate-only'], ['--recurse-submodules', 'on-demand']]);
// @ts-expect-error All repositories mode cannot include a positional remote.
git.command('fetch', [['--all'], { operand: 'origin' }]);
// @ts-expect-error Delete requires both positional remote and refs, even with --repo.
git.command('push', [['--delete'], ['--repo', 'origin'], { operand: 'branch' }]);
// @ts-expect-error Branches is an alias for all and conflicts with tags.
git.command('push', [['--branches'], ['--tags']]);
// @ts-expect-error Negating recursion clears all previously accumulated pathspecs.
git.command('clone', [['--recursive'], ['--no-recursive'], ['--filter', 'blob:none'], ['--also-filter-submodules'], { operand: '.' }]);

// Branch bit flags accumulate inside each action group; the groups are exclusive.
git.command('branch', [['-d'], ['-D'], { operand: 'old' }]);
git.command('branch', [['-d'], ['--no-delete'], ['--list']]);
git.command('branch', [['--show-current'], { operand: 'ignored' }, { operand: 'also-ignored' }]);
git.command('branch', [['-a'], ['-r'], ['-D'], { operand: 'origin/old' }]);
// @ts-expect-error -D retains its own bit even after --no-delete.
git.command('branch', [['-D'], ['--no-delete'], ['--list']]);
// @ts-expect-error Filters implicitly select list mode.
git.command('branch', [['--contains', 'HEAD'], ['--no-list'], ['-D'], { operand: 'old' }]);
// @ts-expect-error Copy and rename are separate actions.
git.command('branch', [['-M'], ['-C'], { operand: 'new' }]);
// @ts-expect-error Combined scope cannot delete branches.
git.command('branch', [['-r'], ['-a'], ['-D'], { operand: 'old' }]);
// @ts-expect-error Tracking callback rejects invalid values even if overwritten.
git.command('branch', [['--track', 'bad'], ['--track', 'direct'], { operand: 'new' }]);
git.command('switch', [['--create', 'new']]);
git.command('switch', [['--detach']]);
git.command('switch', [['--conflict', 'diff3'], ['--no-conflict'], ['--force'], { operand: 'main' }]);
// @ts-expect-error Conflict enables merge, which conflicts with discard-changes.
git.command('switch', [['--discard-changes'], ['--conflict', 'diff3'], { operand: 'main' }]);
// @ts-expect-error --no-conflict does not cancel explicitly requested --merge.
git.command('switch', [['--merge'], ['--conflict', 'diff3'], ['--no-conflict'], ['--force'], { operand: 'main' }]);
// @ts-expect-error Orphan switch rejects a start point.
git.command('switch', [['--orphan', 'empty'], { operand: 'HEAD' }]);
// @ts-expect-error Orphan also rejects --no-track.
git.command('switch', [['--orphan', 'empty'], ['--no-track']]);
git.command('restore', [['--ours'], ['--theirs'], { operand: 'file' }]);
git.command('restore', [['--staged'], ['--worktree'], { operand: 'file' }]);
git.command('restore', [['--no-staged'], ['--worktree'], { operand: 'file' }]);
// @ts-expect-error Explicit no-staged suppresses the implicit worktree destination.
git.command('restore', [['--no-staged'], { operand: 'file' }]);
// @ts-expect-error Stage selection cannot restore from a tree.
git.command('restore', [['--source', 'HEAD'], ['--ours'], { operand: 'file' }]);
// @ts-expect-error Conflict callback reenables a previously disabled merge.
git.command('restore', [['--no-merge'], ['--conflict', 'diff3'], ['--staged'], { operand: 'file' }]);
// @ts-expect-error Explicit overlay is incompatible with patch mode.
git.command('checkout', [['--patch'], ['--overlay'], { operand: 'file' }]);
git.command('checkout', [['--patch'], ['--no-overlay'], { operand: 'file' }]);

git.command('reset', [['--hard'], ['--mixed'], ['--intent-to-add'], ['--'], { operand: 'file' }]);
// @ts-expect-error Last reset mode is hard and cannot update explicit paths.
git.command('reset', [['--mixed'], ['--hard'], ['--'], { operand: 'file' }]);
// @ts-expect-error Even mixed is an explicit mode, forbidden with patch.
git.command('reset', [['--mixed'], ['--patch']]);
// @ts-expect-error Only one revision precedes --.
git.command('reset', [{ operand: 'HEAD' }, { operand: 'HEAD~1' }, ['--'], { operand: 'file' }]);
// @ts-expect-error Explicit path mode cannot create a branch.
git.command('checkout', [['-b', 'new'], ['--'], { operand: 'file' }]);
git.command('tag', [['--list'], ['--list']]);
git.command('tag', [['--delete'], { operand: 'old' }]);
git.command('tag', [['--list'], ['-n', 2]]);
git.command('tag', [['--file', ''], ['--message', 'message'], { operand: 'tag' }]);
// @ts-expect-error Git CMDMODE rejects a change immediately, even if the first mode is repeated later.
git.command('tag', [['--list'], ['--delete'], ['--list']]);
// @ts-expect-error CMDMODE options do not support negation.
git.command('tag', [['--list'], ['--no-list']]);
// @ts-expect-error Creation options cannot accompany implicit listing.
git.command('tag', [['--contains', 'HEAD'], ['--annotate'], { operand: 'pattern' }]);
git.command('stash push', [['--all'], ['--no-include-untracked'], ['--staged']]);
git.command('stash save', [{ operand: 'multiple' }, { operand: 'message' }, { operand: 'words' }]);
git.command('stash export', [['--print']]);
// @ts-expect-error Export requires exactly one output mode.
git.command('stash export', []);
// @ts-expect-error Export output modes conflict.
git.command('stash export', [['--print'], ['--to-ref', 'refs/stashes/export']]);
// @ts-expect-error Last untracked mode is enabled and conflicts with staged.
git.command('stash push', [['--no-include-untracked'], ['--all'], ['--staged']]);
// @ts-expect-error Store requires one commit.
git.command('stash store', []);
// @ts-expect-error Import requires exactly one commit.
git.command('stash import', [{ operand: 'a' }, { operand: 'b' }]);

git.command('config set', [{ operand: 'test.value' }, { operand: '--literal' }]);
git.command('config get', [['--type', 'int'], ['--int'], { operand: 'test.value' }]);
git.command('config get', [['--int'], ['--no-type'], ['--bool'], { operand: 'test.value' }]);
// @ts-expect-error Type callbacks reject an immediate change between nonempty types.
git.command('config get', [['--int'], ['--bool'], ['--int'], { operand: 'test.value' }]);
// @ts-expect-error Options are not parsed after the first config operand.
git.command('config get', [{ operand: 'test.value' }, ['--all']]);
// @ts-expect-error A separator after an operand would be another config value.
git.command('config set', [{ operand: 'test.value' }, ['--'], { operand: 'text' }]);
// @ts-expect-error Explicit sources are mutually exclusive.
git.command('config list', [['--global'], ['--local']]);
// @ts-expect-error Empty patterns are still specified patterns.
git.command('config set', [['--append'], ['--value', ''], { operand: 'test.value' }, { operand: 'x' }]);
// @ts-expect-error Fixed-value matching requires a pattern.
git.command('config unset', [['--fixed-value'], { operand: 'test.value' }]);
git.command('notes add', [['--ref', 'custom'], ['-m', 'one'], ['-F', 'file']]);
git.command('notes copy', [{ operand: 'HEAD~1' }]);
git.command('notes remove', [['--stdin'], { operand: 'HEAD' }], { stdin: 'HEAD~1\n' });
// @ts-expect-error Copy reads all objects from stdin when selected.
git.command('notes copy', [['--stdin'], { operand: 'HEAD' }]);
// @ts-expect-error Explicit strategy selects merge, not continuation.
git.command('notes merge', [['--commit'], ['--strategy', 'ours']]);
// @ts-expect-error Merge needs one ref in normal mode.
git.command('notes merge', []);
git.command('stash create', [{ operand: '--help' }, { operand: '--' }]);
// @ts-expect-error Stash create does not parse options or a separator.
git.command('stash create', [['--']]);

git.command('log', [['--default', 'HEAD'], ['--format', '%s']]);
git.command('log', [['--graph'], ['--reverse'], ['--reverse']]);
git.command('log', [['--max-count', -1], ['--max-count-oldest', 1]]);
git.command('log', [['--max-count-oldest', 1], ['-n', 2]]);
git.command('log', [['--cherry-pick'], ['--cherry']]);
git.command('diff', [['--name-only'], ['-s']]);
git.command('diff', [['-s'], ['--name-only'], ['-p']]);
git.command('diff', [['-S', 'needle'], ['--pickaxe-regex']]);
git.command('show', [['--combined-all-paths'], ['--dd']]);
git.command('diff-files', []);
git.command('diff-index', [{ operand: 'HEAD' }]);
git.command('diff-tree', [['--stdin'], ['--stdin']], { stdin: '' });
// @ts-expect-error Graph and reverse cannot coexist.
git.command('log', [['--graph'], ['--reverse']]);
// @ts-expect-error Reflog filters require reflog traversal.
git.command('log', [['--grep-reflog', 'pattern']]);
// @ts-expect-error A later reset cannot undo an immediately rejected transition.
git.command('log', [['--max-count-oldest', 1], ['--max-count', 1], ['--max-count-oldest', 1]]);
// @ts-expect-error A preceding finite count rejects entry into oldest mode.
git.command('log', [['--max-count', 1], ['--max-count-oldest', 1]]);
// @ts-expect-error --skip rejects oldest mode even for zero.
git.command('log', [['--max-count-oldest', 1], ['--skip', 0]]);
// @ts-expect-error --cherry sets the mark bit before --cherry-pick checks it.
git.command('log', [['--cherry'], ['--cherry-pick']]);
// @ts-expect-error Revision stdin cannot be requested twice.
git.command('log', [['--stdin'], ['--stdin']]);
// @ts-expect-error Final bitmask contains suppressed output and name-only.
git.command('diff', [['-s'], ['--name-only']]);
// @ts-expect-error Empty pickaxe patterns fail immediately.
git.command('diff', [['-S', ''], ['-S', 'nonempty']]);
// @ts-expect-error Pickaxe kinds conflict.
git.command('diff', [['-S', 'one'], ['-G', 'two']]);
// @ts-expect-error A first-parent merge diff is not combined output.
git.command('show', [['--dd'], ['--combined-all-paths']]);
// @ts-expect-error Negating a filename preserves its previously parsed value.
git.command('commit', [['--file', 'message'], ['--no-file'], ['--message', 'text']]);

git.command('diff --no-index', [{ operand: 'left' }, { operand: 'right' }]);
// @ts-expect-error No-index uses the diff parser without revision traversal flags.
git.command('diff --no-index', [['--graph'], { operand: 'left' }, { operand: 'right' }]);
// @ts-expect-error Two comparison paths are required.
git.command('diff --no-index', [{ operand: 'left' }]);
// @ts-expect-error A -n count also blocks oldest mode unless it is -1.
git.command('log', [['-n', 2], ['--max-count-oldest', 1]]);

git.command('reflog show', [['--grep-reflog', 'pattern']]);
git.command('reflog show', [['--reverse'], ['--reverse']]);
// @ts-expect-error Reflog traversal is already active before the graph option.
git.command('reflog show', [['--graph']]);
// @ts-expect-error Reverse conflicts with the command's implicit reflog traversal.
git.command('reflog show', [['--reverse']]);
git.command('reflog exists', [{ operand: 'HEAD' }, { operand: 'ignored extra' }]);
git.command('reflog expire', [['--single-worktree']]);
git.command('reflog expire', [['--all'], { operand: 'HEAD' }]);
git.command('reflog drop', []);
git.command('reflog drop', [{ operand: 'refs/heads/temporary' }]);
// @ts-expect-error Drop prohibits explicit refs with --all (expire does not).
git.command('reflog drop', [['--all'], { operand: 'HEAD' }]);
// @ts-expect-error A ref is required by exists.
git.command('reflog exists', []);
// @ts-expect-error List takes no operands.
git.command('reflog list', [{ operand: 'HEAD' }]);
git.command('reflog write', [{ operand: 'HEAD' }, { operand: 'old' }, { operand: 'new' }, { operand: 'message' }]);
// @ts-expect-error Write requires four operands.
git.command('reflog write', [{ operand: 'HEAD' }]);
git.command('stash show', [['-S', 'needle'], ['-n', 1], ['-p']]);
// @ts-expect-error Non-dash --default values become stash operands before revision parsing.
git.command('stash show', [['--default', 'HEAD']]);
// @ts-expect-error Only one stash operand is accepted.
git.command('stash show', [{ operand: 'one' }, { operand: 'two' }]);

git.command('log', [['--filter', 'blob:none'], ['--objects']]);
git.command('log', [['--filter', 'blob:none'], ['--no-filter']]);
// @ts-expect-error Active object filters require object enumeration.
git.command('log', [['--filter', 'blob:none']]);
git.command('diff', [['-s'], ['--name-only'], ['--dirstat']]);

git.command('merge', [['--quit']]);
git.command('merge', [['--no-ff'], ['--ff-only'], ['--squash'], { operand: 'HEAD' }]);
git.command('merge', [['--squash'], ['--commit'], ['--no-commit'], { operand: 'HEAD' }]);
git.command('merge', [['--cleanup', 'bad'], ['--cleanup', 'strip'], { operand: 'HEAD' }]);
// @ts-expect-error A merge continuation must be the only argument, even when repeated.
git.command('merge', [['--quit'], ['--quit']]);
// @ts-expect-error A separator also counts as an extra argument.
git.command('merge', [['--quit'], ['--']]);
// @ts-expect-error Squash cannot use a final no-ff request.
git.command('merge', [['--squash'], ['--no-ff'], { operand: 'HEAD' }]);
// @ts-expect-error Cleanup validates its final value.
git.command('merge', [['--cleanup', 'bad'], { operand: 'HEAD' }]);
git.command('rebase', [['--empty', 'AsK'], { operand: 'HEAD' }]);
git.command('rebase', [['--empty', 'KEEP'], { operand: 'HEAD' }]);
git.command('rebase', [['--interactive'], ['--merge'], { operand: 'HEAD' }]);
git.command('rebase', [['--apply'], ['--keep-base'], ['--no-reapply-cherry-picks'], { operand: 'HEAD' }]);
git.command('rebase', [['--reschedule-failed-exec'], { operand: 'HEAD' }]);
git.command('rebase', [['-C', '2'], ['--ignore-whitespace'], ['--apply'], { operand: 'HEAD' }]);
// @ts-expect-error Backend conflicts fail immediately, before a later flag can restore the first backend.
git.command('rebase', [['--apply'], ['--merge'], ['--apply'], { operand: 'HEAD' }]);
// @ts-expect-error Both forms of keep-empty imply merge immediately.
git.command('rebase', [['--no-keep-empty'], ['--apply'], { operand: 'HEAD' }]);
// @ts-expect-error Reapply-cherry-picks negation still implies merge without keep-base.
git.command('rebase', [['--apply'], ['--no-reapply-cherry-picks'], { operand: 'HEAD' }]);
// @ts-expect-error Root has no separate upstream operand.
git.command('rebase', [['--root'], { operand: 'one' }, { operand: 'two' }]);
// @ts-expect-error Implicit whitespace strategy is selected before queued apply arguments.
git.command('rebase', [['-C', '2'], ['--ignore-whitespace'], { operand: 'HEAD' }]);
// @ts-expect-error ASCII case folding does not accept arbitrary enum words.
git.command('rebase', [['--empty', 'invalid'], { operand: 'HEAD' }]);
// @ts-expect-error Unicode lookalikes are not ASCII enum variants.
git.command('rebase', [['--empty', 'ASK'], { operand: 'HEAD' }]);
git.command('cherry-pick', [['--quit'], ['--quit'], ['--edit']]);
git.command('cherry-pick', [['--quit'], ['--strategy', 'unused']]);
git.command('cherry-pick', [['--quit'], ['-S']]);
git.command('cherry-pick', [['--mainline', 4294967297], ['--no-mainline'], ['--quit']]);
git.command('revert', [['--quit'], ['--strategy-option', ''], ['--no-strategy-option']]);
git.command('revert', [['--reference'], { operand: 'HEAD' }]);
// @ts-expect-error The same C identifier denotes different extra-option tables; reference is revert-only.
git.command('cherry-pick', [['--reference'], { operand: 'HEAD' }]);
// @ts-expect-error Fast-forward replay is cherry-pick-only.
git.command('revert', [['--ff'], { operand: 'HEAD' }]);
// @ts-expect-error Cherry-pick empty enum is case-sensitive, unlike rebase.
git.command('cherry-pick', [['--empty', 'KEEP'], { operand: 'HEAD' }]);
// @ts-expect-error Empty string-list entries still activate strategy options.
git.command('cherry-pick', [['--quit'], ['--strategy-option', '']]);
// @ts-expect-error Continuation rejects leftover revision options.
git.command('cherry-pick', [['--quit'], ['--max-count', 1]]);
// @ts-expect-error A revision argument or revision parser option is required.
git.command('cherry-pick', []);
// @ts-expect-error Fast-forward replay cannot request editing.
git.command('cherry-pick', [['--ff'], ['--edit'], { operand: 'HEAD' }]);
git.command('merge-base', [['--independent']]);
git.command('merge-base', [['--all'], ['--fork-point'], { operand: 'HEAD' }]);
// @ts-expect-error Ancestor testing needs exactly two commits.
git.command('merge-base', [['--is-ancestor'], { operand: 'a' }, { operand: 'b' }, { operand: 'c' }]);
// @ts-expect-error All and independent modes conflict.
git.command('merge-base', [['--all'], ['--independent'], { operand: 'HEAD' }]);
git.command('commit-tree', [['-m', 'first'], ['-F', 'file'], { operand: 'HEAD^{tree}' }]);
// @ts-expect-error Commit-tree requires one tree.
git.command('commit-tree', []);

git.command('apply', [['--3way'], ['--ours'], ['--theirs']]);
git.command('apply', [['--reject'], ['--3way'], ['--no-reject']]);
git.command('apply', [['--cached'], ['--intent-to-add']]);
// @ts-expect-error Three-way application cannot produce rejects.
git.command('apply', [['--reject'], ['--3way']]);
// @ts-expect-error A resolution variant requires three-way application.
git.command('apply', [['--ours']]);
// @ts-expect-error Callback rejects invalid values even if later overwritten.
git.command('apply', [['--whitespace', 'BAD'], ['--whitespace', 'warn']]);
// @ts-expect-error Negated native callback aborts Git 2.55 and is omitted.
git.command('apply', [['--no-directory']]);
git.command('am', [['--continue'], ['--resolved'], ['-r']]);
git.command('am', [['--show-current-patch'], ['--show-current-patch', 'raw']]);
git.command('am', [['--show-current-patch', 'diff'], ['--show-current-patch', 'diff']]);
git.command('am', [['--quit'], ['--whitespace', 'invalid'], { operand: 'ignored-in-stray-state' }]);
// @ts-expect-error Changing the native callback's enum value changes the mode.
git.command('am', [['--show-current-patch', 'raw'], ['--show-current-patch', 'diff']]);
// @ts-expect-error Native mode conflict survives later repetition.
git.command('am', [['--continue'], ['--skip'], ['--continue']]);
// @ts-expect-error Callback and fixed modes share the same native variable.
git.command('am', [['--continue'], ['--show-current-patch']]);
// @ts-expect-error Case-sensitive enum callback.
git.command('am', [['--empty', 'KEEP']]);

git.command('ls-files', [['--format', '%(path)'], ['--unmerged']]);
git.command('ls-files', [['--ignored'], ['--cached'], ['--exclude', '']]);
// @ts-expect-error Explicit stage output conflicts with a custom format.
git.command('ls-files', [['--format', '%(path)'], ['--stage']]);
// @ts-expect-error Ignored output requires an explicit exclude source.
git.command('ls-files', [['--ignored'], ['--cached']]);
git.command('ls-tree', [['--name-only'], ['--name-only'], { operand: 'HEAD' }]);
// @ts-expect-error Different native modes remain exclusive despite equivalent output.
git.command('ls-tree', [['--name-only'], ['--name-status'], { operand: 'HEAD' }]);
git.command('for-each-ref', [['--start-after', 'refs/heads/a'], ['--no-sort'], ['--sort', 'refname']]);
// @ts-expect-error The default sort entry plus an explicit sort conflicts with start-after.
git.command('for-each-ref', [['--start-after', 'refs/heads/a'], ['--sort', 'refname']]);
// @ts-expect-error Only one quoting style can remain active.
git.command('for-each-ref', [['--shell'], ['--python']]);
git.command('check-attr', [['--stdin'], { operand: 'text' }, { operand: 'diff' }]);
git.command('check-attr', [['-z'], { operand: 'text' }, ['--'], { operand: 'tracked' }]);
// @ts-expect-error Without --all, attributes must precede the separator.
git.command('check-attr', [['--'], { operand: 'tracked' }]);
// @ts-expect-error Stdin path mode excludes explicit paths after the separator.
git.command('check-attr', [['--stdin'], { operand: 'text' }, ['--'], { operand: 'tracked' }]);
git.command('check-ignore', [['--stdin'], ['--quiet']]);
// @ts-expect-error NUL input requires stdin for check-ignore (unlike check-attr).
git.command('check-ignore', [['-z'], { operand: 'tracked' }]);
git.command('check-mailmap', [['--stdin'], { operand: 'Test <test@example.com>' }]);
git.command('show-ref', [['--exclude-existing'], { operand: 'ignored' }]);
// @ts-expect-error Exists takes exactly one ref.
git.command('show-ref', [['--exists'], { operand: 'HEAD' }, { operand: 'other' }]);
git.command('symbolic-ref', [{ operand: 'HEAD' }]);
// @ts-expect-error HEAD cannot be deleted.
git.command('symbolic-ref', [['--delete'], { operand: 'HEAD' }]);
git.command('describe', [['--contains'], ['--dirty'], { operand: 'HEAD' }]);
// @ts-expect-error Dirty restricts operands when contains delegation is inactive.
git.command('describe', [['--dirty'], { operand: 'HEAD' }]);
// @ts-expect-error Long describe output requires nonzero abbreviation.
git.command('describe', [['--long'], ['--abbrev', 0]]);
git.command('name-rev', [['--stdin'], ['--no-stdin'], ['--all']]);
// @ts-expect-error Deprecated stdin remains active despite negating annotate-stdin.
git.command('name-rev', [['--stdin'], ['--no-annotate-stdin'], ['--all']]);
git.command('cherry', [{ operand: 'a' }, { operand: 'b' }, { operand: 'c' }, { operand: 'd' }]);
git.command('format-rev', [['--format', '%H'], ['--stdin-mode', 'bad'], ['--stdin-mode', 'revs']]);
// @ts-expect-error Required stdin mode is missing.
git.command('format-rev', [['--format', '%H']]);
git.command('check-ref-format', [['--branch'], { operand: 'topic' }]);
// @ts-expect-error Branch shorthand cannot be combined with another flag.
git.command('check-ref-format', [['--branch'], ['--normalize'], { operand: 'topic' }]);
// @ts-expect-error This manual parser does not recognize --.
git.command('check-ref-format', [['--'], { operand: 'refs/heads/topic' }]);
git.command('write-tree', [{ operand: 'ignored' }]);
git.command('mktree', [{ operand: 'ignored' }]);
git.command('mktag', [{ operand: 'ignored' }]);
git.command('show-index', [{ operand: 'ignored' }]);
git.command('patch-id', [['--stable'], { operand: 'ignored' }]);
git.command('unpack-file', [{ operand: 'HEAD:tracked' }]);
git.command('verify-commit', [{ operand: 'HEAD' }]);
git.command('verify-tag', [{ operand: 'v1' }]);
git.command('verify-pack', [{ operand: 'pack.idx' }]);
git.command('count-objects', [['--verbose']]);
git.command('stripspace', [['--comment-lines']]);
git.command('ls-remote', [['--refs'], { operand: '.' }, { operand: '--literal-pattern' }]);
// @ts-expect-error Options must precede the remote operand.
git.command('ls-remote', [{ operand: '.' }, ['--refs']]);

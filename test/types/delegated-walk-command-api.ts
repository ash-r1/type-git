import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('backfill', []);
git.command('backfill', [['--diff-filter', '']]);
git.command('backfill', [['--follow'], ['--no-follow']]);
// @ts-expect-error Backfill rejects even explicit disabling of merge diffs.
git.command('backfill', [['--no-diff-merges']]);
// @ts-expect-error Empty filters do not clear prior filters.
git.command('backfill', [['--diff-filter', 'A'], ['--diff-filter', '']]);
// @ts-expect-error Backfill rejects pickaxe traversal.
git.command('backfill', [['-S', 'pattern']]);
git.command('last-modified', [['-r'], ['-t'], ['-z']]);
git.command('last-modified', [['--combined-all-paths']]);
// @ts-expect-error Last-modified initializes boundary traversal.
git.command('last-modified', [['--maximal-only']]);
git.command('diff-pairs', [['-z']]);
// @ts-expect-error The protocol requires -z.
git.command('diff-pairs', []);
// @ts-expect-error Revision operands are unsupported.
git.command('diff-pairs', [['-z'], { operand: 'HEAD' }]);
// @ts-expect-error Native range-diff rejects simultaneous side selectors.
git.command('range-diff', [['--left-only'], ['--right-only'], { operand: 'HEAD...HEAD' }]);
git.command('range-diff', [{ operand: 'main' }, { operand: 'topic' }, { operand: 'other' }, { operand: 'path' }]);
// @ts-expect-error A revision specification is required before the separator.
git.command('range-diff', [['--'], { operand: 'path' }]);
git.command('replay', [['--onto', 'main'], ['--ref-action', 'print'], { operand: 'main..topic' }]);
git.command('replay', [['--onto', 'main'], ['--ref-action', 'bad'], ['--ref-action', 'print'], { operand: 'main..topic' }]);
// @ts-expect-error One target mode is required.
git.command('replay', [{ operand: 'main..topic' }]);
// @ts-expect-error Target modes conflict, even when a string is empty.
git.command('replay', [['--onto', ''], ['--advance', 'main'], { operand: 'main..topic' }]);
// @ts-expect-error Contained replay conflicts with a named output ref.
git.command('replay', [['--onto', 'main'], ['--contained'], ['--ref', 'refs/heads/out'], { operand: 'main..topic' }]);
// @ts-expect-error No implicit HEAD source exists for replay.
git.command('replay', [['--onto', 'main']]);

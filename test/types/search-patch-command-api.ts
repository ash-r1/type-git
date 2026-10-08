import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('blame', [{ operand: 'tracked' }]);
git.command('annotate', [['--'], { operand: 'tracked' }, { operand: 'HEAD' }]);
git.command('blame', [['--line-porcelain'], ['--no-porcelain'], ['--progress'], { operand: 'tracked' }]);
// @ts-expect-error Explicit progress conflicts with porcelain output.
git.command('blame', [['--porcelain'], ['--progress'], { operand: 'tracked' }]);
// @ts-expect-error The legacy two-word form after -- cannot have earlier operands.
git.command('blame', [{ operand: 'HEAD' }, ['--'], { operand: 'tracked' }, { operand: 'HEAD' }]);
git.command('grep', [['-12'], { operand: 'pattern' }]);
git.command('grep', [['-001'], { operand: 'pattern' }]);
// @ts-expect-error Numeric shorthand consists of decimal digits only.
git.command('grep', [['-1.5'], { operand: 'pattern' }]);
// @ts-expect-error Numeric shorthand is scoped to native number callbacks.
git.command('archive', [['-12', 1], ['--list']]);
// @ts-expect-error Grep requires a pattern.
git.command('grep', []);
// @ts-expect-error Explicit exclude-standard requires untracked input.
git.command('grep', [['--no-exclude-standard'], { operand: 'pattern' }]);
git.command('grep', [['--max-count', 0], ['--cached'], ['--untracked'], { operand: 'pattern' }]);
// @ts-expect-error Nonzero-limit grep rejects multiple source modes.
git.command('grep', [['--cached'], ['--untracked'], { operand: 'pattern' }]);
git.command('format-patch', [['-n'], ['-N'], ['-k'], ['--stdout']]);
// @ts-expect-error Explicit numbered subjects conflict with keeping subjects.
git.command('format-patch', [['-n'], ['-k'], ['--stdout']]);
// @ts-expect-error Callback rejects the second output directory immediately.
git.command('format-patch', [['-o', 'out'], ['-o', 'out']]);
// @ts-expect-error Thread style callback is case sensitive.
git.command('format-patch', [['--thread', 'DEEP']]);
git.command('archive', [['-123'], ['--list']]);
git.command('archive', [['--list'], ['--exec', 'ignored']]);
// @ts-expect-error Listing does not accept a tree.
git.command('archive', [['--list'], { operand: 'HEAD' }]);
// @ts-expect-error Archive creation requires a tree.
git.command('archive', []);

// Native help exits the first format-patch pass before final subject/cover rules.
git.command('format-patch', [['-n'], ['-k'], ['-h']]);
git.command('format-patch', [['--cover-from-description', 'invalid'], ['-h']]);
git.command('format-patch', [['--color', 'invalid'], ['-h']]);
git.command('format-patch', [['-h'], ['--thread', 'invalid']]);
git.command('format-patch', [['-G', '-n'], { operand: 'x' }, ['--stdout']]);
// @ts-expect-error The thread callback fails before reaching later help.
git.command('format-patch', [['--thread', 'invalid'], ['-h']]);
// @ts-expect-error Earlier directory callbacks reject repetition before help.
git.command('format-patch', [['-o', 'out'], ['-o', 'out'], ['-h']]);

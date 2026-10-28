import type { Git } from '../../src/index.js';
declare const git: Git;
declare const dynamic: string;
git.command('diff', [['--diff-filter', ''], ['-h']]);
git.command('diff', [['--diff-filter', 'ACDMRTUXBacdmrtuxb*'], ['-h']]);
git.command('diff', [['--diff-filter', 'bad'], ['-h']]);
git.command('diff', [['--diff-filter', 'AAaa**'], ['-h']]);
git.command('diff', [['--diff-filter', dynamic]]);
// @ts-expect-error Unknown change classes are rejected when reached.
git.command('diff', [['--diff-filter', 'Z'], ['-h']]);
// @ts-expect-error Full diff help continues through later callbacks.
git.command('diff', [['-h'], ['--diff-filter', 'Z']]);
// @ts-expect-error Unknown lowercase change classes do not become valid through folding.
git.command('diff', [['--diff-filter', 's']]);
// @ts-expect-error Decimal digits are not change classes.
git.command('diff', [['--diff-filter', '0']]);
// @ts-expect-error Leading spaces are not separators.
git.command('diff', [['--diff-filter', ' A']]);
// @ts-expect-error Trailing newlines are not ignored.
git.command('diff', [['--diff-filter', 'A\n']]);
// @ts-expect-error Non-ASCII text is not a change class.
git.command('diff', [['--diff-filter', 'é']]);
// @ts-expect-error A reached callback error survives a later valid occurrence.
git.command('diff', [['--diff-filter', 'Z'], ['--diff-filter', 'A']]);
// @ts-expect-error Blame reaches the callback before its internal help.
git.command('blame', [['--diff-filter', 'Z'], ['-h']]);
git.command('blame', [['-h'], ['--diff-filter', 'Z']]);
// @ts-expect-error Shortlog reaches the callback before its internal help.
git.command('shortlog', [['--diff-filter', 'Z'], ['-h']]);
git.command('shortlog', [['-h'], ['--diff-filter', 'Z']]);
git.command('log', [['--diff-filter', 'Z'], ['-h']]);
git.command('difftool', [['--diff-filter', 'Z'], ['--tool-help']]);
// @ts-expect-error Clearing tool-help restores the delegated diff callback.
git.command('difftool', [['--diff-filter', 'Z'], ['--tool-help'], ['--no-tool-help']]);
declare const possibleClass: 'A' | 'Z';
// @ts-expect-error Every supplied literal alternative must be valid.
git.command('diff', [['--diff-filter', possibleClass]]);
// @ts-expect-error Required string values cannot be booleans.
git.command('diff', [['--diff-filter', true]]);
// @ts-expect-error A known forbidden ASCII suffix remains invalid after a long valid prefix.
git.command('diff', [['--diff-filter', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZ']]);

import type { Git } from '../../src/index.js';
declare const git: Git;
declare const dynamic: string;
git.command('diff', [['--dirstat']]);
git.command('diff', [['-X']]);
git.command('diff', [['--dirstat-by-file']]);
git.command('diff', [['--cumulative']]);
git.command('diff', [['--dirstat', '']]);
git.command('diff', [['--dirstat', 'files']]);
git.command('diff', [['-X', '1.']]);
git.command('diff', [['--dirstat', '000.000']]);
git.command('diff', [['--dirstat', '1000']]);
git.command('diff', [['--dirstat', '99999999999999999999999999999999999']]);
git.command('diff', [['--dirstat-by-file', 'files,10.25,cumulative']]);
git.command('diff', [['--dirstat', dynamic]]);
// @ts-expect-error A leading empty parameter is invalid.
git.command('diff', [['--dirstat', ',files']]);
// @ts-expect-error A trailing empty parameter is invalid.
git.command('diff', [['--dirstat', 'files,']]);
// @ts-expect-error Interior empty parameters are invalid.
git.command('diff', [['--dirstat', 'files,,lines']]);
// @ts-expect-error Named parameters are case-sensitive.
git.command('diff', [['--dirstat', 'FILES']]);
// @ts-expect-error Parameters are not trimmed.
git.command('diff', [['--dirstat', ' files']]);
// @ts-expect-error Trailing parameter whitespace is invalid.
git.command('diff', [['--dirstat', 'files ']]);
// @ts-expect-error Percentages must begin with an ASCII digit.
git.command('diff', [['--dirstat', '+1']]);
// @ts-expect-error Negative percentages do not enter the numeric parser.
git.command('diff', [['--dirstat', '-1']]);
// @ts-expect-error A decimal fraction still requires an integer digit.
git.command('diff', [['--dirstat-by-file', '.5']]);
// @ts-expect-error Multiple decimal points are invalid.
git.command('diff', [['--dirstat', '1..']]);
// @ts-expect-error Scientific notation is invalid on the short alias too.
git.command('diff', [['-X', '1e2']]);
// @ts-expect-error A percent sign is not part of the lexical percentage.
git.command('diff', [['--dirstat', '1%']]);
// @ts-expect-error Unit suffixes are invalid.
git.command('diff', [['--dirstat', '1k']]);
// @ts-expect-error A final newline is not part of a valid percentage.
git.command('diff', [['--dirstat', '1\n']]);
// @ts-expect-error Later named parameters cannot repair an unknown token.
git.command('diff', [['--dirstat', 'unknown,files']]);
// @ts-expect-error Diff full help continues to later invalid callbacks.
git.command('diff', [['-h'], ['--dirstat', 'BAD']]);
// @ts-expect-error Blame reaches earlier invalid callbacks before help.
git.command('blame', [['-X', 'BAD'], ['-h']]);
git.command('blame', [['-h'], ['-X', 'BAD']]);
git.command('log', [['--dirstat', 'BAD'], ['-h']]);
git.command('difftool', [['--dirstat', 'BAD'], ['--tool-help']]);
// @ts-expect-error Clearing tool-help restores the retained callback.
git.command('difftool', [['--dirstat', 'BAD'], ['--tool-help'], ['--no-tool-help']]);
declare const alternative: 'files' | 'BAD';
// @ts-expect-error Every supplied literal alternative must be valid.
git.command('diff', [['--dirstat', alternative]]);
// @ts-expect-error A later valid callback does not clear an earlier failure.
git.command('diff', [['--dirstat', 'BAD'], ['--dirstat', 'files']]);
// @ts-expect-error Optional strings do not accept explicit booleans.
git.command('diff', [['--dirstat', true]]);
// @ts-expect-error No-argument cumulative does not accept values.
git.command('diff', [['--cumulative', 'files']]);
// @ts-expect-error NUL is invalid even after help.
git.command('blame', [['-h'], ['--dirstat', 'files\0']]);

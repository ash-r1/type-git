import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('diff-files', []);
git.command('diff-files', [['--max-count', '-2147483648']]);
git.command('diff-files', [['--max-count', '-2']]);
git.command('diff-files', [['--max-count', '3']]);
git.command('diff-files', [['--max-count', '4'], ['--max-count', '3']]);
// Manual stage selection runs after revision parsing, regardless of argv order.
git.command('diff-files', [['--base'], ['--max-count', '4']]);
git.command('diff-files', [['--max-count', '4'], ['--ours']]);
git.command('diff-files', [['--theirs'], ['-4']]);
git.command('diff-files', [['--max-age', '1'], ['--max-age', '-1']]);
git.command('diff-files', [['--min-age', '18446744073709551615']]);
git.command('diff-files', [['--since', 'yesterday'], ['--max-age', '-1']]);
git.command('diff-files', [['--max-age', '1'], ['--after', 'yesterday']]);
// Unpinned legacy atoi can wrap these; selected Git owns its lexical profile.
git.command('diff-files', [['--max-count', '4294967295']]);
git.command('diff-files', [['--min-age', '18446744073709551616']]);
// @ts-expect-error Final count above3 is rejected in every profile.
git.command('diff-files', [['--max-count', '4']]);
// @ts-expect-error Numeric shorthand shares the final count bound.
git.command('diff-files', [['-4']]);
// @ts-expect-error The later count determines final state.
git.command('diff-files', [['--max-count', '3'], ['--max-count', '4']]);
// @ts-expect-error Final numeric age1 is not the default sentinel.
git.command('diff-files', [['--min-age', '1']]);
// @ts-expect-error A manual stage changes count but does not clear timestamp filters.
git.command('diff-files', [['--base'], ['--max-age', '1']]);
declare const count: '3' | '4';
// @ts-expect-error Every known alternative must meet the bound.
git.command('diff-files', [['--max-count', count]]);
git.command('diff-files', [['--max-count', '4'], ['-h']]);

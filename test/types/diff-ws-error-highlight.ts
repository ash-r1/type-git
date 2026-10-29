import type { Git } from '../../src/index.js';
declare const git: Git;
declare const dynamic: string;
git.command('diff', [['--ws-error-highlight', '']]);
git.command('diff', [['--ws-error-highlight', 'new']]);
git.command('diff', [['--ws-error-highlight', 'new,']]);
git.command('diff', [['--ws-error-highlight', 'new,old,context']]);
git.command('diff', [['--ws-error-highlight', 'all,none,new']]);
git.command('diff', [['--ws-error-highlight', 'none,none,']]);
git.command('diff', [['--ws-error-highlight', dynamic]]);
// @ts-expect-error Tokens are case-sensitive.
git.command('diff', [['--ws-error-highlight', 'NEW']]);
// @ts-expect-error Leading empty tokens fail.
git.command('diff', [['--ws-error-highlight', ',new']]);
// @ts-expect-error Interior empty tokens fail.
git.command('diff', [['--ws-error-highlight', 'new,,old']]);
// @ts-expect-error Only one trailing separator is accepted.
git.command('diff', [['--ws-error-highlight', 'new,,']]);
// @ts-expect-error ASCII whitespace is not trimmed.
git.command('diff', [['--ws-error-highlight', ' new']]);
// @ts-expect-error Trailing whitespace is not trimmed.
git.command('diff', [['--ws-error-highlight', 'new ']]);
// @ts-expect-error Later none cannot repair an earlier unknown token.
git.command('diff', [['--ws-error-highlight', 'unknown,none']]);
// @ts-expect-error Unknown tokens after none also fail.
git.command('diff', [['--ws-error-highlight', 'none,unknown']]);
// @ts-expect-error Diff full help does not hide a reached invalid callback.
git.command('diff', [['-h'], ['--ws-error-highlight', 'NEW']]);
// @ts-expect-error Blame reaches an earlier invalid callback before help.
git.command('blame', [['--ws-error-highlight', 'NEW'], ['-h']]);
git.command('blame', [['-h'], ['--ws-error-highlight', 'NEW']]);
git.command('log', [['--ws-error-highlight', 'NEW'], ['-h']]);
git.command('difftool', [['--ws-error-highlight', 'NEW'], ['--tool-help']]);
// @ts-expect-error Clearing tool-help restores the reached callback.
git.command('difftool', [['--ws-error-highlight', 'NEW'], ['--tool-help'], ['--no-tool-help']]);
declare const alternative: 'new' | 'NEW';
// @ts-expect-error Every literal value alternative must be valid.
git.command('diff', [['--ws-error-highlight', alternative]]);
// @ts-expect-error Required strings do not accept booleans.
git.command('diff', [['--ws-error-highlight', true]]);
// @ts-expect-error A later valid occurrence cannot repair an earlier invalid callback.
git.command('diff', [['--ws-error-highlight', 'NEW'], ['--ws-error-highlight', 'new']]);
// @ts-expect-error NUL is invalid even after help.
git.command('blame', [['-h'], ['--ws-error-highlight', 'new\0']]);

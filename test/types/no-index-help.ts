import type { Git, GitCommandArgument, RawResult, TypeGit } from '../../src/index.js';
declare const git: Git;
git.command('diff --no-index', [['--help-all']]);
git.command('diff --no-index', [['--name-only'], ['--help-all'], ['--unknown-tail', 'kept']]);
git.command('diff --no-index', [{ operand: 'first-path' }, ['--help-all'], ['--word-diff', 'invalid']]);
git.command('diff --no-index', [['--help'], ['--unknown-tail']]);
git.command('diff --no-index', [['-h'], ['--unknown-tail']]);
git.command('diff --no-index', [['--help-all'], { operand: '--ignored' }]);
git.command('diff --no-index', [{ operand: 'left' }, { operand: 'right' }]);
git.command('diff --no-index', [['--'], { operand: '--help-all' }, { operand: 'right' }]);
declare const noIndexDefiniteHelp: '--help-all' | '--help';
git.command('diff --no-index', [[noIndexDefiniteHelp], ['--unknown-tail']]);
declare const noIndexRawTail: readonly (readonly ['--unknown-tail', string])[];
git.command('diff --no-index', [['--help-all'], ...noIndexRawTail]);
const noIndexUsageBytes: Promise<RawResult<Uint8Array>> = git.command('diff --no-index', [['--help-all'], ['--unknown-tail']], { stdout: 'bytes' });
void noIndexUsageBytes;
// @ts-expect-error Ordinary comparison still requires two paths.
git.command('diff --no-index', [{ operand: 'left' }]);
// @ts-expect-error Unknown words before the exit remain errors.
git.command('diff --no-index', [['--unknown-before'], ['--help-all']]);
// @ts-expect-error Invalid earlier callbacks still run.
git.command('diff --no-index', [['--word-diff', 'invalid'], ['--help-all']]);
// @ts-expect-error Ordinary dynamic values remain narrow, without broad parser-exit unions.
export const noIndexInvalidDynamicWordDiff: readonly GitCommandArgument<'diff --no-index'>[] = [['--word-diff', 'invalid']];
export const noIndexDynamicWordDiff: readonly GitCommandArgument<'diff --no-index'>[] = [['--word-diff', 'porcelain']];
// A possible non-help first word cannot prove an exit.
declare const noIndexMaybeArgs: readonly [readonly ['--help-all' | '--name-only'], readonly ['--unknown-tail']];
// @ts-expect-error An unknown tail is not ordinary option vocabulary.
git.command('diff --no-index', noIndexMaybeArgs);
// @ts-expect-error Separator prevents later words from selecting help.
git.command('diff --no-index', [['--'], ['--help-all'], ['--unknown-tail']]);
// @ts-expect-error Unknown-tail values must have an explicit string representation.
git.command('diff --no-index', [['--help-all'], ['--unknown-tail', 42]]);
// @ts-expect-error Known flag shapes are retained after exit.
git.command('diff --no-index', [['--help-all'], ['--quiet', 'bad']]);
// @ts-expect-error NUL is invalid even in ignored words.
git.command('diff --no-index', [['--help-all'], ['--unknown-tail', '\0']]);
// @ts-expect-error No ignored-word vocabulary on unrelated commands.
git.command('diff-files', [['--help-all'], ['--unknown-tail']]);

declare const noIndexNodeClient: TypeGit;
noIndexNodeClient.command('diff --no-index', [['--help-all'], ['--unknown-tail']]);

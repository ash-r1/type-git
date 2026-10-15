import type { Git } from '../../src/core/git.js';
declare const git: Git;
declare const dynamic: string;
declare const branch: '--quiet' | '--quiet=1';
git.command('stash push', [['--unified', '-2'], ['-h']]);
git.command('stash save', [['--patch'], ['--include-untracked'], ['--help']]);
git.command('stash apply', [{ operand: '--label-o=ours' }, ['-h']]);
git.command('stash pop', [{ operand: '-qh' }]);
git.command('stash drop', [{ operand: '--n' }, ['-h']]);
git.command('stash store', [{ operand: '--unknown' }, ['-h']]);
git.command('stash store', [['--'], { operand: '-h' }]);
git.command('stash clear', [['-h'], { operand: '-unknown' }]);
git.command('stash push', [{ operand: dynamic }]);
git.command('stash save', [['--'], ['--unified', 'bad']]);
git.command('stash', [{ operand: 'push' }, ['--unified', '-2'], ['-h']]);
// Older parent parsing reaches help before the newer child integer callback.
git.command('stash push', [['--unified', 'bad'], ['-h']]);
// The older parent help exit precedes child abbreviation resolution.
git.command('stash apply', [{ operand: '--label=ours' }, ['-h']]);
// The older parent help exit also precedes child flag-value errors.
git.command('stash drop', [{ operand: '--n=1' }, ['-h']]);
// Both raw alternatives reach the older parent help exit.
git.command('stash pop', [{ operand: branch }, ['-h']]);
// Older parent help precedes clear arity checks.
git.command('stash clear', [{ operand: 'file' }, ['-h']]);
// Older parent help also precedes unknown child options.
git.command('stash apply', [{ operand: '--unknown' }, ['-h']]);
// @ts-expect-error Known NUL bytes remain unrepresentable even after help.
git.command('stash drop', [['-h'], { operand: 'x\0y' }]);

// Unpinned source context preserves the older native help outcome.
git.command('stash push', [['--unified', '2147483648'], ['-h']]);
git.command('stash save', [['--inter-hunk-context', '2147483648'], ['-h']]);

import type { CheckedCommandArguments } from '../../src/commands/types.js';
type Assert<T extends true> = T;
type ClearHelp = readonly [{ readonly operand: 'file' }, readonly ['-h']];
export type LegacyParentClearHelp = Assert<[CheckedCommandArguments<'stash clear', ClearHelp>] extends [never] ? false : true>;
export type ModernParentClearError = Assert<[CheckedCommandArguments<'stash clear', ClearHelp, { stashParent: 'modern' }>] extends [never] ? true : false>;
type BadIntegerHelp = readonly [readonly ['--unified', 'bad'], readonly ['-h']];
export type LegacyParentIntegerHelp = Assert<[CheckedCommandArguments<'stash push', BadIntegerHelp>] extends [never] ? false : true>;
export type ModernParentIntegerError = Assert<[CheckedCommandArguments<'stash push', BadIntegerHelp, { stashParent: 'modern' }>] extends [never] ? true : false>;

// Assumed push stops on the first path; later option-shaped words are literal paths.
git.command('stash', [['--patch'], { operand: 'file' }, ['--unified', 'bad']]);
git.command('stash', [['--'], ['--unified', 'bad']]);
git.command('stash', [['--']]);
git.command('stash', [['--unified', '-2'], ['-h']]);
git.command('stash', [{ operand: '-qh' }]);
// @ts-expect-error A later separator does not retroactively enable assumed push paths.
git.command('stash', [{ operand: 'file' }, ['--'], ['-h']]);
// Older parent scanning reaches help before assumed-push operand processing.
git.command('stash', [{ operand: 'file' }, ['-h']]);
// Older parent scanning reaches help before the child integer callback.
git.command('stash', [['--unified', 'bad'], ['-h']]);
// Older empty parent parsing reaches help before modern subcommand-name typo checks.
git.command('stash', [{ operand: '-push' }, ['-h']]);

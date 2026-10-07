import type { GitCommandClient } from '../../src/commands/types.js';
declare const git: GitCommandClient;
declare const dynamic: string;
declare const symbolic: `row,${string}`;
declare const unsafeColumn: 'never' | 'always';
declare const unsafeUntracked: 'all' | 'bad';
git.command('branch', [['--contains'], ['-h'], ['--color', 'never']]);
git.command('branch', [['--contains']]);
git.command('branch', [['--track'], ['-h']]);
git.command('tag', [['--column', 'never,row'], ['-n', '0']]);
git.command('tag', [['--column', 'row,always'], ['-n', '-1']]);
git.command('tag', [['--column', 'auto'], ['-n', '0']]);
git.command('tag', [['--column', dynamic], ['-n', '0']]);
git.command('tag', [['--column', symbolic], ['-n', '0']]);
git.command('status', [['--untracked-files', 'Yes']]);
git.command('status', [['--untracked-files', '0x10']]);
git.command('status', [['--untracked-files', 'bad'], ['-h']]);
git.command('status', [['--untracked-files', dynamic], ['--ignored', 'matching']]);
git.command('commit', [['--dry-run'], ['--untracked-files', '-1']]);
git.command('commit', [['--cleanup', 'bad'], ['-h']]);
// @ts-expect-error LASTARG_DEFAULT consumes -h as an object name before the invalid color callback.
git.command('branch', [['--contains'], ['-h'], ['--color', 'bad']]);
// @ts-expect-error A reached object callback cannot resolve an empty name.
git.command('tag', [['--contains', ''], ['-h']]);
// @ts-expect-error Explicit column enable conflicts with requested message lines.
git.command('tag', [['--column', 'row'], ['-n', '0']]);
// @ts-expect-error A union containing an invalid final column state is unsafe.
git.command('tag', [['--column', unsafeColumn], ['-n', '0']]);
// @ts-expect-error Column grammar is evaluated immediately, before later help.
git.command('status', [['--column', 'row\tnever'], ['-h']]);
// @ts-expect-error False-valued Git configuration integers suppress untracked files.
git.command('status', [['--ignored', 'matching'], ['--untracked-files', '-0']]);
// @ts-expect-error Untracked mode is checked after parsing when help does not exit.
git.command('status', [['--untracked-files', 'bad']]);
// @ts-expect-error A union with an invalid mode cannot bypass the final scalar check.
git.command('status', [['--untracked-files', unsafeUntracked]]);
// @ts-expect-error Cleanup validation still runs for dry-run.
git.command('commit', [['--dry-run'], ['--cleanup', 'bad']]);

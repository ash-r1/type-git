import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('send-email', [['--identity', 'fixture'], ['--dump-aliases']]);
// @ts-expect-error Alias inspection excludes ordinary send options.
git.command('send-email', [['--dump-aliases'], ['--dry-run']]);
// @ts-expect-error The two alias operations are exclusive.
git.command('send-email', [['--dump-aliases'], ['--translate-aliases']]);
git.command('send-email', [['--dry-run'], ['--confirm', 'never-trailing'], { operand: 'patch' }]);
git.command('send-email', [['--confirm', 'bad'], ['--confirm', 'never']]);
// @ts-expect-error Native confirmation prefixes are case-sensitive.
git.command('send-email', [['--confirm', 'NEVER']]);
// @ts-expect-error Every suppression field is validated, including later entries.
git.command('send-email', [['--suppress-cc', 'author'], ['--suppress-cc', 'bad']]);
git.command('send-email', [['--suppress-cc', 'bad'], ['--git-completion-helper']]);
git.command('send-email', [['--dry-run'], ['--relogin-delay', 0], { operand: 'patch' }]);

git.command('send-email', [['--suppress-cc', 'author\n']]);
git.command('send-email', [['--suppress-cc', 'all\n']]);
// @ts-expect-error Perl's end anchor accepts only one final newline.
git.command('send-email', [['--suppress-cc', 'author\n\n']]);
// @ts-expect-error A CR before the final newline is not part of an allowed field.
git.command('send-email', [['--suppress-cc', 'author\r\n']]);

// Getopt::Long integers use Perl lexical rules, without JavaScript safe-integer limits.
git.command('send-email', [['--batch-size', 9007199254740992]]);
git.command('send-email', [['--batch-size', '18446744073709551616']]);
git.command('send-email', [['--batch-size', 18446744073709551616n]]);
git.command('send-email', [['--batch-size', '__12_']]);
git.command('send-email', [['--relogin-delay', '+12\n']]);
git.command('send-email', [['--smtp-debug', '']]);
git.command('send-email', [['--smtp-debug']]);
// @ts-expect-error The ordinary main parser rejects a decimal fraction.
git.command('send-email', [['--batch-size', '1.0']]);
// @ts-expect-error Leading spaces are not accepted by PAT_INT.
git.command('send-email', [['--relogin-delay', ' 12']]);
// @ts-expect-error A mandatory integer cannot be empty.
git.command('send-email', [['--batch-size', '']]);
// @ts-expect-error A later valid integer does not repair the earlier GetOptions error.
git.command('send-email', [['--batch-size', 'bad'], ['--batch-size', 1]]);
// @ts-expect-error Every member of a supplied finite union must be valid.
git.command('send-email', [['--batch-size', null as unknown as '12' | 'bad']]);
git.command('send-email', [['--batch-size', 'bad'], ['-h']]);
git.command('send-email', [['--smtp-debug', 'bad'], ['--git-completion-helper']]);
git.command('send-email', [['--git-completion-helper'], ['--relogin-delay', 'bad']]);
// @ts-expect-error Alias-mode validation precedes main completion.
git.command('send-email', [['--dump-aliases'], ['--batch-size', 'bad'], ['--git-completion-helper']]);
// @ts-expect-error Completion does not bypass the argv NUL representation boundary.
git.command('send-email', [['--batch-size', 'bad\0'], ['--git-completion-helper']]);

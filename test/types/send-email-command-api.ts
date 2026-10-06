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

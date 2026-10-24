import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('prune', [['-h']]);
git.command('prune', [['--help-all']]);
git.command('prune', [['--git-completion-helper']]);
git.command('prune', [['--git-completion-helper-all']]);
git.command('prune', [['--help-all'], ['--git-completion-helper']]);
git.command('prune', [['--dry-run'], ['--help']]);
git.command('prune', [['--help-all'], ['--expire', 'not-a-date']]);
// Natural-language expiry remains native-delegated; this can fail before help.
git.command('prune', [['--expire', 'not-a-date'], ['--help-all']]);
// @ts-expect-error Reached multiword completion is an unknown native option.
git.command('prune', [['--git-completion-helper'], ['--help-all']]);
// @ts-expect-error A helper after another option is still multiword.
git.command('prune', [['--dry-run'], ['--git-completion-helper']]);
// @ts-expect-error Help cannot permit embedded NUL in argv.
git.command('prune', [['--help-all'], ['--expire', '\0']]);
// @ts-expect-error Help flags are always value-less.
git.command('prune', [['--help-all'], ['-h', true]]);

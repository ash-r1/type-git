import type { Git } from '../../src/index.js';
declare const git: Git;
for (const command of ['count-objects', 'update-server-info', 'pack-refs', 'fsck'] as const) {
  git.command(command, [['-h']]);
  git.command(command, [['--help-all']]);
  git.command(command, [['--git-completion-helper']]);
  git.command(command, [['--git-completion-helper-all']]);
  git.command(command, [['--help-all'], ['--git-completion-helper']]);
  // @ts-expect-error Reached multiword completion is an unknown native option.
  git.command(command, [['--git-completion-helper'], ['--help-all']]);
}
git.command('count-objects', [['--verbose'], ['--help']]);
git.command('update-server-info', [['--force'], ['--help']]);
git.command('pack-refs', [['--all'], ['--help']]);
git.command('fsck', [['--strict'], ['--help']]);
// @ts-expect-error A reached helper after an ordinary option is still multiword.
git.command('pack-refs', [['--all'], ['--git-completion-helper']]);
// @ts-expect-error Help cannot permit an embedded NUL in argv.
git.command('pack-refs', [['--help-all'], ['--include', '\0']]);
// @ts-expect-error Help flags never take a value, even after an earlier exit.
git.command('fsck', [['--help-all'], ['-h', true]]);

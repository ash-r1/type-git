import type { Git } from '../../src/index.js';
declare const git: Git;
for (const command of ['merge-base', 'patch-id', 'stripspace'] as const) {
  git.command(command, [['-h']]);
  git.command(command, [['--help-all']]);
  git.command(command, [['--git-completion-helper']]);
  git.command(command, [['--git-completion-helper-all']]);
  git.command(command, [['--help-all'], ['--git-completion-helper']]);
  git.command(command, [['--help-all'], ['--'], { operand: '-h' }]);
  // @ts-expect-error Reached multiword completion is unknown to native Git.
  git.command(command, [['--git-completion-helper'], ['--help-all']]);
  // @ts-expect-error A tagged help-looking operand cannot bypass completion checks.
  git.command(command, [{ operand: '-h' }, ['--git-completion-helper']]);
}
git.command('merge-base', [['--all'], ['--help']]);
git.command('patch-id', [['--stable'], ['--help']]);
git.command('stripspace', [['--strip-comments'], ['--help']]);
git.command('merge-base', [['--help-all'], ['--octopus'], ['--independent']]);
git.command('patch-id', [['--help-all'], ['--stable'], ['--unstable']]);
git.command('stripspace', [['--help-all'], ['--strip-comments'], ['--comment-lines']]);
git.command('merge-base', [['--octopus'], ['--octopus'], ['--help-all']]);
git.command('patch-id', [['--stable'], ['--stable'], ['--help-all']]);
git.command('stripspace', [['-s'], ['--strip-comments'], ['--help-all']]);
git.command('merge-base', [['--all'], ['--independent'], ['--help-all']]);
// @ts-expect-error Earlier distinct modes conflict before help.
git.command('merge-base', [['--octopus'], ['--independent'], ['--help-all']]);
// @ts-expect-error Earlier distinct modes conflict before help.
git.command('patch-id', [['--stable'], ['--unstable'], ['--help-all']]);
// @ts-expect-error Earlier distinct modes conflict before help.
git.command('stripspace', [['--strip-comments'], ['--comment-lines'], ['--help-all']]);
// @ts-expect-error Final restrictions remain active without help.
git.command('merge-base', [['--all'], ['--independent'], { operand: 'HEAD' }]);
// @ts-expect-error Help does not permit embedded NUL.
git.command('patch-id', [['--help-all'], { operand: '\0' }]);
// @ts-expect-error Help does not allow a value on a value-less flag.
git.command('patch-id', [['--help-all'], ['--stable', true]]);

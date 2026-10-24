import type { Git } from '../../src/index.js';
declare const git: Git;
for (const command of ['hash-object', 'rerere', 'merge-file', 'check-attr'] as const) {
  git.command(command, [['-h']]);
  git.command(command, [['--help-all']]);
  git.command(command, [['--git-completion-helper']]);
  git.command(command, [['--git-completion-helper-all']]);
  git.command(command, [['--help-all'], ['--git-completion-helper']]);
  // @ts-expect-error A reached multiword completion helper is an unknown option.
  git.command(command, [['--git-completion-helper'], ['--help-all']]);
}
git.command('hash-object', [['--stdin'], ['--stdin-paths'], ['--help']]);
git.command('rerere', [['--rerere-autoupdate'], ['--help']]);
git.command('merge-file', [['--help-all'], ['--marker-size', 'invalid']]);
git.command('merge-file', [['--help-all'], ['--diff-algorithm', 'invalid']]);
git.command('check-attr', [['--all'], ['--stdin'], ['--help']]);
// @ts-expect-error Earlier integer callbacks still reject invalid values.
git.command('merge-file', [['--marker-size', 'invalid'], ['--help-all']]);
// @ts-expect-error Earlier enum callbacks still reject invalid values.
git.command('merge-file', [['--diff-algorithm', 'invalid'], ['--help-all']]);
// @ts-expect-error Missing merge files remain invalid without help.
git.command('merge-file', []);
// @ts-expect-error Help cannot permit an embedded NUL in argv.
git.command('hash-object', [['--help-all'], ['--path', '\0']]);
// @ts-expect-error Help does not allow a value on a value-less option.
git.command('rerere', [['--help-all'], ['--rerere-autoupdate', true]]);

import type { Git } from '../../src/index.js';
declare const git: Git;
for (const command of ['pack-objects', 'gc'] as const) {
  git.command(command, [['-h']]);
  git.command(command, [['--help-all']]);
  git.command(command, [['--git-completion-helper']]);
  git.command(command, [['--git-completion-helper-all']]);
  git.command(command, [['--help-all'], ['--git-completion-helper']]);
  git.command(command, [['--help-all'], ['--'], { operand: '-h' }]);
  // @ts-expect-error A reached multiword completion helper is unknown to native Git.
  git.command(command, [['--git-completion-helper'], ['--help-all']]);
  // @ts-expect-error A tagged help-looking operand is not an internal exit.
  git.command(command, [{ operand: '-h' }, ['--git-completion-helper']]);
}
git.command('pack-objects', [['--stdout'], ['--help']]);
git.command('gc', [['--quiet'], ['--help']]);
git.command('pack-objects', [['--help-all'], ['--window', 'invalid']]);
git.command('pack-objects', [['--help-all'], ['--compression', 'invalid']]);
git.command('gc', [['--prune', 'not-a-date'], ['--help-all']]);
// @ts-expect-error An earlier integer callback still rejects malformed values.
git.command('pack-objects', [['--window', 'invalid'], ['--help-all']]);
// @ts-expect-error A help-looking required value does not bypass the next callback.
git.command('pack-objects', [['--index-version', '--help-all'], ['--window', 'invalid']]);
// @ts-expect-error Help cannot permit embedded NUL in a known argument.
git.command('gc', [['--help-all'], ['--prune', '\0']]);
// @ts-expect-error Help cannot permit a value on a value-less flag.
git.command('gc', [['--help-all'], ['--quiet', true]]);

import type { Git } from '../../src/index.js';
declare const git: Git;
for (const command of ['describe', 'name-rev'] as const) {
  git.command(command, [['-h']]);
  git.command(command, [['--help-all']]);
  git.command(command, [['--git-completion-helper']]);
  git.command(command, [['--git-completion-helper-all']]);
  git.command(command, [['--help-all'], ['--git-completion-helper']]);
  git.command(command, [['--help-all'], ['--'], { operand: '-h' }]);
  // @ts-expect-error Reached multiword completion is unknown to native Git.
  git.command(command, [['--git-completion-helper'], ['--help-all']]);
  // @ts-expect-error Tagged help-looking operands do not select an exit.
  git.command(command, [{ operand: '-h' }, ['--git-completion-helper']]);
}
git.command('describe', [['--always'], ['--help']]);
git.command('name-rev', [['--name-only'], ['--help']]);
git.command('describe', [['--help-all'], ['--candidates', 'invalid']]);
git.command('describe', [['--help-all'], ['--abbrev', 'invalid']]);
git.command('describe', [['--long'], ['--abbrev', 0], ['--help-all']]);
git.command('name-rev', [['--all'], ['--stdin'], ['--help-all']]);
// @ts-expect-error Earlier integer callbacks still reject malformed values.
git.command('describe', [['--candidates', 'invalid'], ['--help-all']]);
// @ts-expect-error Earlier abbreviation callbacks still reject malformed values.
git.command('describe', [['--abbrev', 'invalid'], ['--help-all']]);
// @ts-expect-error A consumed help-looking match value cannot bypass the callback.
git.command('describe', [['--match', '--help-all'], ['--candidates', 'invalid']]);
// @ts-expect-error The final long/zero-abbreviation restriction applies without help.
git.command('describe', [['--long'], ['--abbrev', 0]]);
// @ts-expect-error The final input-source conflict applies without help.
git.command('name-rev', [['--all'], ['--stdin']]);
// @ts-expect-error Help cannot permit embedded NUL.
git.command('describe', [['--help-all'], ['--match', '\0']]);
// @ts-expect-error Help cannot permit a value on a value-less flag.
git.command('name-rev', [['--help-all'], ['--all', true]]);

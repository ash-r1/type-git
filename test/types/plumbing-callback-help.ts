import type { Git } from '../../src/index.js';
declare const git: Git;
for (const command of ['interpret-trailers', 'mktag'] as const) {
  git.command(command, [['-h']]);
  git.command(command, [['--help-all']]);
  git.command(command, [['--git-completion-helper']]);
  git.command(command, [['--git-completion-helper-all']]);
  git.command(command, [['--help-all'], ['--git-completion-helper']]);
  git.command(command, [['--help-all'], ['--'], { operand: '-h' }]);
  // @ts-expect-error Reached multiword completion is unknown to ordinary native parsers.
  git.command(command, [['--git-completion-helper'], ['--help-all']]);
  // @ts-expect-error Tagged help-looking operands do not select an exit.
  git.command(command, [{ operand: '-h' }, ['--git-completion-helper']]);
}
git.command('interpret-trailers', [['--only-input'], ['--help']]);
git.command('mktag', [['--strict'], ['--help']]);
git.command('interpret-trailers', [['--help-all'], ['--where', 'invalid']]);
git.command('interpret-trailers', [['--help-all'], ['--if-exists', 'invalid']]);
git.command('interpret-trailers', [['--help-all'], ['--if-missing', 'invalid']]);
git.command('interpret-trailers', [['--only-input'], ['--trailer', 'Key: value'], ['--help-all']]);
// @ts-expect-error A reached enum callback rejects invalid values before help.
git.command('interpret-trailers', [['--where', 'invalid'], ['--help-all']]);
// @ts-expect-error A reached enum callback rejects invalid values before help.
git.command('interpret-trailers', [['--if-exists', 'invalid'], ['--help-all']]);
// @ts-expect-error A reached enum callback rejects invalid values before help.
git.command('interpret-trailers', [['--if-missing', 'invalid'], ['--help-all']]);
// @ts-expect-error Final trailer input-source restrictions remain active without help.
git.command('interpret-trailers', [['--only-input'], ['--trailer', 'Key: value']]);
// @ts-expect-error A consumed help-looking required value cannot bypass the callback.
git.command('interpret-trailers', [['--trailer', '--help-all'], ['--where', 'invalid']]);
// @ts-expect-error Help cannot permit embedded NUL.
git.command('interpret-trailers', [['--help-all'], ['--trailer', '\0']]);
// @ts-expect-error Help cannot permit a value on a value-less flag.
git.command('mktag', [['--help-all'], ['--strict', true]]);

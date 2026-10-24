import type { Git } from '../../src/index.js';
declare const git: Git;
for (const command of ['column', 'fmt-merge-msg', 'update-ref'] as const) {
  git.command(command, [['-h']]);
  git.command(command, [['--help-all']]);
  git.command(command, [['--git-completion-helper']]);
  git.command(command, [['--git-completion-helper-all']]);
  git.command(command, [['--help-all'], ['--git-completion-helper']]);
  // @ts-expect-error A reached completion helper must be the sole parser word.
  git.command(command, [['--git-completion-helper'], ['--help-all']]);
}
git.command('column', [['--width', '1'], ['--help'], ['--width', 'invalid']]);
git.command('column', [['--padding', '-1'], ['-h']]);
git.command('fmt-merge-msg', [['--log', '1'], ['--help'], ['--log', 'invalid']]);
git.command('fmt-merge-msg', [['-F', 'missing-file'], ['--help-all']]);
git.command('update-ref', [['-m', ''], ['--help-all']]);
git.command('update-ref', [['--stdin'], ['-d'], ['-h']]);
// @ts-expect-error An earlier numeric callback still rejects.
git.command('column', [['--width', 'invalid'], ['--help-all']]);
// @ts-expect-error An earlier numeric callback still rejects.
git.command('fmt-merge-msg', [['--log', 'invalid'], ['--help-all']]);
// @ts-expect-error After the end marker, help is an operand and column allows none.
git.command('column', ['--', ['--help-all']]);
// @ts-expect-error After the end marker, help is an operand and fmt-merge-msg allows none.
git.command('fmt-merge-msg', ['--', ['--help-all']]);
// @ts-expect-error Empty final reflog message is still forbidden without help.
git.command('update-ref', [['-m', ''], ['--stdin']]);

import type { Git } from '../../src/index.js';
declare const git: Git;
for (const command of ['check-ignore', 'check-mailmap', 'verify-pack', 'mktree', 'write-tree', 'prune-packed'] as const) {
  git.command(command, [['-h']]);
  git.command(command, [['--help-all']]);
  git.command(command, [['--git-completion-helper']]);
  git.command(command, [['--git-completion-helper-all']]);
  git.command(command, [['--help-all'], ['--git-completion-helper']]);
  // @ts-expect-error Reached multiword completion is an unknown native option.
  git.command(command, [['--git-completion-helper'], ['--help-all']]);
}
git.command('check-ignore', [['--quiet'], ['--verbose'], ['--help']]);
git.command('check-mailmap', [['--stdin'], ['--help']]);
git.command('verify-pack', [['--stat-only'], ['--help']]);
git.command('mktree', [['--batch'], ['--help']]);
git.command('write-tree', [['--missing-ok'], ['--help']]);
git.command('prune-packed', [['--dry-run'], ['--help']]);
// @ts-expect-error Final conflicting modes remain invalid without help.
git.command('check-ignore', [['--quiet'], ['--verbose'], {operand:'file'}]);
// @ts-expect-error Missing contacts remain invalid without help.
git.command('check-mailmap', []);
// @ts-expect-error Missing pack files remain invalid without help.
git.command('verify-pack', []);
// @ts-expect-error Help never permits an embedded NUL in argv.
git.command('write-tree', [['--help-all'], ['--prefix', '\0']]);

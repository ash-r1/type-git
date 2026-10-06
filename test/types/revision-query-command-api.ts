import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('shortlog', [['--group', 'AUTHOR'], ['-w', '76,6,9'], { operand: 'HEAD' }]);
git.command('show-branch', [['--merge-base'], ['--independent']]);
git.command('show-branch', [['--list'], ['--no-more'], ['--merge-base']]);
// @ts-expect-error Extra listing and merge-base conflict.
git.command('show-branch', [['--list'], ['--merge-base']]);
// @ts-expect-error Reflog accepts only one explicit branch.
git.command('show-branch', [['--reflog'], { operand: 'one' }, { operand: 'two' }]);
git.command('pull', [['--rebase', 'merges'], ['--dry-run'], { operand: '.' }]);
git.command('pull', [['--squash'], ['--commit'], ['--dry-run'], { operand: '.' }]);
// @ts-expect-error Fetch --all excludes an explicit repository.
git.command('pull', [['--all'], { operand: '.' }]);
// @ts-expect-error Depth and unshallow cannot be combined by fetch.
git.command('pull', [['--depth', '1'], ['--unshallow']]);
git.command('rev-parse', [['--git-path', 'objects']]);
git.command('rev-parse', [['--verify'], ['--default', 'HEAD']]);
// @ts-expect-error Path-format is a case-sensitive native enum.
git.command('rev-parse', [['--path-format', 'ABSOLUTE']]);
// @ts-expect-error Object-format display rejects unknown modes immediately.
git.command('rev-parse', [['--show-object-format', 'bad']]);
git.command('rev-parse --parseopt', [['--'], { operand: '-f' }]);
// @ts-expect-error Parseopt requires its separator even with no arguments.
git.command('rev-parse --parseopt', []);
git.command('rev-parse --sq-quote', [{ operand: '--help' }]);
git.command('pickaxe', [{ operand: 'tracked' }]);
git.command('whatchanged', [['--i-still-use-this']]);
// @ts-expect-error Git 2.55 requires opt-in to this deprecated command.
git.command('whatchanged', []);
// @ts-expect-error Group names use case-sensitive trailer/format prefixes.
git.command('shortlog', [['--group', 'TRAILER:Reviewed-by']]);
// @ts-expect-error Mode names are case-sensitive even though booleans are not.
git.command('pull', [['--rebase', 'MERGES']]);

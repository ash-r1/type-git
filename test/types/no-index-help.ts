import type { Git, GitCommandArgument } from '../../src/index.js';
declare const git: Git;
git.command('diff --no-index', [['--help-all']]);
git.command('diff --no-index', [{ operand: 'left' }, { operand: 'right' }]);
// @ts-expect-error Canonical full usage must be the sole local word.
git.command('diff --no-index', [['--help-all'], { operand: 'left' }]);
// @ts-expect-error Ordinary comparison still needs two paths.
git.command('diff --no-index', [{ operand: 'left' }]);
// @ts-expect-error Full usage is value-less.
git.command('diff --no-index', [['--help-all', true]]);
export const noIndexDynamicWordDiff: readonly GitCommandArgument<'diff --no-index'>[] = [['--word-diff', 'porcelain']];
// @ts-expect-error Dynamic public argument values remain narrow.
export const noIndexInvalidDynamicWordDiff: readonly GitCommandArgument<'diff --no-index'>[] = [['--word-diff', 'invalid']];

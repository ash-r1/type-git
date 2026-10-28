import type { Git, GitCommandArgument } from '../../src/index.js';
declare const git: Git;
git.command('diff-tree', [['--help-all']]);
git.command('diff-tree', [['--name-only'], { operand: 'HEAD' }]);
// @ts-expect-error Full usage must be the sole word.
git.command('diff-tree', [['--help-all'], { operand: 'HEAD' }]);
// @ts-expect-error Multiword full-help is not an exit from normal option parsing.
git.command('diff-tree', [['--name-only'], ['--help-all']]);
// @ts-expect-error Full usage is value-less.
git.command('diff-tree', [['--help-all', true]]);
// @ts-expect-error An invalid enum is still rejected before full usage.
git.command('diff-tree', [['--diff-algorithm', 'invalid'], ['--help-all']]);
export const diffTreeDynamicWordDiff: readonly GitCommandArgument<'diff-tree'>[] = [['--word-diff', 'porcelain']];
// @ts-expect-error Dynamic public argument arrays retain allowed-value enumerations.
export const diffTreeInvalidDynamicWordDiff: readonly GitCommandArgument<'diff-tree'>[] = [['--word-diff', 'invalid']];

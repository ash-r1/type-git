import type { Git, GitCommandArgument } from '../../src/index.js';
declare const git: Git;
git.command('diff-files', [['--help-all']]);
git.command('diff-files', [['--name-only'], { operand: 'file' }]);
// @ts-expect-error Full usage must be the sole word.
git.command('diff-files', [['--help-all'], { operand: 'file' }]);
// @ts-expect-error Multiword full-help is not an exit from normal option parsing.
git.command('diff-files', [['--name-only'], ['--help-all']]);
// @ts-expect-error Full usage is value-less.
git.command('diff-files', [['--help-all', true]]);
// @ts-expect-error An invalid enum is still rejected before full usage.
git.command('diff-files', [['--diff-algorithm', 'invalid'], ['--help-all']]);
export const dynamicWordDiff: readonly GitCommandArgument<'diff-files'>[] = [['--word-diff', 'porcelain']];
// @ts-expect-error Dynamic public argument arrays retain allowed-value enumerations.
export const invalidDynamicWordDiff: readonly GitCommandArgument<'diff-files'>[] = [['--word-diff', 'invalid']];

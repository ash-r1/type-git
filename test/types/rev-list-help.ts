import type { Git, GitCommandArgument } from '../../src/index.js';
declare const git: Git;
git.command('rev-list', [['--help-all']]);
git.command('rev-list', [['--count'], { operand: 'HEAD' }]);
// @ts-expect-error Full usage must be the sole word.
git.command('rev-list', [['--help-all'], { operand: 'HEAD' }]);
// @ts-expect-error Multiword full-help is not an exit from normal option parsing.
git.command('rev-list', [['--count'], ['--help-all']]);
// @ts-expect-error Full usage is value-less.
git.command('rev-list', [['--help-all', true]]);
// @ts-expect-error An invalid callback is still rejected before full usage.
git.command('rev-list', [['--disk-usage', 'invalid'], ['--help-all']]);
export const dynamicDiskUsage: readonly GitCommandArgument<'rev-list'>[] = [['--disk-usage', 'human']];
// @ts-expect-error The public argument union preserves existing allowed-value enumerations.
export const invalidDynamicDiskUsage: readonly GitCommandArgument<'rev-list'>[] = [['--disk-usage', 'invalid']];

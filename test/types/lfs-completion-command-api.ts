import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('lfs __complete', [{ operand: '' }]);
git.command('lfs __completeNoDesc', [{ operand: 'fetch' }, { operand: '--recent' }, { operand: '' }]);
git.command('lfs __complete', [{ operand: '--help' }]);
// @ts-expect-error The native helper requires at least one literal word.
git.command('lfs __complete', []);
// @ts-expect-error Flag parsing is disabled; pass --help as a literal completion input.
git.command('lfs __completeNoDesc', [['--help']]);
// @ts-expect-error There is no helper end-of-options marker.
git.command('lfs __complete', [['--'], { operand: '' }]);

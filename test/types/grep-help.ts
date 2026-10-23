import type {Git} from '../../src/index.js';
declare const git:Git;
git.command('grep',[['--threads',1],['--help'],['--threads','invalid']]);
git.command('grep',[['--threads',-1],['--help']]);
git.command('grep',[['--cached'],['--no-index'],['--help']]);
git.command('grep',[['-h'],['-e','base']]);
git.command('grep',[{operand:'base'},{operand:'--help'}]);
// @ts-expect-error A reached integer callback still fails before help.
git.command('grep',[['--threads','invalid'],['--help']]);
// @ts-expect-error Short h does not preempt a later invalid integer callback.
git.command('grep',[['-h'],['--threads','invalid'],['-e','base']]);
// @ts-expect-error Short h does not supply a pattern or select help.
git.command('grep',[['-h'],['--threads',1]]);

// The native one-word shortcut precedes registered filename suppression.
git.command('grep',[['-h']]);

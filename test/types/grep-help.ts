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

git.command('grep',[['--help-all']]);
git.command('grep',[['--threads',1],['--help-all'],['--threads','invalid']]);
git.command('grep',[['--threads',-1],['--help-all']]);
git.command('grep',[['-h'],['--help-all'],['--threads','invalid']]);
git.command('grep',[['-e','--help-all']]);
// @ts-expect-error Full help still follows earlier integer callbacks.
git.command('grep',[['--threads','invalid'],['--help-all']]);

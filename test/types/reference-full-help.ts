import type {Git} from '../../src/index.js';
declare const git:Git;
for(const command of ['branch','for-each-ref','tag','show-branch'] as const){
 git.command(command,[['--help-all']]);
 git.command(command,[['--help-all'],['--git-completion-helper']]);
}
git.command('branch',[['--help-all'],['--track','invalid']]);
git.command('for-each-ref',[['--help-all'],['--count','invalid']]);
git.command('tag',[['--help-all'],['-n','invalid']]);
git.command('show-branch',[['--help-all'],['--more','invalid']]);
// @ts-expect-error The earlier track callback still fails.
git.command('branch',[['--track','invalid'],['--help-all']]);
// @ts-expect-error The earlier count callback still fails.
git.command('for-each-ref',[['--count','invalid'],['--help-all']]);
// @ts-expect-error The earlier numeric callback still fails.
git.command('tag',[['-n','invalid'],['--help-all']]);
// @ts-expect-error The earlier more callback still fails.
git.command('show-branch',[['--more','invalid'],['--help-all']]);

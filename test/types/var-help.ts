import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('var', [['-h']]);
git.command('var', [['--help-all']]);
git.command('var', [{ operand: '-h' }]);
git.command('var', [{ operand: '--help-all' }]);
git.command('var', [['-l']]);
git.command('var', [{ operand: 'GIT_EDITOR' }]);
git.command('var', [['--help'], ['--man']]);
declare const varUsage: '-h' | '--help-all';
git.command('var', [[varUsage]]);
git.command('var', [{ operand: varUsage }]);
declare const varQueryOrUsage: 'GIT_EDITOR' | '-h';
git.command('var', [{ operand: varQueryOrUsage }]);
declare const varInvalidUsage: '-h' | 'ordinary';
// @ts-expect-error Every operand union arm must be a supported variable or sole usage word.
git.command('var', [{ operand: varInvalidUsage }]);
// @ts-expect-error One raw argument is required.
git.command('var', []);
// @ts-expect-error Unknown variable.
git.command('var', [{ operand: 'ordinary' }]);
// @ts-expect-error Canonical usage words cannot hide another argument.
git.command('var', [['-h'], { operand: 'GIT_EDITOR' }]);
// @ts-expect-error Tagged usage words cannot hide another argument.
git.command('var', [{ operand: '--help-all' }, { operand: 'GIT_EDITOR' }]);
// @ts-expect-error A listing takes no variable.
git.command('var', [['-l'], { operand: 'GIT_EDITOR' }]);
// @ts-expect-error Documentation dispatch is first-word-only.
git.command('var', [{ operand: 'GIT_EDITOR' }, ['--help']]);
// @ts-expect-error No separator option.
git.command('var', [['--']]);
// @ts-expect-error A flag takes no attached value.
git.command('var', [['-h', true]]);
// @ts-expect-error No union arm permits a second word.
git.command('var', [[varUsage], { operand: 'ignored' }]);

declare const varListingOrUsage: '-h' | '-l';
git.command('var', [[varListingOrUsage]]);
declare const varUsageOrDocumentation: '-h' | '--help';
git.command('var', [[varUsageOrDocumentation]]);
// @ts-expect-error A mixed valid mode still cannot hide another argument.
git.command('var', [[varListingOrUsage], { operand: 'ignored' }]);

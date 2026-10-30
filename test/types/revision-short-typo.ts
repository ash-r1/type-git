import type { Git } from '../../src/index.js';

declare const git: Git;

// A leading unknown short still runs native Git's single-dash long typo check.
// @ts-expect-error -follow requires two dashes even before a completion exit.
git.command('log', [{ operand: '-follow' }, { operand: '--git-completion-helper' }]);
// @ts-expect-error The typo check also applies without a later exit.
git.command('log', [{ operand: '-follow' }, { operand: 'HEAD' }]);
// A short unknown word that is too short or matches no long name is deferred to the exit.
git.command('log', [{ operand: '-fo' }, { operand: '--git-completion-helper' }]);
git.command('log', [{ operand: '-xyzzy' }, { operand: '--git-completion-helper' }]);
// Known short clusters keep their existing typo handling.
git.command('log', [{ operand: '-p' }, { operand: '--git-completion-helper' }]);

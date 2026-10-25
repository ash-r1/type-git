import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('merge-ours', [['--help-all']]);
git.command('merge-ours', [['--help-all'], { operand: 'ignored' }]);
git.command('merge-ours', [{ operand: '--git-completion-helper' }]);
git.command('merge-ours', [{ operand: 'base' }, { operand: '--' }, { operand: 'HEAD' }, { operand: 'remote' }]);
// @ts-expect-error There is no parse-options separator; use a tagged literal.
git.command('merge-ours', [['--']]);
// @ts-expect-error Flag shape is retained even for a help-looking word.
git.command('merge-ours', [['--help-all', true]]);
// @ts-expect-error NUL is never an argv byte.
git.command('merge-ours', [['--help-all'], { operand: '\0' }]);
// @ts-expect-error No parse-options completion shortcut is modeled for merge-ours.
git.command('merge-ours', [['--git-completion-helper']]);

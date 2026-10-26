import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('merge-index', [['-h']]);
git.command('merge-index', [['--help-all']]);
git.command('merge-index', [{ operand: '-h' }]);
git.command('merge-index', [{ operand: '--help-all' }]);
git.command('merge-index', [{ operand: 'program' }, ['-a']]);
git.command('merge-index', [{ operand: '-h' }, { operand: 'file' }]);
// @ts-expect-error A normal program word still needs a second argument.
git.command('merge-index', [{ operand: 'program' }]);
// @ts-expect-error No argument is not a usage shortcut.
git.command('merge-index', []);
// @ts-expect-error Canonical help flags remain sole-word-only.
git.command('merge-index', [['-h'], { operand: 'file' }]);
// @ts-expect-error Completion is not part of the handwritten parser.
git.command('merge-index', [['--git-completion-helper']]);
// @ts-expect-error A bare separator is not a help shortcut.
git.command('merge-index', [['--']]);
// @ts-expect-error Flag shape validation remains active.
git.command('merge-index', [['--help-all', true]]);
declare const help: '-h' | '--help-all';
git.command('merge-index', [{ operand: help }]);
// @ts-expect-error No help union arm may hide an extra word.
git.command('merge-index', [[help], { operand: 'file' }]);
declare const maybeHelp: '-h' | 'program';
// @ts-expect-error The program union arm is invalid with one word.
git.command('merge-index', [{ operand: maybeHelp }]);

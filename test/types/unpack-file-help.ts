import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('unpack-file', [['-h']]);
git.command('unpack-file', [['--help-all']]);
git.command('unpack-file', [{ operand: 'missing-blob' }]);
git.command('unpack-file', [{ operand: '--' }]);
git.command('unpack-file', [['--help-all'], { operand: 'missing-blob' }]);
// @ts-expect-error A call without a sole usage shortcut still requires a blob.
git.command('unpack-file', []);
// @ts-expect-error A multiword help flag does not bypass final operand arity.
git.command('unpack-file', [['--help-all'], { operand: 'one' }, { operand: 'two' }]);
// @ts-expect-error This handwritten parser has no separator option tuple.
git.command('unpack-file', [['--']]);
// @ts-expect-error This handwritten parser has no completion shortcut.
git.command('unpack-file', [['--git-completion-helper']]);
// @ts-expect-error Flag shape remains enforced.
git.command('unpack-file', [['-h', true]]);
// @ts-expect-error NUL is never an argv byte.
git.command('unpack-file', [['-h'], { operand: '\0' }]);

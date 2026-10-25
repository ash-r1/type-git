import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('ls-files', [['--help-all']]);
git.command('ls-files', [['--git-completion-helper']]);
git.command('ls-files', [['--git-completion-helper-all']]);
git.command('ls-files', [['--help-all'], ['--git-completion-helper']]);
git.command('ls-files', [['-h'], ['--abbrev', 'bad']]);
git.command('ls-files', [['--cached'], ['--help']]);
git.command('ls-files', [['--format', '%(path)'], ['-s'], ['--help-all']]);
git.command('ls-files', [['--with-tree', 'missing'], ['-s'], ['-h']]);
git.command('ls-files', [['--'], { operand: '-h' }]);
// @ts-expect-error Reached malformed numeric callbacks still fail before help.
git.command('ls-files', [['--abbrev', 'bad'], ['-h']]);
// @ts-expect-error A reached completion helper must be the sole parser word.
git.command('ls-files', [['--git-completion-helper'], ['--help-all']]);
// @ts-expect-error Consumed help-looking values do not exit the parser.
git.command('ls-files', [['--exclude', '-h'], ['--abbrev', 'bad']]);
// @ts-expect-error Tagged operands do not create an internal help exit.
git.command('ls-files', [{ operand: '-h' }, ['--git-completion-helper']]);
// @ts-expect-error Options cannot resume after an end marker.
git.command('ls-files', [['--'], { operand: '-h' }, ['--abbrev', 'bad']]);
// @ts-expect-error Help does not permit NUL in argv.
git.command('ls-files', [['-h'], ['--exclude', '\0']]);
// @ts-expect-error Value-less flags retain shape requirements after help.
git.command('ls-files', [['-h'], ['--cached', true]]);
declare const maybeHelp: '-h' | '--cached';
// @ts-expect-error The cached union arm still reaches the invalid numeric callback.
git.command('ls-files', [[maybeHelp], ['--abbrev', 'bad']]);

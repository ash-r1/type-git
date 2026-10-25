import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('ls-remote', [['-h']]);
git.command('ls-remote', [['--help-all']]);
git.command('ls-remote', [['--git-completion-helper']]);
git.command('ls-remote', [['--git-completion-helper-all']]);
git.command('ls-remote', [['--help-all'], ['--git-completion-helper']]);
git.command('ls-remote', [['--refs'], ['--help']]);
git.command('ls-remote', [['-h'], ['--help-all']]);
git.command('ls-remote', [['--get-url'], ['-h'], { operand: 'local' }]);
git.command('ls-remote', [['--upload-pack', '--help-all'], ['--help-all']]);
git.command('ls-remote', [['--server-option', '-h'], ['--help-all']]);
git.command('ls-remote', [['--get-url'], { operand: 'local' }, { operand: '--help-all' }]);
git.command('ls-remote', [['--get-url'], ['--'], { operand: 'local' }, { operand: '-h' }]);
// @ts-expect-error In a multiword call -h is heads and does not bypass a reached completion error.
git.command('ls-remote', [['-h'], ['--git-completion-helper']]);
// @ts-expect-error A completion helper must be the sole parser word unless earlier full help exits.
git.command('ls-remote', [['--git-completion-helper'], ['--help-all']]);
// @ts-expect-error A consumed help-looking value does not bypass a later helper error.
git.command('ls-remote', [['--upload-pack', '--help-all'], ['--git-completion-helper']]);
// @ts-expect-error Option tuples cannot resume parsing after the first operand.
git.command('ls-remote', [['--get-url'], { operand: 'local' }, ['--help-all']]);
// @ts-expect-error Help does not remove value-less flag shape constraints.
git.command('ls-remote', [['--help-all'], ['--refs', true]]);
// @ts-expect-error NUL cannot occur in argv even after help.
git.command('ls-remote', [['--help-all'], { operand: '\0' }]);
declare const lsRemoteMaybeHelp: '--help-all' | '-h';
// @ts-expect-error The heads arm still reaches the invalid multiword helper.
git.command('ls-remote', [[lsRemoteMaybeHelp], ['--git-completion-helper']]);

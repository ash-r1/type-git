import type { Git } from '../../src/core/git.js';
declare const git: Git;
declare const dynamic: string;
// Values ignored after help remain serializable but need not belong to the callback grammar.
git.command('branch', [['-h'], ['--track', 'invalid']]);
git.command('branch', [['-h'], ['--track', dynamic]]);
git.command('for-each-ref', [['-h'], ['--count', 'bad']]);
git.command('tag', [['-h'], ['--delete'], ['--verify']]);
git.command('show-branch', [['-h'], { operand: 'HEAD' }, ['--more', 'bad']]);
git.command('branch', [['-h'], ['--'], ['--'], ['--color', 'invalid']]);
git.command('branch', [['--color', dynamic], ['-h']]);
// @ts-expect-error Leading --help delegates to git-help; it is not this parser's exit.
git.command('branch', [['--help'], ['--color', 'invalid']]);
// @ts-expect-error Invalid callback value is reached before help.
git.command('branch', [['--track', 'invalid'], ['-h']]);
// @ts-expect-error Invalid integer is reached before help.
git.command('for-each-ref', [['--count', 'bad'], ['-h']]);
// @ts-expect-error A color value containing -h is not an exit token.
git.command('branch', [['--color', '-h'], ['--color', 'auto']]);
// @ts-expect-error -- ends option interpretation before the help token.
git.command('branch', [['--'], ['-h']]);
// @ts-expect-error show-branch stops option interpretation at its first operand.
git.command('show-branch', [{ operand: 'HEAD' }, ['-h']]);
// @ts-expect-error OS argv cannot represent NUL even after the parser exits.
git.command('branch', [['-h'], ['--color', 'a\0b']]);
// @ts-expect-error Structured option values must still be strings.
git.command('branch', [['-h'], ['--color', 7]]);

// The same parser exit applies to native integers, callbacks and final rules.
git.command('fetch', [['-h'], ['--filter', 'invalid']]);
git.command('clone', [['-h'], ['--filter', 'invalid']]);
git.command('checkout', [['-h'], ['--unified', 'invalid']]);
git.command('rebase', [['-h'], ['--apply'], ['--merge']]);
git.command('switch', [['-h'], ['--conflict', 'invalid']]);
git.command('add', [['--chmod', 'invalid'], ['-h']]);
git.command('status', [['--untracked-files', 'invalid'], ['-h']]);
// @ts-expect-error This callback conflict is reached before help.
git.command('rebase', [['--apply'], ['--merge'], ['-h']]);
// @ts-expect-error The integer callback is reached before help.
git.command('checkout', [['--unified', 'invalid'], ['-h']]);

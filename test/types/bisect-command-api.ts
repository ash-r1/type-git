import type { Git } from '../../src/core/git.js';
declare const git: Git;
declare const term: string;
declare const choice: 'fixed' | 'broken';
git.command('bisect start', [['--no-checkout'], ['--term-good', 'fixed'], ['--term-bad', 'broken']]);
git.command('bisect start', [['--term-good', term], ['--term-bad', 'broken']]);
git.command('bisect start', [['--term-good', choice], ['--term-bad', choice]]);
git.command('bisect start', [['--term-good', 'start'], ['--term-old', 'fixed']]);
git.command('bisect start', [['--term-good', 'same'], ['--term-bad', 'same'], ['--term-new', 'other']]);
// @ts-expect-error Final good and bad terms must differ.
git.command('bisect start', [['--term-good', 'same'], ['--term-bad', 'same']]);
// @ts-expect-error The initial bad term is bad.
git.command('bisect start', [['--term-good', 'bad']]);
// @ts-expect-error Builtin commands cannot be custom terms.
git.command('bisect start', [['--term-bad', 'start']]);
// @ts-expect-error Terms must be nonempty.
git.command('bisect start', [['--term-good', '']]);
git.command('bisect', [{ operand: 'custom-term' }, { operand: 'HEAD' }]);
// @ts-expect-error Root dispatch needs an operation or term.
git.command('bisect', []);
git.command('bisect terms', [['--term-good']]);
// @ts-expect-error Only one query argument, including repeated flags.
git.command('bisect terms', [['--term-good'], ['--term-good']]);
// @ts-expect-error A query must be a supported option.
git.command('bisect terms', [{ operand: 'good' }]);
git.command('bisect good', [{ operand: 'HEAD~1' }, { operand: 'HEAD~2' }]);
// @ts-expect-error The bad term takes at most one revision.
git.command('bisect bad', [{ operand: 'HEAD' }, { operand: 'HEAD~1' }]);
git.command('bisect log', [{ operand: '--ignored' }]);
git.command('bisect view', [{ operand: '--oneline' }]);
git.command('bisect run', [{ operand: 'true' }]);
// @ts-expect-error Run requires a command.
git.command('bisect run', []);
// @ts-expect-error Reset takes at most one revision.
git.command('bisect reset', [{ operand: 'HEAD' }, { operand: 'HEAD~1' }]);
// @ts-expect-error Next accepts no arguments.
git.command('bisect next', [{ operand: 'HEAD' }]);
git.command('bisect replay', [{ operand: 'logfile' }]);

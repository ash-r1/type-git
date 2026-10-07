import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('stash import', [{ operand: 'one' }, { operand: 'two' }, ['-h']]);
git.command('stash import', [['--']]);
git.command('stash import', [{ operand: '--end-of-options' }, ['-h']]);
git.command('stash export', [['--print'], ['--to-ref', 'refs/exported'], ['-h']]);
git.command('stash export', [{ operand: '--pri' }, ['-h']]);
git.command('stash export', [['--print'], ['--'], ['--to-ref', 'literal']]);
git.command('stash', [{ operand: 'export' }, { operand: '--pri' }, ['-h']]);
// @ts-expect-error The retained separator and -h are two operands, not a help exit.
git.command('stash import', [['--'], ['-h']]);
// @ts-expect-error The retained separator is a second operand.
git.command('stash', [{ operand: 'import' }, { operand: 'file' }, ['--']]);
// @ts-expect-error The command-mode flag is not negatable.
git.command('stash export', [{ operand: '--no-print' }, ['-h']]);
// @ts-expect-error Destination checks apply when no help exits.
git.command('stash export', [['--print'], ['--to-ref', 'refs/exported']]);
// @ts-expect-error Known NUL bytes are unrepresentable even after help.
git.command('stash export', [['-h'], ['--to-ref', 'x\0y']]);

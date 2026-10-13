import type { GitCommandClient } from '../../src/commands/types.js';
declare const git: GitCommandClient;
declare const dynamic: string;
// Ordinary parsers consume their end markers; following words remain literal.
git.command('switch', [{ operand: '--det' }, ['-h']]);
git.command('restore', [{ operand: '-SWh' }]);
git.command('restore', [['--'], ['-h']]);
git.command('restore', [{ operand: '--end-of-options' }, ['--'], ['-h']]);
// Checkout scans all retained words; reset recognizes a marker only at index 0 or 1.
git.command('checkout', [{ operand: '--end-of-options' }, { operand: 'HEAD' }, ['--'], ['-h']]);
git.command('reset', [{ operand: 'file' }, { operand: 'other' }, ['--'], ['-h']]);
git.command('reset', [['--'], ['--'], ['-h']]);
git.command('checkout', [['--'], ['--'], ['-h']]);
git.command('checkout', [{ operand: dynamic }, ['--'], ['-h']]);
// @ts-expect-error Only one reference may precede checkout's first retained separator.
git.command('checkout', [{ operand: 'file' }, { operand: 'other' }, ['--'], ['-h']]);
// @ts-expect-error Literal -h after the boundary cannot suppress final reset mode checks.
git.command('reset', [['--hard'], ['--'], ['-h']]);
// @ts-expect-error Literal -h after the boundary cannot suppress final checkout mode checks.
git.command('checkout', [['--detach'], ['--'], ['-h']]);
// @ts-expect-error Switch still accepts only one reference after --.
git.command('switch', [['--'], { operand: 'main' }, ['-h']]);
// @ts-expect-error A reached conflict callback fails before help.
git.command('restore', [['--conflict', 'bad'], ['-h']]);
// @ts-expect-error A reached integer callback fails before help.
git.command('reset', [['--unified', 'bad'], ['-h']]);

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
// Git 2.25 validates the conflict value after parsing, so help can preempt it.
git.command('restore', [['--conflict', 'bad'], ['-h']]);
// @ts-expect-error A reached integer callback fails before help.
git.command('reset', [['--unified', 'bad'], ['-h']]);

declare const resetBoundary: '--' | 'HEAD~1';
// @ts-expect-error The non-separator alternative adds a forbidden path under --hard.
git.command('reset', [['--hard'], { operand: 'HEAD' }, { operand: resetBoundary }]);

import type { CheckedCommandArguments } from '../../src/commands/types.js';
type Assert<T extends true> = T;
export type ModernRestoreConflict = Assert<[CheckedCommandArguments<'restore', readonly [readonly ['--conflict', 'bad'], readonly ['-h']], { conflictStyle: 'immediate'; integerProfile: 'bounded'; booleanSource: 'modern'; firstPassEmpty: true; decimalCallbacks: {} }>] extends [never] ? true : false>;

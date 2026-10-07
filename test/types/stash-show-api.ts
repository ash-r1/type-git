import type { Git } from '../../src/core/git.js';
declare const git: Git;
declare const dynamic: string;
declare const numericWord: `${number}`;
declare const ambiguous: 'one' | '-h';
git.command('stash show', [['--color', 'bad'], ['-h']]);
git.command('stash show', [['--default', 'foo'], ['-h']]);
git.command('stash show', [['--'], ['--default', 'foo']]);
git.command('stash show', [['--'], ['-h'], { operand: '-unknown' }]);
git.command('stash show', [{ operand: '--end-of-options' }, { operand: '-h' }]);
git.command('stash show', [['--'], { operand: 'foo' }, { operand: dynamic }]);
git.command('stash show', [['--'], { operand: 'foo' }, { operand: numericWord }]);
git.command('stash', [{ operand: 'show' }, ['--color', 'bad'], ['-h']]);
// @ts-expect-error Both plain words become stash references, including after --.
git.command('stash show', [['--'], { operand: 'foo' }, { operand: 'one' }]);
// @ts-expect-error One union member adds a second stash reference.
git.command('stash show', [['--'], { operand: 'foo' }, { operand: ambiguous }]);
// @ts-expect-error The own-table flag rejects attached data before help.
git.command('stash show', [{ operand: '--include-untracked=1' }, ['-h']]);
// @ts-expect-error The plain word is removed before the detached option consumes its value.
git.command('stash show', [['--default', 'foo']]);
// @ts-expect-error There is no help exit before this invalid later callback.
git.command('stash show', [['--color', 'bad']]);
// @ts-expect-error Literal NUL cannot be hidden behind a dynamic partition.
git.command('stash show', [['--'], { operand: dynamic }, { operand: 'x\0y' }]);

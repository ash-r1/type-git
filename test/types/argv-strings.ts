import type { Git } from '../../src/core/git.js';
import type { GitCommandArgument } from '../../src/commands/types.js';
declare const git: Git;
git.command('hash-object', [{ operand: 'file' }]);
git.command('log', [['--format', 'text'], ['-h']]);
git.command('config', [{ operand: 'get' }, { operand: 'key' }]);
// @ts-expect-error An operand cannot contain NUL even when help suppresses semantic rules.
git.command('log', [['-h'], { operand: 'a\0b' }]);
// @ts-expect-error A long option value cannot contain NUL.
git.command('log', [['--format', 'a\0b'], ['-h']]);
// @ts-expect-error A short option value cannot contain NUL.
git.command('commit', [['-m', 'a\0b'], ['-h']]);
// @ts-expect-error Root dispatch must retain the argv string restriction.
git.command('config', [{ operand: 'get' }, { operand: 'a\0b' }]);
// @ts-expect-error NUL is forbidden after the end-of-options marker as well.
git.command('log', [['--'], { operand: 'a\0b' }]);
// @ts-expect-error LFS uses the same OS argv representation.
git.command('lfs pointer', [['--file', 'a\0b']]);
declare const union: 'valid' | 'bad\0value';
// @ts-expect-error An invalid member of a literal union must not escape checking.
git.command('hash-object', [{ operand: union }]);
declare const knownNulTemplate: `${string}\0${string}`;
// @ts-expect-error A template with a known NUL cannot be serialized.
git.command('log', [['--format', knownNulTemplate], ['-h']]);
declare const dynamic: string;
git.command('log', [['--format', dynamic], ['-h']]);
git.command('hash-object', [{ operand: dynamic }]);
declare const dynamicArgs: readonly GitCommandArgument<'log'>[];
git.command('log', dynamicArgs);

// stdin is a data stream and can carry NUL.
git.command('hash-object', [['--stdin']], { stdin: 'a\0b' });

// @ts-expect-error A dynamic value in another token cannot mask a known bad operand.
git.command('log', [['--format', dynamic], { operand: 'a\0b' }, ['-h']]);
// @ts-expect-error A dynamic operand cannot mask a known bad option value.
git.command('log', [['--format', 'a\0b'], { operand: dynamic }, ['-h']]);
// @ts-expect-error Even an unresolved dispatched operation cannot carry a known NUL value.
git.command('config', [{ operand: dynamic }, ['--file', 'a\0b']]);
git.command('config', [{ operand: dynamic }, ['--file', 'path']]);

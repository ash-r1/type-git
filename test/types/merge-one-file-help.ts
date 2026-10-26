import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('merge-one-file', [['-h']]);
git.command('merge-one-file', [{ operand: '-h' }]);
git.command('merge-one-file', [{ operand: '-h' }, { operand: 'ignored' }, ['-h']]);
git.command('merge-one-file', [['-h'], { operand: 'ignored' }, ['-h']]);
git.command('merge-one-file', [['--help'], ['--man']]);
git.command('merge-one-file', [{ operand: 'a' }, { operand: '-h' }, { operand: 'c' }, { operand: 'path' }, { operand: '100644' }, { operand: '120000' }, { operand: '100644' }]);
// @ts-expect-error Only exact first -h preempts ordinary operand arity.
git.command('merge-one-file', [{ operand: 'ordinary' }]);
// @ts-expect-error Empty calls still require seven operands.
git.command('merge-one-file', []);
// @ts-expect-error A later tagged -h does not bypass arity.
git.command('merge-one-file', [{ operand: 'a' }, { operand: '-h' }]);
// @ts-expect-error Canonical -h is first-only before a first-word exit.
git.command('merge-one-file', [{ operand: 'a' }, ['-h']]);
// @ts-expect-error Ignored flags must still have the right shape.
git.command('merge-one-file', [{ operand: '-h' }, ['-h', true]]);
declare const mergeOneFileMaybeHelp: '-h' | 'ordinary';
// @ts-expect-error A mixed first-word value cannot prove early exit.
git.command('merge-one-file', [{ operand: mergeOneFileMaybeHelp }]);
declare const mergeOneFileFirst: readonly ['-h'] | { readonly operand: '-h' };
git.command('merge-one-file', [mergeOneFileFirst, { operand: 'ignored' }]);
declare const mergeOneFileArgs: readonly [{ readonly operand: '-h' }] | readonly [{ readonly operand: 'ordinary' }];
// @ts-expect-error Every argument-list union arm must be valid.
git.command('merge-one-file', mergeOneFileArgs);
// @ts-expect-error No other handwritten command gains a first-word exit.
git.command('unpack-file', [{ operand: '-h' }, { operand: 'ignored' }]);

declare const mergeOneFileValidLists: readonly [{ readonly operand: '-h' }] | readonly [{ readonly operand: 'a' }, { readonly operand: 'b' }, { readonly operand: 'c' }, { readonly operand: 'path' }, { readonly operand: '100644' }, { readonly operand: '120000' }, { readonly operand: '100644' }];
git.command('merge-one-file', mergeOneFileValidLists);

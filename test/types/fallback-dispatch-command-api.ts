import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('config', [{ operand: 'test.value' }]);
git.command('config', [['--edit'], { operand: 'ignored' }]);
git.command('config', [{ operand: 'get' }, ['--all'], { operand: 'test.value' }]);
// @ts-expect-error Child get forbids default with all.
git.command('config', [{ operand: 'get' }, ['--all'], ['--default', ''], { operand: 'test.value' }]);
// @ts-expect-error Explicit edit takes no operands, unlike the legacy --edit action.
git.command('config', [{ operand: 'edit' }, { operand: 'ignored' }]);
// @ts-expect-error A child-only option cannot be used in the fallback grammar.
git.command('config', [['--append'], { operand: 'test.value' }, { operand: 'v' }]);
// @ts-expect-error Implicit action needs at least one operand.
git.command('config', []);
// @ts-expect-error Name-only is unavailable for implicit get.
git.command('config', [['--name-only'], { operand: 'test.value' }]);
// @ts-expect-error Fixed matching needs a value pattern.
git.command('config', [['--get'], ['--fixed-value'], { operand: 'test.value' }]);
git.command('config', [['--get'], ['--fixed-value'], { operand: 'test.value' }, { operand: '' }]);
git.command('stash', [{ operand: 'push' }, { operand: 'tracked' }]);
git.command('stash', [['--'], { operand: 'tracked' }]);
// @ts-expect-error Implicit push needs a separator before non-patch paths.
git.command('stash', [{ operand: 'tracked' }]);
git.command('stash', [{ operand: 'list' }, { operand: '--format=%gd' }]);
// @ts-expect-error Child constraints apply after dispatch.
git.command('stash', [{ operand: 'push' }, ['--patch'], ['--include-untracked']]);
git.command('reflog', [{ operand: 'show' }, ['--format', '%gd']]);
// @ts-expect-error Reflog walking cannot reverse, including through root dispatch.
git.command('reflog', [{ operand: 'show' }, ['--reverse']]);
git.command('reflog', [{ operand: 'exists' }, { operand: 'HEAD' }, { operand: 'extra' }]);
// @ts-expect-error Exists needs at least one reference.
git.command('reflog', [{ operand: 'exists' }]);

import type { RawResult } from '../../src/core/types.js';
import type { BareRepo, WorktreeRepo } from '../../src/core/repo.js';
declare const worktree: WorktreeRepo;
declare const bare: BareRepo;
const bytes: Promise<RawResult<Uint8Array>> = git.command('config', [{ operand: 'get' }, { operand: 'test.value' }], { stdout: 'bytes' });
const worktreeBytes: Promise<RawResult<Uint8Array>> = worktree.command('config', [{ operand: 'get' }, { operand: 'test.value' }], { stdout: 'bytes' });
const bareBytes: Promise<RawResult<Uint8Array>> = bare.command('config', [{ operand: 'get' }, { operand: 'test.value' }], { stdout: 'bytes' });
void [bytes, worktreeBytes, bareBytes];
declare const mixedOperation: 'get' | 'edit';
// @ts-expect-error The edit alternative cannot accept the get operand.
git.command('config', [{ operand: mixedOperation }, { operand: 'test.value' }]);

declare const opaqueOperation: string & { readonly __operation: unique symbol };
git.command('config', [{ operand: opaqueOperation }, ['--all'], { operand: 'test.value' }]);
declare const templateOperation: `g${string}`;
git.command('config', [{ operand: templateOperation }, ['--all'], { operand: 'test.value' }]);

import type { CheckedCommandArguments } from '../../src/commands/types.js';
type MixedDispatchArguments = readonly [
  { readonly operand: 'get' | 'edit' },
  { readonly operand: 'test.value' },
];
type AssertNever<T extends never> = T;
export type MixedDispatchMustRejectEveryAlternative = AssertNever<
  CheckedCommandArguments<'config', MixedDispatchArguments>
>;
declare const validOperation: 'get' | 'unset';
git.command('config', [{ operand: validOperation }, { operand: 'test.value' }]);
declare const mixedUnknownOperation: 'get' | 'invalid-operation';
// @ts-expect-error Both child dispatch and fallback alternatives must accept the arguments.
git.command('config', [{ operand: mixedUnknownOperation }, ['--all'], { operand: 'test.value' }]);

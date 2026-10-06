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

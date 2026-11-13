declare const git: StrictGit;
git.command('scalar version', [['--build-options']]);
git.command('scalar', [{ operand: 'version' }, ['--build-options']]);
git.command('scalar clone', [['--no-maintenance'], { operand: 'url' }]);
git.command('scalar run', [{ operand: 'commit-graph' }]);
// @ts-expect-error Scalar run only recognizes its registered tasks.
git.command('scalar run', [{ operand: 'unknown' }]);
// @ts-expect-error Scalar clone requires a URL.
git.command('scalar clone', []);
// @ts-expect-error Root dispatch selects version's operand restriction.
git.command('scalar', [{ operand: 'version' }, { operand: 'extra' }]);
// @ts-expect-error Scalar list never accepts operands.
git.command('scalar list', [{ operand: 'extra' }]);
git.command('scalar reconfigure', [['--maintenance', 'ignored-without-all']]);
// @ts-expect-error Maintenance mode is validated in all mode.
git.command('scalar reconfigure', [['--all'], ['--maintenance', 'invalid']]);
git.command('scalar reconfigure', [['--all'], ['--maintenance', 'invalid'], ['--maintenance', 'keep']]);
git.command('gitk', [['--select-commit', 'HEAD'], { operand: '--all' }]);
git.command('gitweb', [['--nproc', -1]]);


import type { RawResult } from '../../src/core/types.js';
import type { StrictBareRepo, StrictGit, StrictWorktreeRepo } from '../../src/strict/index.js';
declare const worktree: StrictWorktreeRepo;
declare const bare: StrictBareRepo;
const globalBytes: Promise<RawResult<Uint8Array>> = git.command('scalar version', [], { stdout: 'bytes' });
const worktreeBytes: Promise<RawResult<Uint8Array>> = worktree.command('scalar version', [], { stdout: 'bytes' });
const bareBytes: Promise<RawResult<Uint8Array>> = bare.command('scalar version', [], { stdout: 'bytes' });
void [globalBytes, worktreeBytes, bareBytes];


git.command('scalar', [['-c', 'test.fixture=yes'], { operand: 'version' }, ['--build-options']]);
// @ts-expect-error Child arity still applies after Scalar global options.
git.command('scalar', [['-c', 'test.fixture=yes'], { operand: 'version' }, { operand: 'extra' }]);
declare const prefixedOperation: 'version' | 'delete';
// @ts-expect-error Every operation alternative must accept the arguments after global options.
git.command('scalar', [['-c', 'test.fixture=yes'], { operand: prefixedOperation }]);

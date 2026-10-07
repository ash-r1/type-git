import type { Git } from '../../src/core/git.js';
import type { GitCommandArgument } from '../../src/commands/types.js';
declare const git: Git;
git.command('lfs version', []);
git.command('lfs pointer', [['--file', 'file.bin']]);
git.command('lfs pointer', [['--check'], ['--stdin']], { stdin: 'pointer' });
git.command('lfs checkout', [['--ours'], ['--to', 'out'], { operand: 'file' }]);
git.command('lfs checkout', [['--ours'], ['--ours', false]]);
git.command('lfs checkout', [['--ours'], ['--ours', false], ['--theirs'], ['--to', 'out'], { operand: 'file' }]);
git.command('lfs migrate info', [['--pointers', 'ignored earlier'], ['--pointers', 'ignore']]);
git.command('lfs status', [['--porcelain']]);
git.command('lfs checkout', [['--ours'], ['--theirs'], ['--help']]);
// @ts-expect-error unknown command name
git.command('lfs unknown-command', []);
// @ts-expect-error unknown option
git.command('lfs checkout', [['--include', '*.bin']]);
// @ts-expect-error missing value
git.command('lfs pointer', [['--file']]);
// @ts-expect-error numeric option requires a number
git.command('lfs locks', [['--limit', 'one']]);
// @ts-expect-error conflict stages cannot both be selected
git.command('lfs checkout', [['--ours'], ['--theirs'], ['--to', 'out'], { operand: 'file' }]);
// @ts-expect-error conflict stage requires a destination
git.command('lfs checkout', [['--ours']]);
// @ts-expect-error destination requires a stage
git.command('lfs checkout', [['--to', 'out']]);
// @ts-expect-error check cannot take pointer comparison input
git.command('lfs pointer', [['--check'], ['--pointer', 'pointer']]);
// @ts-expect-error prune verification modes conflict
git.command('lfs prune', [['--verify-remote'], ['--no-verify-remote']]);
// @ts-expect-error fetch json and prune conflict
git.command('lfs fetch', [['--json'], ['--prune']]);
// @ts-expect-error config scopes are exclusive
git.command('lfs install', [['--local'], ['--system']]);
// @ts-expect-error unknown behavior
git.command('lfs prune', [['--when-unverified', 'ignore']]);
export const dynamic: GitCommandArgument<'lfs pointer'>[] = [['--file', 'file.bin']];
git.command('lfs pointer', dynamic);

// @ts-expect-error conflict checkout needs exactly one operand
git.command('lfs checkout', [['--ours'], ['--to', 'out']]);
// @ts-expect-error conflict checkout cannot take multiple operands
git.command('lfs checkout', [['--ours'], ['--to', 'out'], { operand: 'a' }, { operand: 'b' }]);
// @ts-expect-error post-checkout hook requires three operands
git.command('lfs post-checkout', [{ operand: 'old' }, { operand: 'new' }]);
git.command('lfs post-checkout', [{ operand: 'old' }, { operand: 'new' }, { operand: '1' }]);
// @ts-expect-error stdin fetch does not take command-line refs after the remote
git.command('lfs fetch', [['--stdin'], { operand: 'origin' }, { operand: 'main' }]);
// @ts-expect-error ordinary push requires a ref without --all or --stdin
git.command('lfs push', [{ operand: 'origin' }]);
git.command('lfs push', [['--all'], { operand: 'origin' }]);
git.command('lfs push', [['--stdin'], { operand: 'origin' }]);
// @ts-expect-error unknown completion shell
git.command('lfs completion', [{ operand: 'powershell' }]);
git.command('lfs completion', [{ operand: 'bash' }]);

// Native parse-options flags use explicit negated spellings, never --flag=false.
git.command('hash-object', []);
git.command('hash-object', [['--stdin']], { stdin: 'hello' });
git.command('hash-object', [['--stdin'], ['--no-stdin'], ['--stdin']]);
git.command('hash-object', [['--path', 'file'], ['--no-path'], ['--no-filters']]);
git.command('hash-object', [['--no-filters'], ['--filters'], ['--path', 'file']]);
// @ts-expect-error Git rejects repeated stdin object requests.
git.command('hash-object', [['--stdin'], ['--stdin']]);
// @ts-expect-error Stdin paths and explicit files cannot be combined.
git.command('hash-object', [['--stdin-paths'], { operand: 'file' }]);
// @ts-expect-error Attribute paths require filters.
git.command('hash-object', [['--path', 'file'], ['--no-filters']]);
// @ts-expect-error Native Git flags do not accept Cobra boolean values.
git.command('hash-object', [['--stdin', false]]);
// @ts-expect-error Options cannot follow an explicit end-of-options marker.
git.command('hash-object', [['--'], ['--stdin']]);

git.command('remote add', [['--mirror'], { operand: 'origin' }, { operand: '.' }]);
git.command('remote add', [['--mirror', 'push'], ['--track', ''], ['--no-track'], { operand: 'origin' }, { operand: '.' }]);
git.command('remote show', [['-v'], ['-n'], { operand: 'origin' }]);
git.command('remote set-head', [['--auto'], { operand: 'origin' }]);
git.command('add', [['--all'], ['--ignore-removal'], ['--update']]);
git.command('add', [['--interactive'], ['--chmod', 'ignored']]);
git.command('add', [['--unified', -1]]);
git.command('rm', [['--pathspec-from-file', '-']], { stdin: 'file' });
git.command('mv', [{ operand: 'old' }, { operand: 'new' }]);
// @ts-expect-error Two operands are required.
git.command('remote add', [{ operand: 'origin' }]);
// @ts-expect-error An empty track value is still an entry for native Git.
git.command('remote add', [['--mirror', 'push'], ['--track', ''], { operand: 'origin' }, { operand: '.' }]);
// @ts-expect-error Automatic and explicit remote head modes differ in arity.
git.command('remote set-head', [['--auto'], { operand: 'origin' }, { operand: 'main' }]);
// @ts-expect-error Independent all and update flags conflict in noninteractive mode.
git.command('add', [['--all'], ['--update']]);
// @ts-expect-error An executable mode is validated outside interactive mode.
git.command('add', [['--chmod', 'invalid']]);
// @ts-expect-error A pathspec file replaces explicit paths.
git.command('rm', [['--pathspec-from-file', '-'], { operand: 'file' }]);
// @ts-expect-error Missing destination.
git.command('mv', [{ operand: 'old' }]);
// @ts-expect-error Ignored-only and all-untracked modes conflict.
git.command('clean', [['-x'], ['-X']]);

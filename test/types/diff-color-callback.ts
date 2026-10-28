import type { Git, GitCommandArgument } from '../../src/index.js';
declare const git: Git;
declare const colorOrPrefix: '--color' | '--src-prefix';

// diff: accepted modes are ASCII case insensitive; the bare option means always.
git.command('diff', [['--color', 'AuTo'], ['-h']]);
git.command('diff', [['--color'], ['-h']]);
// @ts-expect-error Invalid color callbacks before help are reached.
git.command('diff', [['--color', 'invalid'], ['-h']]);
// @ts-expect-error Every possible reached flag must accept its value.
git.command('diff', [[colorOrPrefix, 'invalid'], ['-h']]);
// @ts-expect-error This parser continues checking color callbacks after short help.
git.command('diff', [['-h'], ['--color', 'invalid']]);
// @ts-expect-error Even ignored color values cannot contain NUL.
git.command('diff', [['-h'], ['--color', '\0']]);

// diff-files: accepted modes are ASCII case insensitive; the bare option means always.
git.command('diff-files', [['--color', 'AuTo'], ['-h']]);
git.command('diff-files', [['--color'], ['-h']]);
// @ts-expect-error Invalid color callbacks before help are reached.
git.command('diff-files', [['--color', 'invalid'], ['-h']]);
// @ts-expect-error Every possible reached flag must accept its value.
git.command('diff-files', [[colorOrPrefix, 'invalid'], ['-h']]);
// @ts-expect-error This parser continues checking color callbacks after short help.
git.command('diff-files', [['-h'], ['--color', 'invalid']]);
// @ts-expect-error Even ignored color values cannot contain NUL.
git.command('diff-files', [['-h'], ['--color', '\0']]);

// diff-index: accepted modes are ASCII case insensitive; the bare option means always.
git.command('diff-index', [['--color', 'AuTo'], ['-h']]);
git.command('diff-index', [['--color'], ['-h']]);
// @ts-expect-error Invalid color callbacks before help are reached.
git.command('diff-index', [['--color', 'invalid'], ['-h']]);
// @ts-expect-error Every possible reached flag must accept its value.
git.command('diff-index', [[colorOrPrefix, 'invalid'], ['-h']]);
// @ts-expect-error This parser continues checking color callbacks after short help.
git.command('diff-index', [['-h'], ['--color', 'invalid']]);
// @ts-expect-error Even ignored color values cannot contain NUL.
git.command('diff-index', [['-h'], ['--color', '\0']]);

// diff-tree: accepted modes are ASCII case insensitive; the bare option means always.
git.command('diff-tree', [['--color', 'AuTo'], ['-h']]);
git.command('diff-tree', [['--color'], ['-h']]);
// @ts-expect-error Invalid color callbacks before help are reached.
git.command('diff-tree', [['--color', 'invalid'], ['-h']]);
// @ts-expect-error Every possible reached flag must accept its value.
git.command('diff-tree', [[colorOrPrefix, 'invalid'], ['-h']]);
// @ts-expect-error This parser continues checking color callbacks after short help.
git.command('diff-tree', [['-h'], ['--color', 'invalid']]);
// @ts-expect-error Even ignored color values cannot contain NUL.
git.command('diff-tree', [['-h'], ['--color', '\0']]);

// rev-list: accepted modes are ASCII case insensitive; the bare option means always.
git.command('rev-list', [['--color', 'AuTo'], ['-h']]);
git.command('rev-list', [['--color'], ['-h']]);
// @ts-expect-error Invalid color callbacks before help are reached.
git.command('rev-list', [['--color', 'invalid'], ['-h']]);
// @ts-expect-error Every possible reached flag must accept its value.
git.command('rev-list', [[colorOrPrefix, 'invalid'], ['-h']]);
// @ts-expect-error This parser continues checking color callbacks after short help.
git.command('rev-list', [['-h'], ['--color', 'invalid']]);
// @ts-expect-error Even ignored color values cannot contain NUL.
git.command('rev-list', [['-h'], ['--color', '\0']]);

// diff --no-index: accepted modes are ASCII case insensitive; the bare option means always.
git.command('diff --no-index', [['--color', 'AuTo'], ['-h']]);
git.command('diff --no-index', [['--color'], ['-h']]);
// @ts-expect-error Invalid color callbacks before help are reached.
git.command('diff --no-index', [['--color', 'invalid'], ['-h']]);
// @ts-expect-error Every possible reached flag must accept its value.
git.command('diff --no-index', [[colorOrPrefix, 'invalid'], ['-h']]);
// Native local usage stops before the later callback.
git.command('diff --no-index', [['-h'], ['--color', 'invalid']]);
git.command('diff --no-index', [['-h'], ['--unknown-tail', 'kept']]);
// @ts-expect-error Even ignored color values cannot contain NUL.
git.command('diff --no-index', [['-h'], ['--color', '\0']]);

// range-diff: accepted modes are ASCII case insensitive; the bare option means always.
git.command('range-diff', [['--color', 'AuTo'], ['-h']]);
git.command('range-diff', [['--color'], ['-h']]);
// @ts-expect-error Invalid color callbacks before help are reached.
git.command('range-diff', [['--color', 'invalid'], ['-h']]);
// @ts-expect-error Every possible reached flag must accept its value.
git.command('range-diff', [[colorOrPrefix, 'invalid'], ['-h']]);
// Native local usage stops before the later callback.
git.command('range-diff', [['-h'], ['--color', 'invalid']]);
git.command('range-diff', [['-h'], ['--unknown-tail', 'kept']]);
// @ts-expect-error Even ignored color values cannot contain NUL.
git.command('range-diff', [['-h'], ['--color', '\0']]);

// diff-pairs: accepted modes are ASCII case insensitive; the bare option means always.
git.command('diff-pairs', [['--color', 'AuTo'], ['-h']]);
git.command('diff-pairs', [['--color'], ['-h']]);
// @ts-expect-error Invalid color callbacks before help are reached.
git.command('diff-pairs', [['--color', 'invalid'], ['-h']]);
// @ts-expect-error Every possible reached flag must accept its value.
git.command('diff-pairs', [[colorOrPrefix, 'invalid'], ['-h']]);
// Native local usage stops before the later callback.
git.command('diff-pairs', [['-h'], ['--color', 'invalid']]);
git.command('diff-pairs', [['-h'], ['--unknown-tail', 'kept']]);
// @ts-expect-error Even ignored color values cannot contain NUL.
git.command('diff-pairs', [['-h'], ['--color', '\0']]);

// backfill: accepted modes are ASCII case insensitive; the bare option means always.
git.command('backfill', [['--color', 'AuTo'], ['-h']]);
git.command('backfill', [['--color'], ['-h']]);
// The initial parse-options help exit precedes retained revision callbacks.
git.command('backfill', [['--color', 'invalid'], ['-h']]);
git.command('backfill', [['-h'], ['--color', 'invalid']]);
// @ts-expect-error Reached retained color callbacks reject invalid modes.
git.command('backfill', [['--color', 'invalid']]);
// @ts-expect-error Even ignored color values cannot contain NUL.
git.command('backfill', [['-h'], ['--color', '\0']]);

// last-modified: accepted modes are ASCII case insensitive; the bare option means always.
git.command('last-modified', [['--color', 'AuTo'], ['-h']]);
git.command('last-modified', [['--color'], ['-h']]);
// The initial parse-options help exit precedes retained revision callbacks.
git.command('last-modified', [['--color', 'invalid'], ['-h']]);
git.command('last-modified', [['-h'], ['--color', 'invalid']]);
// @ts-expect-error Reached retained color callbacks reject invalid modes.
git.command('last-modified', [['--color', 'invalid']]);
// @ts-expect-error Even ignored color values cannot contain NUL.
git.command('last-modified', [['-h'], ['--color', '\0']]);

// replay: accepted modes are ASCII case insensitive; the bare option means always.
git.command('replay', [['--color', 'AuTo'], ['-h']]);
git.command('replay', [['--color'], ['-h']]);
// The initial parse-options help exit precedes retained revision callbacks.
git.command('replay', [['--color', 'invalid'], ['-h']]);
git.command('replay', [['-h'], ['--color', 'invalid']]);
// @ts-expect-error Reached retained color callbacks reject invalid modes.
git.command('replay', [['--color', 'invalid']]);
// @ts-expect-error Even ignored color values cannot contain NUL.
git.command('replay', [['-h'], ['--color', '\0']]);

// Usage exits do not widen ordinary dynamic enum vocabulary.
// @ts-expect-error Unknown word-diff styles remain outside the ordinary argument type.
export const invalidNoIndexWordDiff: readonly GitCommandArgument<'diff --no-index'>[] = [['--word-diff', 'invalid']];

// Full usage follows the same initial parser exit for deferred callbacks.
git.command('backfill', [['--color', 'invalid'], ['--help-all']]);
git.command('backfill', [['--help-all'], ['--color', 'invalid']]);
git.command('last-modified', [['--color', 'invalid'], ['--help-all']]);
git.command('last-modified', [['--help-all'], ['--color', 'invalid']]);
git.command('replay', [['--color', 'invalid'], ['--help-all']]);
git.command('replay', [['--help-all'], ['--color', 'invalid']]);
// @ts-expect-error Multiword full help is not an early revision-parser exit.
git.command('diff-files', [['--color', 'always'], ['--help-all']]);
// @ts-expect-error Multiword full help is not an early revision-parser exit.
git.command('diff-index', [['--color', 'always'], ['--help-all']]);
// @ts-expect-error Multiword full help is not an early revision-parser exit.
git.command('diff-tree', [['--color', 'always'], ['--help-all']]);
// @ts-expect-error Multiword full help is not an early revision-parser exit.
git.command('rev-list', [['--color', 'always'], ['--help-all']]);

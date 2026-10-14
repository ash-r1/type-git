import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('svn clone', [['--log-window-size', '18446744073709551616'], ['-h']]);
git.command('svn clone', [['--log-window-size', 18446744073709551616n], ['-h']]);
git.command('svn clone', [['--log-window-size', '1_000'], ['-h']]);
git.command('svn clone', [['--log-window-size', '1\n'], ['-h']]);
declare const integerText: `${number}`;
git.command('svn clone', [['--log-window-size', integerText], ['-h']]);
declare const opaqueIntegerText: string & { readonly integerInput: unique symbol };
git.command('svn clone', [['--log-window-size', opaqueIntegerText], ['-h']]);
declare const invalidOrOpaqueInteger: '1x' | typeof opaqueIntegerText;
// @ts-expect-error An opaque alternative does not repair a known invalid alternative.
git.command('svn clone', [['--log-window-size', invalidOrOpaqueInteger], ['-h']]);
// @ts-expect-error Getopt::Long rejects invalid integer literals before help.
git.command('svn clone', [['--log-window-size', '1x'], ['-h']]);
// @ts-expect-error The integer parser is decimal, not hexadecimal.
git.command('svn clone', [['--log-window-size', '0x10'], ['-h']]);
// @ts-expect-error Perl permits only one final LF.
git.command('svn clone', [['--log-window-size', '1\n\n'], ['-h']]);
// @ts-expect-error Unicode line separators are not the Perl final LF.
git.command('svn clone', [['--log-window-size', '1\u2028'], ['-h']]);
// @ts-expect-error The supplied number must serialize as an integer.
git.command('svn clone', [['--log-window-size', 1.5], ['-h']]);
git.command('svn', [{ operand: 'fetch' }, ['--revision', '1:5']]);
git.command('svn clone', [['--trunk', 'trunk'], ['--branches', 'a'], ['--branches', 'b'], { operand: 'file:///fixture' }]);
// @ts-expect-error Fetch takes at most one remote.
git.command('svn fetch', [{ operand: 'a' }, { operand: 'b' }]);
// @ts-expect-error Branch names cannot be empty.
git.command('svn branch', [{ operand: '' }]);
// @ts-expect-error Perl treats the string zero as false.
git.command('svn find-rev', [{ operand: '0' }]);
// @ts-expect-error A property value is required.
git.command('svn propset', [{ operand: 'name' }]);
git.command('svn propset', [{ operand: '' }, { operand: '' }]);
git.command('svn find-rev', [['--before'], ['--after'], { operand: 'r1' }]);
git.command('svn commit-diff', [{ operand: 'one' }, { operand: 'two' }]);
// @ts-expect-error Both explicit message sources conflict, even when empty.
git.command('svn commit-diff', [['-m', ''], ['-F', ''], { operand: 'one' }, { operand: 'two' }]);
// @ts-expect-error Metadata initialization permits only one field.
git.command('svn init', [['--rewrite-root', ''], ['--rewrite-uuid', '']]);
git.command('svn multi-init', []);
git.command('svn reset', []);
git.command('svn dcommit', [['-i', 'id'], ['--interactive']]);
// @ts-expect-error The global id declaration replaces dcommit's -i alias.
git.command('svn dcommit', [['-i']]);
// @ts-expect-error mixedCase fields are config-only, removed before GetOptions.
git.command('svn fetch', [['--noMetadata']]);
git.command('svn log', [{ operand: '--all' }, ['--limit', 2]]);
git.command('svn clone', [['--version']]);

// Long valid integer literals defer to runtime rather than imposing a compiler-size Git limit.
git.command('svn clone', [['--log-window-size', '111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111'], ['-h']]);

// Every expansion of these templates is rejected by native Getopt::Long.
declare const invalidIntegerPrefix: `x${string}`;
declare const invalidIntegerSuffix: `${number}x`;
// @ts-expect-error An unknown tail cannot repair a known invalid integer prefix.
git.command('svn clone', [['--log-window-size', invalidIntegerPrefix], ['-h']]);
// @ts-expect-error A known invalid suffix remains invalid with a dynamic numeric prefix.
git.command('svn clone', [['--log-window-size', invalidIntegerSuffix], ['-h']]);

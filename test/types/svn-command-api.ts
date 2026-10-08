import type { Git } from '../../src/core/git.js';
declare const git: Git;
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

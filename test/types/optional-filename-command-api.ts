import type { GitCommandClient } from '../../src/commands/types.js';
declare const git: GitCommandClient;

// Native Git 2.25/2.47 clears the supplied filename on negation. An unknown
// selected filename parser profile must defer this valid possibility to runtime.
git.command('tag', [['--list'], ['--file', 'message'], ['--no-file']]);

// Native Git 2.55/2.56 ignores a missing optional file. A literal path does not
// establish its existence, so this must defer the filesystem-dependent state.
git.command('tag', [['--list'], ['--file', ':(optional)missing']]);

// A retained ordinary filename conflicts with listing in every observed profile.
// @ts-expect-error ordinary filename cannot be used for tag listing
git.command('tag', [['--list'], ['--file', 'message']]);

declare const mixed: 'message' | ':(optional)missing';
// A possibly valid filesystem state must not erase a known-invalid input arm.
// @ts-expect-error the ordinary filename arm is invalid on every profile
git.command('tag', [['--list'], ['--file', mixed]]);

declare const mixedEmpty: '' | 'message';
// @ts-expect-error the retained ordinary filename remains invalid despite the empty arm
git.command('tag', [['--list'], ['--file', mixedEmpty]]);

// Optional-file uncertainty retains a prior ordinary filename when absent.
// @ts-expect-error assigning or ignoring this optional update cannot clear the prior file
git.command('tag', [['--list'], ['--file', 'message'], ['--file', ':(optional)missing']]);

// An ordinary later assignment restores a guaranteed conflict.
// @ts-expect-error ordinary filename remains active after the optional update
git.command('tag', [['--list'], ['--file', ':(optional)missing'], ['--file', 'message']]);

declare const optionalPaths: ':(optional)one' | ':(optional)two';
git.command('tag', [['--list'], ['--file', optionalPaths]]);

declare const optionalOrEmpty: '' | ':(optional)missing';
// Both arms can leave the filename unset on a supported native profile.
git.command('tag', [['--list'], ['--file', optionalOrEmpty]]);

// @ts-expect-error a bare optional marker cannot name a missing file
git.command('tag', [['--list'], ['--file', ':(optional)']]);

// Actual Git 2.55/2.56 commits successfully when the message file is missing
// while the optional pathspec file exists. Existence alternatives must be per
// filename, rather than one global all-present/all-missing assumption.
git.command('commit', [
  ['-m', 'mixed states'],
  ['--file', ':(optional)absent'],
  ['--pathspec-from-file', ':(optional)paths'],
  ['--pathspec-file-nul'],
]);

declare const mixedMessage: 'message' | ':(optional)absent';
// @ts-expect-error the ordinary message-file arm conflicts with -m in every filesystem state
git.command('commit', [['-m', 'mixed states'], ['--file', mixedMessage], ['--pathspec-from-file', ':(optional)paths'], ['--pathspec-file-nul']]);

// @ts-expect-error choosing another field's state cannot clear an ordinary message file
git.command('commit', [['-m', 'mixed states'], ['--file', 'message'], ['--pathspec-from-file', ':(optional)paths'], ['--pathspec-file-nul']]);

// The required pathspec can remain present while an optional message update is ignored.
git.command('commit', [['--pathspec-from-file', ':(optional)paths'], ['--file', ':(optional)absent'], ['-m', 'mixed states'], ['--pathspec-file-nul']]);

// Distinct optional paths can be absent and present in the same field's update sequence.
git.command('tag', [['--list'], ['--file',':(optional)first'], ['--file','']]);

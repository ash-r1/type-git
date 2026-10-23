import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('log', [['--date', 'iso8601-strict-local']]);
git.command('log', [['--date', 'local']]);
git.command('show', [['--date', 'format:']]);
git.command('log', [['--date', 'format-local:%Y-%m-%d']]);
// auto: suffix interpretation depends on native stdout/pager state.
git.command('log', [['--date', 'auto:invalid']]);
git.command('log', [['--date', 'auto:']]);
git.command('log', [['--date', 'auto:auto:invalid']]);
declare const dynamic: string;
git.command('log', [['--date', dynamic]]);
git.command('log', [['-h'], ['--date', 'invalid']]);
// @ts-expect-error Unknown date formats are rejected by the immediate callback.
git.command('log', [['--date', 'invalid']]);
// @ts-expect-error strftime format requires a colon.
git.command('log', [['--date', 'format']]);
// @ts-expect-error The local suffix is accepted only once.
git.command('log', [['--date', 'iso-local-local']]);
// @ts-expect-error Date mode names are case-sensitive.
git.command('log', [['--date', 'ISO']]);
// @ts-expect-error Empty direct date mode is invalid.
git.command('log', [['--date', '']]);
// @ts-expect-error A later valid mode cannot repair an immediate callback error.
git.command('log', [['--date', 'invalid'], ['--date', 'iso']]);
// log first-pass help preempts its revision callback, in either argv order.
git.command('log', [['--date', 'invalid'], ['-h']]);
declare const mode: 'iso' | 'invalid';
// @ts-expect-error Every known literal alternative must satisfy the callback.
git.command('log', [['--date', mode]]);

// No stash ref returns success before invoking the log date callback.
git.command('stash list', [['--date', 'invalid']]);

// The initial pass exits before this retained callback.
git.command('backfill', [['--date', 'invalid'], ['-h']]);
// Native-owned until these interleaved parser phases are modeled.
git.command('blame', [['-h'], ['--date', 'invalid']]);
git.command('annotate', [['--date', 'invalid'], { operand: 'file' }]);

import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('shell', []);
git.command('shell', [['-c', 'custom argument']]);
git.command('shell', [{ operand: 'cvs server' }]);
// @ts-expect-error Command mode takes no extra words.
git.command('shell', [['-c', 'custom'], { operand: 'extra' }]);
// @ts-expect-error Repeating -c is a native argc error.
git.command('shell', [['-c', 'custom'], ['-c', 'custom']]);
// @ts-expect-error Only the special compatibility word is accepted without -c.
git.command('shell', [{ operand: 'custom' }]);
git.command('filter-branch', [['--env-filter', ':'], ['--'], { operand: 'HEAD' }]);
// @ts-expect-error Even an empty explicit commit filter conflicts with prune-empty.
git.command('filter-branch', [['--prune-empty'], ['--commit-filter', '']]);
git.command('quiltimport', [['--dry-run'], { operand: 'ignored' }]);
git.command('instaweb', [{ operand: 'start' }, { operand: 'stop' }]);
// @ts-expect-error All action words are checked, not just operand zero.
git.command('instaweb', [{ operand: 'stop' }, { operand: 'unknown' }]);
git.command('instaweb stop', [['--port', 'unvalidated-by-stop']]);
// @ts-expect-error Git installs this as a sourced library, not a standalone command.
git.command('sh-setup', [{ operand: '-h' }]);

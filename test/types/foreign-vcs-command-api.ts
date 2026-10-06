import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('archimport', [['-D', 'arbitrary'], { operand: 'archive/branch' }]);
// @ts-expect-error Arch has no implemented -o despite its usage text.
git.command('archimport', [['-o', 'branch'], { operand: 'archive/branch' }]);
// @ts-expect-error Arch requires a target.
git.command('archimport', []);
git.command('cvsimport', [['-M', 'one'], ['-M', 'two'], { operand: 'module' }]);
// @ts-expect-error CVS import accepts at most one module.
git.command('cvsimport', [{ operand: 'one' }, { operand: 'two' }]);
git.command('cvsexportcommit', [{ operand: 'ignored' }, { operand: 'parent' }, { operand: 'commit' }]);
// @ts-expect-error CVS export requires at least one commit identifier.
git.command('cvsexportcommit', []);
git.command('cvsserver', [['--export-all'], ['--version']]);
// @ts-expect-error Method selector is not a root directory.
git.command('cvsserver', [['--export-all'], { operand: 'server' }]);
git.command('cvsserver server', [['--export-all'], { operand: '/root' }]);
// @ts-expect-error Version-less export requires an explicit root.
git.command('cvsserver pserver', [['--export-all']]);

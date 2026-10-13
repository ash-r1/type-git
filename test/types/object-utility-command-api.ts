import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('cat-file', [['-t'], { operand: 'HEAD' }]);
git.command('cat-file', [{ operand: 'commit' }, { operand: 'HEAD' }]);
git.command('cat-file', [['--batch'], ['--textconv'], ['--path', 'tracked'], { operand: 'ignored' }]);
git.command('cat-file', [['--unordered'], ['-t'], { operand: 'HEAD' }]);
// @ts-expect-error Same batch option cannot be repeated.
git.command('cat-file', [['--batch'], ['--batch']]);
// @ts-expect-error Different batch options also conflict, before help.
git.command('cat-file', [['--batch'], ['--batch-check'], ['-h']]);
// @ts-expect-error Even the disabled buffer setting requires batch mode.
git.command('cat-file', [['--no-buffer'], ['-t'], { operand: 'HEAD' }]);
// @ts-expect-error Batch query modes reject operands.
git.command('cat-file', [['--batch-check'], { operand: 'HEAD' }]);
// @ts-expect-error Single-object queries cannot combine with batch mode.
git.command('cat-file', [['-s'], ['--batch']]);
git.command('repack', [['-a'], ['-b'], ['--no-write-midx'], { operand: 'ignored' }]);
git.command('repack', [['--write-midx', 'incremental']]);
git.command('repack', [['--write-midx', '']]);
// @ts-expect-error Unknown callback value cannot be overwritten.
git.command('repack', [['--write-midx', 'bad'], ['--no-write-midx']]);
// @ts-expect-error Unreachable strategies are exclusive.
git.command('repack', [['-A'], ['--cruft']]);
// @ts-expect-error Explicit bitmap writing with MIDX disabled requires a full repack.
git.command('repack', [['-b'], ['--no-write-midx']]);
// @ts-expect-error Filter output requires a filter.
git.command('repack', [['--filter-to', 'out']]);
git.command('replace', []);
git.command('replace', [['--format', ''], ['--list']]);
git.command('replace', [['--format', 'bad earlier'], ['--format', 'short']]);
git.command('replace', [{ operand: 'old' }, { operand: 'new' }]);
git.command('replace', [['--graft'], { operand: 'HEAD' }]);
// @ts-expect-error Implicit replacement requires two objects.
git.command('replace', [{ operand: 'old' }]);
// @ts-expect-error Force cannot apply to implicit listing.
git.command('replace', [['--force']]);
// @ts-expect-error Raw requires edit mode.
git.command('replace', [['--raw'], { operand: 'old' }, { operand: 'new' }]);
// @ts-expect-error Delete cannot have a listing format.
git.command('replace', [['--delete'], ['--format', 'short'], { operand: 'old' }]);
git.command('rerere', []);
git.command('rerere', [{ operand: 'status' }, { operand: 'ignored' }]);
// @ts-expect-error Unknown rerere operation.
git.command('rerere', [{ operand: 'unknown' }]);
git.command('rerere clear', [{ operand: 'ignored' }]);
git.command('rerere forget', []);
git.command('rerere diff', []);
git.command('rerere status', []);
git.command('rerere remaining', []);
git.command('rerere gc', []);
git.command('for-each-repo', [['--config', 'missing.repos']]);
git.command('for-each-repo', [['--config', 'example.repos'], { operand: 'status' }, { operand: '--short' }]);
// @ts-expect-error The configuration key is required.
git.command('for-each-repo', [{ operand: 'status' }]);
git.command('column', [['--mode', 'column'], ['--width', 40]]);
// @ts-expect-error Column takes no operands.
git.command('column', [{ operand: 'extra' }]);
git.command('fmt-merge-msg', [['--log', -1], ['-m', 'message']]);
git.command('bugreport', [['--diagnose', 'stats'], ['--no-suffix']]);
// @ts-expect-error Diagnose callback values are case-sensitive.
git.command('bugreport', [['--diagnose', 'STATS']]);
git.command('diagnose', [['--mode', 'all'], { operand: 'ignored' }]);
git.command('version', [['--build-options'], { operand: 'ignored' }]);
git.command('var', [['-l']]);
git.command('var', [{ operand: 'GIT_AUTHOR_IDENT' }]);
// @ts-expect-error Unknown native variable.
git.command('var', [{ operand: 'UNKNOWN' }]);
// @ts-expect-error Native manual parser requires a single word.
git.command('var', [['-l'], ['-l']]);

// @ts-expect-error An incremental bitmap request requires an explicit MIDX writer.
git.command('repack', [['-b']]);
git.command('repack', [['-b'], ['-m']]);

import type { Git } from '../../src/core/git.js';
declare const git: Git;
declare const dynamic: string;
git.command('clone', [['--filter', 'auto'], { operand: 'source' }]);
git.command('fetch', [['--filter', 'blob:limit= 0x10K'], ['--filter', 'tree:+077m']]);
git.command('fetch', [['--filter', 'combine:+blob:none++tree:1'], ['--filter', dynamic]]);
git.command('fetch', [['--filter', 'sparse:oid=']]);
git.command('fetch', [['--filter', 'combine:sparse:oid=%00']]);
git.command('fetch', [['--filter', 'blob:none'], ['--no-filter'], ['--filter', 'auto']]);
git.command('fetch', [['--filter', 'combine:blob:none'], ['--filter', 'tree:1'], ['--no-filter'], ['--filter', 'auto']]);
git.command('fetch', [['--filter', 'blob:none'], ['--no-filter'], ['--filter', 'tree:1'], ['--no-filter'], ['--filter', 'auto']]);
// @ts-expect-error invalid filter spelling
git.command('fetch', [['--filter', 'blob:None']]);
// @ts-expect-error invalid octal number
git.command('fetch', [['--filter', 'tree:08']]);
// @ts-expect-error negative unsigned limit
git.command('fetch', [['--filter', 'blob:limit=-1']]);
// @ts-expect-error dropped filter syntax
git.command('fetch', [['--filter', 'sparse:path=file']]);
// @ts-expect-error object type enum
git.command('fetch', [['--filter', 'object:type=delta']]);
// @ts-expect-error combine requires a suffix
git.command('fetch', [['--filter', 'combine:']]);
// @ts-expect-error auto is not a subfilter
git.command('fetch', [['--filter', 'combine:blob:none+auto']]);
// @ts-expect-error raw reserved character must be escaped
git.command('fetch', [['--filter', 'combine:sparse:oid=a b']]);
// @ts-expect-error repeated auto is rejected
git.command('fetch', [['--filter', 'auto'], ['--filter', 'auto']]);
// @ts-expect-error auto cannot follow an active filter
git.command('fetch', [['--filter', 'blob:none'], ['--filter', 'auto']]);
// @ts-expect-error auto cannot precede another filter
git.command('clone', [['--filter', 'auto'], ['--filter', 'tree:1'], { operand: 'source' }]);
// @ts-expect-error implicit combination permanently clears allow_auto_filter
git.command('fetch', [['--filter', 'blob:none'], ['--filter', 'tree:1'], ['--no-filter'], ['--filter', 'auto']]);
// @ts-expect-error cat-file does not allow auto, including before help
git.command('cat-file', [['--filter', 'auto'], ['-h']]);
// @ts-expect-error revision filter values are checked too
git.command('rev-list', [['--objects'], ['--filter', 'tree:bad'], { operand: 'HEAD' }]);

// Unknown filter choices retain runtime validation rather than assuming a simple filter.
git.command('fetch', [['--filter', dynamic], ['--filter', 'tree:1'], ['--no-filter'], ['--filter', 'auto']]);

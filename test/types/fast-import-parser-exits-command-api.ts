import type { Git } from '../../src/core/git.js';
declare const git: Git;

git.command('fast-import', [['-h'], ['--signed-tags', 'bad']]);
git.command('fast-import', [['--quiet'], ['--help'], ['--signed-commits', 'bad']]);
git.command('fast-import', [['-h'], ['--date-format', 'bad']]);
git.command('fast-import', [['-h'], ['--depth', 8192]]);
git.command('fast-import', [['-h'], ['--active-branches', -1]]);
git.command('fast-import', [['-h'], ['--active-branches', 9007199254740992]]);
git.command('fast-import', [['-h'], ['--active-branches', Number.POSITIVE_INFINITY]]);
git.command('fast-import', [['-h'], ['--cat-blob-fd', 2147483648]]);
git.command('fast-import', [['-h'], { operand: '--unknown' }, { operand: 'unused' }]);
git.command('fast-import', [['-h'], ['--signed-tags', null as unknown as 'bad' | 'verbatim']]);
// @ts-expect-error A reached signing callback fails before the help word.
git.command('fast-import', [['--signed-tags', 'bad'], ['-h']]);
// @ts-expect-error Every reached enum value must be valid.
git.command('fast-import', [['--signed-tags', null as unknown as 'bad' | 'verbatim'], ['-h']]);
// @ts-expect-error The reached date-format callback remains constrained.
git.command('fast-import', [['--date-format', 'bad'], ['-h']]);
// @ts-expect-error The reached depth callback enforces MAX_DEPTH.
git.command('fast-import', [['--depth', 8192], ['-h']]);
// @ts-expect-error A reached file descriptor callback remains bounded.
git.command('fast-import', [['--cat-blob-fd', 2147483648], ['-h']]);
// @ts-expect-error A help word after -- is a literal operand.
git.command('fast-import', [['--'], { operand: '-h' }]);
// @ts-expect-error Ignored tail values still must be representable in argv.
git.command('fast-import', [['-h'], ['--signed-tags', 'bad\0']]);
// @ts-expect-error Ignored tail operands still must be representable in argv.
git.command('fast-import', [['-h'], { operand: 'bad\0' }]);

git.command('fast-import', [['--help-all'], ['--signed-tags', 'bad']]);

git.command('fast-import', [['-h'], ['--active-branches', Number.NaN]]);
git.command('fast-import', [['-h'], ['--active-branches', 1.5]]);
git.command('fast-import', [['-h'], ['--max-pack-size', '9007199254740992']]);
git.command('fast-import', [['-h'], ['--big-file-threshold', '1.5']]);

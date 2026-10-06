import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('update-ref', [{ operand: 'refs/heads/test' }, { operand: 'HEAD' }]);
git.command('update-ref', [['-d'], { operand: 'refs/heads/test' }]);
git.command('update-ref', [['--stdin'], ['-z'], ['--batch-updates']]);
// @ts-expect-error Batch updates require stdin.
git.command('update-ref', [['--batch-updates'], { operand: 'refs/heads/test' }, { operand: 'HEAD' }]);
// @ts-expect-error Stdin cannot use delete mode.
git.command('update-ref', [['--stdin'], ['-d']]);
// @ts-expect-error The final reflog message cannot be empty.
git.command('update-ref', [['--stdin'], ['-m', '']]);
git.command('update-ref', [['--stdin'], ['-m', ''], ['-m', 'valid']]);
git.command('checkout-index', [['--stage', '1suffix']]);
git.command('checkout-index', [['--stage', 'all']]);
git.command('checkout-index', [['--all'], ['--prefix', 'out/']]);
// @ts-expect-error Callback validation occurs before later overwrite.
git.command('checkout-index', [['--stage', '4'], ['--stage', 'all']]);
// @ts-expect-error All stages cannot explicitly disable temporary output.
git.command('checkout-index', [['--stage', 'all'], ['--no-temp']]);
// @ts-expect-error All excludes explicit filenames.
git.command('checkout-index', [['--all'], { operand: 'tracked' }]);
git.command('read-tree', [['--dry-run'], ['--empty']]);
git.command('read-tree', [['--dry-run'], ['--trivial'], { operand: 'HEAD' }]);
git.command('read-tree', [['--dry-run'], ['-m'], ['-u'], ['--exclude-per-directory', '.gitignore'], { operand: 'HEAD' }]);
// @ts-expect-error Exclude callback requires an earlier -u.
git.command('read-tree', [['--exclude-per-directory', '.gitignore'], ['-u'], ['-m'], { operand: 'HEAD' }]);
// @ts-expect-error Empty prefix still selects a mode incompatible with -m.
git.command('read-tree', [['-m'], ['--prefix', ''], { operand: 'HEAD' }]);
// @ts-expect-error Update needs a merge mode.
git.command('read-tree', [['-u'], { operand: 'HEAD' }]);
// @ts-expect-error Merge requires a tree.
git.command('read-tree', [['-m']]);
// @ts-expect-error Empty mode rejects trees.
git.command('read-tree', [['--empty'], { operand: 'HEAD' }]);
// @ts-expect-error Absolute prefixes are rejected.
git.command('read-tree', [['--prefix', '/absolute'], { operand: 'HEAD' }]);
const files = [{ operand: 'a' }, { operand: 'b' }, { operand: 'c' }] as const;
git.command('merge-file', [['--stdout'], ['--ours'], ['--theirs'], ['--diff3'], ['--zdiff3'], ...files]);
git.command('merge-file', [['--diff-algorithm', 'DeFaUlT'], ['-L', 'a'], ['-L', 'b'], ['-L', 'c'], ...files]);
// @ts-expect-error A fourth label is immediately invalid, even before help.
git.command('merge-file', [['-L', 'a'], ['-L', 'b'], ['-L', 'c'], ['-L', 'd'], ['-h']]);
// @ts-expect-error Algorithms are checked case-insensitively against the native set.
git.command('merge-file', [['--diff-algorithm', 'unknown'], ...files]);
git.command('merge-tree', [{ operand: 'HEAD' }, { operand: 'HEAD' }]);
git.command('merge-tree', [['--quiet'], ['--no-messages'], { operand: 'HEAD' }, { operand: 'HEAD' }]);
git.command('merge-tree', files);
git.command('merge-tree', [['--trivial-merge'], ...files]);
git.command('merge-tree', [['--stdin'], { operand: 'ignored' }]);
// @ts-expect-error Implicit trivial mode rejects even canceled options.
git.command('merge-tree', [['--messages'], ['--no-messages'], ...files]);
// @ts-expect-error An option separator is an extra original token in trivial mode.
git.command('merge-tree', [['--'], ...files]);
// @ts-expect-error Repeating the trivial flag leaves an extra original token.
git.command('merge-tree', [['--trivial-merge'], ['--trivial-merge'], ...files]);
// @ts-expect-error Quiet and stdin conflict.
git.command('merge-tree', [['--quiet'], ['--stdin']]);
// @ts-expect-error Stdin excludes a global merge base.
git.command('merge-tree', [['--stdin'], ['--merge-base', 'HEAD']]);
// @ts-expect-error Explicit real merging takes exactly two operands.
git.command('merge-tree', [['--write-tree'], ...files]);

import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('rev-list', [{ operand: 'HEAD' }]);
git.command('rev-list', [['--count'], ['--all']]);
git.command('rev-list', [['--objects']]);
git.command('rev-list', [['--stdin']]);
git.command('rev-list', [['-p'], ['-s'], { operand: 'HEAD' }]);
git.command('rev-list', [['--notes'], ['--no-notes'], { operand: 'HEAD' }]);
git.command('rev-list', [['--exclude-promisor-objects'], ['--missing', 'unknown'], { operand: 'HEAD' }]);
git.command('rev-list', [['--missing', 'print'], ['--missing', 'error'], ['--exclude-promisor-objects'], { operand: 'HEAD' }]);
// @ts-expect-error Unknown missing actions preserve the previous recognized selection.
git.command('rev-list', [['--missing', 'print'], ['--missing', 'unknown'], ['--exclude-promisor-objects'], { operand: 'HEAD' }]);
// @ts-expect-error A source is required.
git.command('rev-list', []);
// @ts-expect-error rev-list rejects diff output.
git.command('rev-list', [['-p'], { operand: 'HEAD' }]);
// @ts-expect-error Notes are not supported.
git.command('rev-list', [['--notes'], { operand: 'HEAD' }]);
// @ts-expect-error Default notes apply without an explicit selection.
git.command('rev-list', [['--show-notes-by-default'], { operand: 'HEAD' }]);
// @ts-expect-error NUL output conflicts with header output.
git.command('rev-list', [['-z'], ['--pretty', 'oneline'], { operand: 'HEAD' }]);
// @ts-expect-error NUL output conflicts with marked output.
git.command('rev-list', [['-z'], ['--left-right'], { operand: 'HEAD' }]);
// @ts-expect-error Marked object counts are unsupported.
git.command('rev-list', [['--objects'], ['--count'], ['--cherry-mark'], { operand: 'HEAD' }]);
git.command('diff', [['--diff-algorithm', 'DeFaUlT']]);
git.command('log', [['--diff-algorithm', 'HiStOgRaM']]);
git.command('bundle create', [['--version', 3], { operand: 'out.bundle' }, { operand: '--all' }]);
git.command('bundle verify', [{ operand: 'out.bundle' }, { operand: 'ignored' }]);
git.command('bundle list-heads', [{ operand: 'out.bundle' }]);
git.command('bundle unbundle', [{ operand: 'out.bundle' }]);
// @ts-expect-error A bundle file is required.
git.command('bundle verify', []);
// @ts-expect-error Unsupported bundle version.
git.command('bundle create', [['--version', 4], { operand: 'out.bundle' }, { operand: '--all' }]);
git.command('history fixup', [['--dry-run'], ['--empty', 'keep'], { operand: 'HEAD' }]);
git.command('history reword', [['--dry-run'], ['--update-refs', 'head'], { operand: 'HEAD' }]);
git.command('history split', [['--dry-run'], { operand: 'HEAD' }, { operand: 'tracked' }]);
// @ts-expect-error Native history callback is case-sensitive.
git.command('history fixup', [['--empty', 'KEEP'], { operand: 'HEAD' }]);
// @ts-expect-error Reword takes one revision.
git.command('history reword', []);
git.command('repo info', [['--format', 'table'], ['-z'], ['--keys']]);
git.command('repo info', [{ operand: 'object.format' }]);
git.command('repo structure', [['--format', 'table']]);
// @ts-expect-error Table formatting is not supported by info's final state.
git.command('repo info', [['--format', 'table']]);
// @ts-expect-error All and explicit keys conflict.
git.command('repo info', [['--all'], { operand: 'object.format' }]);
// @ts-expect-error The callback rejects unknown values before later correction.
git.command('repo structure', [['--format', 'unknown'], ['--format', 'lines']]);

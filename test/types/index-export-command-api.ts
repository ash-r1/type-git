import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('update-index', [['-z'], ['--stdin']]);
git.command('update-index', [{ operand: 'file' }, ['--stdin']]);
// @ts-expect-error Stdin must be the final argument.
git.command('update-index', [['--stdin'], ['-z']]);
// @ts-expect-error Index-info cannot precede a filename.
git.command('update-index', [['--index-info'], { operand: 'file' }]);
git.command('update-index', [['--again'], { operand: '--refresh' }]);
// @ts-expect-error The again callback consumes the remaining words literally.
git.command('update-index', [['--again'], ['--refresh']]);
git.command('update-index', [['--unresolve'], { operand: 'file' }]);
git.command('update-index', [['--add'], ['--cacheinfo', '100644,0000000000000000000000000000000000000000,path']]);
// @ts-expect-error Cacheinfo consumes a separate value.
git.command('update-index', [['--cacheinfo']]);
// @ts-expect-error Chmod callbacks reject other modes immediately.
git.command('update-index', [['--chmod', 'invalid'], ['--chmod', '+x']]);
git.command('fast-export', [['--no-data']]);
// @ts-expect-error The command requires at least one argument.
git.command('fast-export', []);
// @ts-expect-error Map requires anonymization.
git.command('fast-export', [['--anonymize-map', 'from:to']]);
git.command('fast-export', [['--anonymize-map', 'from:to'], ['--anonymize']]);
// @ts-expect-error Filename pointers conflict even for empty strings.
git.command('fast-export', [['--import-marks', ''], ['--import-marks-if-exists', '']]);
// @ts-expect-error Sign callbacks are case sensitive.
git.command('fast-export', [['--signed-tags', 'STRIP']]);
git.command('fast-export', [['--reencode', 'ABORT'], { operand: 'HEAD' }]);

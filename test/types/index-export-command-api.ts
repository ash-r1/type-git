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

// Parser-family and C-long uncertainty defer this old-Git alternative to runtime.
git.command('update-index', [['--index-version', 2147483648], ['--index-version', 2]]);
// Parser-family and C-long uncertainty defer this old-Git alternative to runtime.
git.command('update-index', [['--index-version', -2147483649], ['--index-version', 2]]);
git.command('update-index', [['--index-version', -2147483648]]);
git.command('update-index', [['--index-version', 2147483647], ['--index-version', 2]]);

// Unrelated string callbacks must not recursively case-fold opaque path values.
git.command('update-index', [['--add'], ['--cacheinfo', '100644,0000000000000000000000000000000000000000,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']]);
// ASCII enum handling must also tolerate ordinary long literal format strings.
git.command('shortlog', [['--group', 'format:%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h%h']]);

// @ts-expect-error Reencoding callback rejects unsupported literal modes immediately.
git.command('fast-export', [['--reencode', 'unknown'], ['--reencode', 'yes']]);
// @ts-expect-error An anonymization key cannot be empty, even before a later valid map.
git.command('fast-export', [['--anonymize'], ['--anonymize-map', ':to'], ['--anonymize-map', 'valid']]);
// @ts-expect-error An anonymization replacement cannot be empty.
git.command('fast-export', [['--anonymize'], ['--anonymize-map', 'from:']]);
// @ts-expect-error An anonymization token cannot be empty.
git.command('fast-export', [['--anonymize'], ['--anonymize-map', '']]);
git.command('fast-export', [['--anonymize'], ['--anonymize-map', 'from:to:']]);
git.command('fast-export', [['--reencode', 'NO']]);

// @ts-expect-error Fast-export rewrites parents by default, conflicting with children output.
git.command('fast-export', [['--children'], ['--no-data']]);
git.command('fast-export', [['--parents'], ['--no-data']]);
// Parser-family and C-long uncertainty defer this old-Git alternative to runtime.
git.command('fast-export', [['--progress', 2147483648], ['--progress', 1], ['--no-data']]);
// Parser-family and C-long uncertainty defer this old-Git alternative to runtime.
git.command('fast-export', [['--progress', -2147483649], ['--progress', 1], ['--no-data']]);
git.command('fast-export', [['--progress', 2147483647], ['--progress', 1], ['--no-data']]);
git.command('fast-export', [['--progress', -2147483648], ['--progress', 1], ['--no-data']]);

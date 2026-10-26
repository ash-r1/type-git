import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('upload-archive', [['-h']]);
git.command('upload-archive', [['--help-all']]);
git.command('upload-archive', [{ operand: '-h' }]);
git.command('upload-archive', [{ operand: '--help-all' }]);
git.command('upload-archive', [{ operand: '/fixture/repo' }], { stdin: '0000' });
git.command('upload-archive', [['--help'], ['--man']]);
declare const uploadArchiveUsage: '-h' | '--help-all';
git.command('upload-archive', [[uploadArchiveUsage]]);
declare const uploadArchiveUsageOrDocs: '-h' | '--help';
git.command('upload-archive', [[uploadArchiveUsageOrDocs]]);
// @ts-expect-error One repository word is required.
git.command('upload-archive', []);
// @ts-expect-error Canonical usage cannot hide another argument.
git.command('upload-archive', [['-h'], { operand: '/fixture/repo' }]);
// @ts-expect-error Union usage cannot hide another argument.
git.command('upload-archive', [[uploadArchiveUsage], { operand: '/fixture/repo' }]);
// @ts-expect-error Tagged usage words remain subject to raw arity.
git.command('upload-archive', [{ operand: '-h' }, { operand: '/fixture/repo' }]);
// @ts-expect-error Documentation dispatch must be first-word.
git.command('upload-archive', [{ operand: '/fixture/repo' }, ['--help']]);
// @ts-expect-error No separator option.
git.command('upload-archive', [['--']]);
// @ts-expect-error Flag takes no value.
git.command('upload-archive', [['-h', true]]);

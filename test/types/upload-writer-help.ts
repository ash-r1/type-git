import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('upload-archive--writer', [['-h']]);
git.command('upload-archive--writer', [['--help-all']]);
git.command('upload-archive--writer', [{ operand: '-h' }]);
git.command('upload-archive--writer', [{ operand: '--help-all' }]);
git.command('upload-archive--writer', [{ operand: '/fixture/repo' }], { stdin: '0000' });
git.command('upload-archive--writer', [['--help'], ['--man']]);
declare const uploadWriterUsage: '-h' | '--help-all';
git.command('upload-archive--writer', [[uploadWriterUsage]]);
declare const uploadWriterUsageOrDocs: '-h' | '--help';
git.command('upload-archive--writer', [[uploadWriterUsageOrDocs]]);
// @ts-expect-error One repository word is required.
git.command('upload-archive--writer', []);
// @ts-expect-error Canonical usage cannot hide another argument.
git.command('upload-archive--writer', [['-h'], { operand: '/fixture/repo' }]);
// @ts-expect-error Union usage cannot hide another argument.
git.command('upload-archive--writer', [[uploadWriterUsage], { operand: '/fixture/repo' }]);
// @ts-expect-error Tagged usage words remain subject to raw arity.
git.command('upload-archive--writer', [{ operand: '-h' }, { operand: '/fixture/repo' }]);
// @ts-expect-error Documentation dispatch must be first-word.
git.command('upload-archive--writer', [{ operand: '/fixture/repo' }, ['--help']]);
// @ts-expect-error No separator option.
git.command('upload-archive--writer', [['--']]);
// @ts-expect-error Flag takes no value.
git.command('upload-archive--writer', [['-h', true]]);

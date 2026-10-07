import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('mailinfo', [['-u'], ['-n'], ['--encoding', 'UTF-8'], ['--quoted-cr', 'strip'], { operand: 'message' }, { operand: 'patch' }]);
// @ts-expect-error Invalid callback values cannot be overwritten.
git.command('mailinfo', [['--quoted-cr', 'STRIP'], ['--quoted-cr', 'strip'], { operand: 'message' }, { operand: 'patch' }]);
git.command('mailsplit', [['-d', 4], ['-f', 0], ['-o', 'out']]);
git.command('mailsplit', [{ operand: 'out' }]);
// @ts-expect-error Native precision is 3 through 9.
git.command('mailsplit', [['-d', 2], ['-o', 'out']]);
// @ts-expect-error A directory is required without an output option.
git.command('mailsplit', []);
git.command('interpret-trailers', [['--if-exists', 'AdDiFdIfFeReNtNeIgHbOr'], ['--trailer', 'Acked-by: Test']]);
git.command('interpret-trailers', [['--trailer', 'Acked-by: Test'], ['--no-trailer'], ['--parse']]);
git.command('interpret-trailers', [['--parse'], ['--no-only-input'], ['--trailer', 'Acked-by: Test']]);
// @ts-expect-error Parse implies input-only and cannot add trailers.
git.command('interpret-trailers', [['--parse'], ['--trailer', 'Acked-by: Test']]);
// @ts-expect-error In-place editing requires files.
git.command('interpret-trailers', [['--in-place']]);
git.command('url-parse', [['--component', 'invalid earlier'], ['--component', 'host'], { operand: 'https://example.invalid' }]);
// @ts-expect-error Final component must be known.
git.command('url-parse', [['--component', 'unknown'], { operand: 'https://example.invalid' }]);
git.command('hook run', [['--ignore-missing'], { operand: 'pre-commit' }, ['--'], { operand: 'extra' }]);
git.command('hook run', [['--allow-unknown-hook-name'], ['--ignore-missing'], { operand: 'custom' }]);
git.command('hook list', [['--show-scope'], { operand: 'pre-commit' }]);
// @ts-expect-error Custom hooks require opt-in.
git.command('hook run', [['--ignore-missing'], { operand: 'custom' }]);
// @ts-expect-error Hook arguments require a separator.
git.command('hook run', [{ operand: 'pre-commit' }, { operand: 'extra' }]);
// @ts-expect-error Hook name must precede the separator.
git.command('hook run', [['--'], { operand: 'pre-commit' }]);
git.command('credential', [{ operand: 'fill' }]);
git.command('credential fill', []);
git.command('credential approve', []);
git.command('credential reject', []);
git.command('credential capability', []);
// @ts-expect-error Root credential operation is validated.
git.command('credential', [{ operand: 'unknown' }]);
git.command('credential-store', [['--file', 'isolated'], { operand: 'unknown' }]);
git.command('credential-cache', [['--socket', '/tmp/isolated'], { operand: 'unknown' }, { operand: 'ignored' }]);
git.command('credential-cache--daemon', [{ operand: '/tmp/isolated' }, { operand: 'ignored' }]);
git.command('checkout--worker', [['--prefix', 'out/']]);
// @ts-expect-error Worker protocol takes no operands.
git.command('checkout--worker', [{ operand: 'extra' }]);
git.command('merge-ours', [{ operand: 'ignored' }]);
git.command('merge-one-file', [{ operand: '' }, { operand: '' }, { operand: '' }, { operand: 'absent' }, { operand: '' }, { operand: '' }, { operand: '' }]);
// @ts-expect-error The per-file merge helper requires seven operands.
git.command('merge-one-file', []);
git.command('get-tar-commit-id', []);
git.command('upload-archive', [{ operand: 'repo' }]);
git.command('upload-archive--writer', [{ operand: 'repo' }]);
// @ts-expect-error Archive transport requires a repository.
git.command('upload-archive', []);

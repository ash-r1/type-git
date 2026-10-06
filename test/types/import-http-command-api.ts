import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('fast-import', [['--date-format', 'raw'], ['--depth', 8191]]);
git.command('fast-import', [['--import-marks', 'one'], ['--import-marks', 'two']]);
git.command('fast-import', [['--signed-tags', 'sign-if-invalid=key']]);
// @ts-expect-error Date format callback is case sensitive.
git.command('fast-import', [['--date-format', 'RAW']]);
// @ts-expect-error No positional input files.
git.command('fast-import', [{ operand: 'file' }]);
// @ts-expect-error This parser does not accept an end-of-options marker.
git.command('fast-import', [['--']]);
git.command('http-fetch', [['--stdin'], { operand: 'file:///fixture' }]);
// @ts-expect-error Ordinary fetch requires an object and URL.
git.command('http-fetch', [{ operand: 'url' }]);
// @ts-expect-error Pack input requires index-pack arguments.
git.command('http-fetch', [['--packfile', 'oid'], { operand: 'url' }]);
git.command('http-fetch', [['--packfile', 'oid'], ['--index-pack-arg', ''], { operand: 'url' }]);
// @ts-expect-error Delete mode requires exactly one branch after its URL.
git.command('http-push', [['-d'], { operand: 'url' }]);
git.command('http-backend', [{ operand: '--ignored' }]);
git.command('imap-send', [['--list'], ['--folder', 'Drafts']]);
// @ts-expect-error IMAP send accepts no positional arguments.
git.command('imap-send', [{ operand: 'message' }]);

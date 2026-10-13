import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('fast-import', [['--date-format', 'raw'], ['--depth', 8191]]);
git.command('fast-import', [['--import-marks', 'one'], ['--import-marks', 'two']]);
git.command('fast-import', [['--signed-tags', 'sign-if-invalid=key']]);
// @ts-expect-error Date format callback is case sensitive.
git.command('fast-import', [['--date-format', 'RAW']]);
// @ts-expect-error No positional input files.
git.command('fast-import', [{ operand: 'file' }]);
// Separator support depends on the selected native Git and is deferred.
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

// @ts-expect-error Depth upper bound is checked at the incoming callback.
git.command('fast-import', [['--depth', 8192]]);
// @ts-expect-error A later valid depth cannot replace an invalid callback.
git.command('fast-import', [['--depth', 8192], ['--depth', 1]]);
declare const maybeTooDeep: 8191 | 8192;
// @ts-expect-error Every literal depth alternative must satisfy the upper bound.
git.command('fast-import', [['--depth', maybeTooDeep]]);
// @ts-expect-error Signing modes use the native case-sensitive callback grammar.
git.command('fast-import', [['--signed-tags', 'invalid']]);
// @ts-expect-error Later valid values do not erase callback rejection.
git.command('fast-import', [['--signed-tags', 'invalid'], ['--signed-tags', 'verbatim']]);
git.command('fast-import', [['--signed-tags', 'sign-if-invalid=']]);
// @ts-expect-error Signing modes use the native case-sensitive callback grammar.
git.command('fast-import', [['--signed-commits', 'invalid']]);
// @ts-expect-error Later valid values do not erase callback rejection.
git.command('fast-import', [['--signed-commits', 'invalid'], ['--signed-commits', 'verbatim']]);
git.command('fast-import', [['--signed-commits', 'sign-if-invalid=']]);
declare const dynamicImportMode: string;
git.command('fast-import', [['--signed-tags', dynamicImportMode]]);
declare const templateImportMode: `sign${string}`;
git.command('fast-import', [['--signed-tags', templateImportMode]]);
declare const opaqueImportMode: string & { readonly __mode: unique symbol };
git.command('fast-import', [['--signed-tags', opaqueImportMode]]);
declare const mixedImportModes: 'verbatim' | 'invalid';
// @ts-expect-error Known invalid alternatives are rejected.
git.command('fast-import', [['--signed-tags', mixedImportModes]]);

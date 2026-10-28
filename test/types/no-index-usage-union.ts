import type { Git } from '../../src/index.js';

declare const noIndexUnionGit: Git;
declare const noIndexUnionFlag: '--diff-algorithm' | '--stat-width';
// @ts-expect-error Every possible earlier callback must reach the usage exit.
noIndexUnionGit.command('diff --no-index', [
  [noIndexUnionFlag, 'invalid'], ['--help-all'], ['--unknown-tail'],
]);

declare const noIndexMixedUnionFlag: '--diff-algorithm' | '--src-prefix';
// @ts-expect-error A valid prefix branch cannot hide an invalid diff-algorithm callback.
noIndexUnionGit.command('diff --no-index', [
  [noIndexMixedUnionFlag, 'invalid'], ['--help-all'], ['--unknown-tail'],
]);

declare const noIndexValidUnionFlag: '--src-prefix' | '--dst-prefix';
noIndexUnionGit.command('diff --no-index', [
  [noIndexValidUnionFlag, 'kept'], ['--help-all'], ['--unknown-tail'],
]);

// @ts-expect-error An invalid literal diff-algorithm callback runs before help.
noIndexUnionGit.command('diff --no-index', [
  ['--diff-algorithm', 'invalid'], ['--help-all'], ['--unknown-tail'],
]);

declare const noIndexIgnoredUnionFlag: '--word-diff' | '--unknown-tail';
noIndexUnionGit.command('diff --no-index', [
  ['--help-all'], [noIndexIgnoredUnionFlag, 'invalid'],
]);
declare const noIndexMalformedUnionFlag: '--quiet' | '--unknown-tail';
// @ts-expect-error A known flag still cannot carry a value in an ignored tail.
noIndexUnionGit.command('diff --no-index', [
  ['--help-all'], [noIndexMalformedUnionFlag, 'invalid'],
]);

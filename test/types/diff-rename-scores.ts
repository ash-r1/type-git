import type { Git } from '../../src/index.js';
declare const git: Git;
declare const dynamic: string;
git.command('diff', [['--break-rewrites', ''], ['-h']]);
git.command('diff', [['--break-rewrites', '.'], ['-h']]);
git.command('diff', [['--break-rewrites', '%'], ['-h']]);
git.command('diff', [['--break-rewrites', '.%'], ['-h']]);
git.command('diff', [['--break-rewrites', '0.5'], ['-h']]);
git.command('diff', [['--break-rewrites', '50%'], ['-h']]);
git.command('diff', [['--break-rewrites', '123456789012345678901234567890'], ['-h']]);
git.command('diff', [['--break-rewrites']]);
git.command('diff', [['--break-rewrites', dynamic]]);
// @ts-expect-error A reached rename score does not accept arbitrary text.
git.command('diff', [['--break-rewrites', 'bad'], ['-h']]);
// @ts-expect-error A reached rename score does not accept arbitrary text.
git.command('diff', [['-h'], ['--break-rewrites', 'bad']]);
git.command('diff', [['-B', ''], ['-h']]);
git.command('diff', [['-B', '.'], ['-h']]);
git.command('diff', [['-B', '%'], ['-h']]);
git.command('diff', [['-B', '.%'], ['-h']]);
git.command('diff', [['-B', '0.5'], ['-h']]);
git.command('diff', [['-B', '50%'], ['-h']]);
git.command('diff', [['-B', '123456789012345678901234567890'], ['-h']]);
git.command('diff', [['-B']]);
git.command('diff', [['-B', dynamic]]);
// @ts-expect-error A reached rename score does not accept arbitrary text.
git.command('diff', [['-B', 'bad'], ['-h']]);
// @ts-expect-error A reached rename score does not accept arbitrary text.
git.command('diff', [['-h'], ['-B', 'bad']]);
git.command('diff', [['--find-renames', ''], ['-h']]);
git.command('diff', [['--find-renames', '.'], ['-h']]);
git.command('diff', [['--find-renames', '%'], ['-h']]);
git.command('diff', [['--find-renames', '.%'], ['-h']]);
git.command('diff', [['--find-renames', '0.5'], ['-h']]);
git.command('diff', [['--find-renames', '50%'], ['-h']]);
git.command('diff', [['--find-renames', '123456789012345678901234567890'], ['-h']]);
git.command('diff', [['--find-renames']]);
git.command('diff', [['--find-renames', dynamic]]);
// @ts-expect-error A reached rename score does not accept arbitrary text.
git.command('diff', [['--find-renames', 'bad'], ['-h']]);
// @ts-expect-error A reached rename score does not accept arbitrary text.
git.command('diff', [['-h'], ['--find-renames', 'bad']]);
git.command('diff', [['-M', ''], ['-h']]);
git.command('diff', [['-M', '.'], ['-h']]);
git.command('diff', [['-M', '%'], ['-h']]);
git.command('diff', [['-M', '.%'], ['-h']]);
git.command('diff', [['-M', '0.5'], ['-h']]);
git.command('diff', [['-M', '50%'], ['-h']]);
git.command('diff', [['-M', '123456789012345678901234567890'], ['-h']]);
git.command('diff', [['-M']]);
git.command('diff', [['-M', dynamic]]);
// @ts-expect-error A reached rename score does not accept arbitrary text.
git.command('diff', [['-M', 'bad'], ['-h']]);
// @ts-expect-error A reached rename score does not accept arbitrary text.
git.command('diff', [['-h'], ['-M', 'bad']]);
git.command('diff', [['--find-copies', ''], ['-h']]);
git.command('diff', [['--find-copies', '.'], ['-h']]);
git.command('diff', [['--find-copies', '%'], ['-h']]);
git.command('diff', [['--find-copies', '.%'], ['-h']]);
git.command('diff', [['--find-copies', '0.5'], ['-h']]);
git.command('diff', [['--find-copies', '50%'], ['-h']]);
git.command('diff', [['--find-copies', '123456789012345678901234567890'], ['-h']]);
git.command('diff', [['--find-copies']]);
git.command('diff', [['--find-copies', dynamic]]);
// @ts-expect-error A reached rename score does not accept arbitrary text.
git.command('diff', [['--find-copies', 'bad'], ['-h']]);
// @ts-expect-error A reached rename score does not accept arbitrary text.
git.command('diff', [['-h'], ['--find-copies', 'bad']]);
git.command('diff', [['-C', ''], ['-h']]);
git.command('diff', [['-C', '.'], ['-h']]);
git.command('diff', [['-C', '%'], ['-h']]);
git.command('diff', [['-C', '.%'], ['-h']]);
git.command('diff', [['-C', '0.5'], ['-h']]);
git.command('diff', [['-C', '50%'], ['-h']]);
git.command('diff', [['-C', '123456789012345678901234567890'], ['-h']]);
git.command('diff', [['-C']]);
git.command('diff', [['-C', dynamic]]);
// @ts-expect-error A reached rename score does not accept arbitrary text.
git.command('diff', [['-C', 'bad'], ['-h']]);
// @ts-expect-error A reached rename score does not accept arbitrary text.
git.command('diff', [['-h'], ['-C', 'bad']]);
// @ts-expect-error Only break-rewrites accepts a slash-separated pair.
git.command('diff', [['-M', '/']]);
// @ts-expect-error Only break-rewrites accepts a slash-separated pair.
git.command('diff', [['--find-renames', '/']]);
// @ts-expect-error Only break-rewrites accepts a slash-separated pair.
git.command('diff', [['-C', '/']]);
// @ts-expect-error Only break-rewrites accepts a slash-separated pair.
git.command('diff', [['--find-copies', '/']]);
git.command('diff', [['-B', '50%/60%']]);
git.command('diff', [['-B', '/']]);
// @ts-expect-error At most one slash separates the two scores.
git.command('diff', [['-B', '//']]);
git.command('diff', [['--break-rewrites', '50%/60%']]);
git.command('diff', [['--break-rewrites', '/']]);
// @ts-expect-error At most one slash separates the two scores.
git.command('diff', [['--break-rewrites', '//']]);
git.command('log', [['--find-renames', 'bad'], ['-h']]);
git.command('blame', [['-C', 'bad'], ['-h']]);
git.command('blame', [['-M', 'bad'], ['-h']]);
git.command('blame', [['-h'], ['--find-copies', 'bad']]);
// @ts-expect-error Long aliases retain the common callback even when short aliases are shadowed.
git.command('blame', [['--find-copies', 'bad'], ['-h']]);
git.command('difftool', [['--find-renames', 'bad'], ['--tool-help']]);
// @ts-expect-error Clearing tool-help restores the delegated score callback.
git.command('difftool', [['--find-renames', 'bad'], ['--tool-help'], ['--no-tool-help']]);
declare const scoreFlag: '--find-renames' | '--break-rewrites';
// @ts-expect-error Every flag-union alternative must accept the supplied score grammar.
git.command('diff', [[scoreFlag, '/']]);

git.command('pickaxe', [['-M', 'bad'], ['-h']]);
git.command('pickaxe', [['-C', 'bad'], ['-h']]);
declare const symbolicPercent: `${number}%`;
git.command('diff', [['-M', symbolicPercent]]);
// @ts-expect-error A percent must terminate the score even with a long concrete suffix.
git.command('diff', [['-M', '%1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111']]);

// @ts-expect-error A later valid occurrence cannot erase an earlier callback error.
git.command('diff', [['-M', 'bad'], ['-M', '50']]);
// @ts-expect-error A later disabling option cannot skip an already reached callback.
git.command('diff', [['-M', 'bad'], ['--no-renames']]);

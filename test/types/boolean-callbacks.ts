import type { Git } from '../../src/core/git.js';
import type { GitBooleanCallbackLiteral, GitBooleanCallbackValue, GitBooleanLiteral, GitBooleanValue } from '../../src/constraints/git-boolean-types.js';
type Equal<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
type Check<T extends true> = T;
export type CallbackStateCases = readonly [
  Check<Equal<GitBooleanValue<'0k'>, false>>,
  Check<Equal<GitBooleanValue<'-0x80000000'>, true>>,
  Check<Equal<GitBooleanCallbackValue<'m', 'pull-rebase'>, 'merges'>>,
  Check<Equal<GitBooleanCallbackValue<'i', 'pull-rebase'>, 'interactive'>>,
  Check<Equal<GitBooleanCallbackValue<'only-is-on-demand', 'push-recurse', 'only'>, 'on-demand'>>,
  Check<Equal<GitBooleanCallbackValue<'only-is-on-demand', 'push-recurse', 'only' | false>, 'on-demand' | false>>,
  Check<Equal<GitBooleanCallbackValue<'only-is-on-demand', 'push-recurse', undefined>, undefined>>,
  Check<Equal<GitBooleanCallbackLiteral<'true' | 'false', 'push-recurse'>, false>>,
  Check<Equal<GitBooleanLiteral<'false' | '2147483648'>, false>>,
  Check<Equal<GitBooleanCallbackLiteral<`${number}`, 'push-recurse'>, true>>,
  Check<Equal<GitBooleanCallbackLiteral<`if-${string}`, 'push-signed'>, true>>,
  Check<Equal<GitBooleanCallbackLiteral<string, 'fetch-recurse'>, true>>,
  Check<Equal<GitBooleanLiteral<undefined>, false>>,
];
declare const git: Git;
declare const dynamic: string;
git.command('push', [['--recurse-submodules', '0k'], ['-h']]);
git.command('push', [['--recurse-submodules', 'only'], ['--recurse-submodules', 'only-is-on-demand'], ['-h']]);
git.command('push', [['--signed', undefined], ['-h']]);
git.command('fetch', [['--recurse-submodules', undefined], ['-h']]);
git.command('pull', [['--rebase', 'm'], ['-h']]);
git.command('checkout', [['--recurse-submodules', dynamic], ['-h']]);
git.command('push', [['-h'], ['--recurse-submodules', 'true']]);
// @ts-expect-error A truthy numeric value is invalid for the push recursion callback.
git.command('push', [['--recurse-submodules', '1k'], ['-h']]);
// @ts-expect-error Boolean configuration integers have signed 32-bit bounds.
git.command('fetch', [['--recurse-submodules', '2147483648'], ['-h']]);
// @ts-expect-error The callback uses ASCII matching, not Unicode case folding.
git.command('push', [['--signed', 'if-asKed'], ['-h']]);
// @ts-expect-error Numeric-looking junk is not a boolean or a pull rebase mode.
git.command('pull', [['--rebase', '1junk'], ['-h']]);
// @ts-expect-error Known invalid members of a literal union must not be erased.
git.command('push', [['--recurse-submodules', '' as 'true' | 'false'], ['-h']]);

git.command('fetch', [['--porcelain'], ['--recurse-submodules', '0k']]);
git.command('fetch', [['--porcelain'], ['--recurse-submodules', dynamic]]);
// @ts-expect-error Normalize a valid nonzero integer before checking recursion conflicts.
git.command('fetch', [['--porcelain'], ['--recurse-submodules', '1k']]);

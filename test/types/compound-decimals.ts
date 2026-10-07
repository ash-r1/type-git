import type { Git } from '../../src/core/git.js';
import type { CompoundDecimalLiteral } from '../../src/constraints/compound-decimal-types.js';
import type { GitDecimalValue } from '../../src/constraints/git-decimal-types.js';
import type { COMPOUND_DECIMALS } from '../../src/constraints/compound-decimals.generated.js';
type Check<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
export type CompoundCases = readonly [
  Check<Equal<GitDecimalValue<'-18446744073709551540', typeof COMPOUND_DECIMALS['shortlog-wrap']['decimal']>, 76>>,
  Check<Equal<GitDecimalValue<'18446744073709551616', typeof COMPOUND_DECIMALS['show-branch-reflog']['decimal']>, -1>>,
  Check<Equal<CompoundDecimalLiteral<`76,${number},9`, 'shortlog-wrap'>, true>>,
  Check<Equal<CompoundDecimalLiteral<`76,${number},77`, 'shortlog-wrap'>, false>>,
  Check<Equal<CompoundDecimalLiteral<'76' | '76\n', 'shortlog-wrap'>, false>>,
  Check<Equal<CompoundDecimalLiteral<string, 'shortlog-wrap'>, true>>,
  Check<Equal<CompoundDecimalLiteral<`1,${string}`, 'show-branch-reflog'>, true>>,
];
declare const git: Git;
declare const dynamic: string;
git.command('shortlog', [['-w', '-18446744073709551540'], ['-h']]);
git.command('shortlog', [['-w', '0,2147483647,2147483647'], ['-h']]);
git.command('shortlog', [['-w', undefined], ['-h']]);
git.command('shortlog', [['-w', dynamic], ['-h']]);
git.command('shortlog', [['-h'], ['-w', '76\n']]);
git.command('shortlog', [['-h'], ['--color', 'invalid']]);
git.command('show-branch', [['--reflog', '1,date\n'], ['-h']]);
// @ts-expect-error An unsigned-long overflow saturates before the INT_MAX range check.
git.command('shortlog', [['-w', '-18446744073709551616'], ['-h']]);
// @ts-expect-error A trailing newline is not a consumed numeric character.
git.command('shortlog', [['-w', '76\n'], ['-h']]);
// @ts-expect-error Width must exceed both nonzero indentations.
git.command('shortlog', [['-w', '9,0,9'], ['-h']]);
// @ts-expect-error There are only three tuple fields.
git.command('shortlog', [['-w', '76,6,9,'], ['-h']]);
// @ts-expect-error Reflog's opaque tail starts only after the comma.
git.command('show-branch', [['--reflog', '1\n'], ['-h']]);
// @ts-expect-error shortlog's delegated color callback is reached before help.
git.command('shortlog', [['--color', 'invalid'], ['-h']]);

// Native Git 2.55.0 LP64 observations; binary prefixes remain selected-runtime dependent.
import type { Git } from '../../src/core/git.js';
declare const git: Git;
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", ""]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", " "]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "0"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "00"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "010"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "08"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "0x10"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "0X10"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "0x"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "0b10"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "0B10"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "0b2"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "1k"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "1_2"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "1.0"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "1e3"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "+1"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "-0"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "-1"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", " 12"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "\t12"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "12 "]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "12\n"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "\n12"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "8191"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "8192"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "0x1fff"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "0x2000"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "2147483647"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "2147483648"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "0x7fffffff"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "0x80000000"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "4294967295"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "4294967296"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "18446744073709551615"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "18446744073709551616"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "-18446744073709551616"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "0xffffffffffffffff"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "0x10000000000000000"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "+"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", "++1"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", "9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"]]);
git.command('fast-import', [['--quiet'], ["--active-branches", 0]]);
git.command('fast-import', [['--quiet'], ["--active-branches", 1]]);
git.command('fast-import', [['--quiet'], ["--active-branches", 8191]]);
git.command('fast-import', [['--quiet'], ["--active-branches", 8192]]);
git.command('fast-import', [['--quiet'], ["--active-branches", 2147483647]]);
git.command('fast-import', [['--quiet'], ["--active-branches", 2147483648]]);
git.command('fast-import', [['--quiet'], ["--active-branches", 9007199254740992]]);
git.command('fast-import', [['--quiet'], ["--active-branches", 18446744073709551616n]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--active-branches", 1.5]]);
// JavaScript exposes this as broad number; its failure is checked at runtime.
git.command('fast-import', [['--quiet'], ["--active-branches", Number.NaN]]);
// JavaScript exposes this as broad number; its failure is checked at runtime.
git.command('fast-import', [['--quiet'], ["--active-branches", Number.POSITIVE_INFINITY]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", ""]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", " "]]);
git.command('fast-import', [['--quiet'], ["--depth", "0"]]);
git.command('fast-import', [['--quiet'], ["--depth", "00"]]);
git.command('fast-import', [['--quiet'], ["--depth", "010"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "08"]]);
git.command('fast-import', [['--quiet'], ["--depth", "0x10"]]);
git.command('fast-import', [['--quiet'], ["--depth", "0X10"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "0x"]]);
git.command('fast-import', [['--quiet'], ["--depth", "0b10"]]);
git.command('fast-import', [['--quiet'], ["--depth", "0B10"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "0b2"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "1k"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "1_2"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "1.0"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "1e3"]]);
git.command('fast-import', [['--quiet'], ["--depth", "+1"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "-0"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "-1"]]);
git.command('fast-import', [['--quiet'], ["--depth", " 12"]]);
git.command('fast-import', [['--quiet'], ["--depth", "\t12"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "12 "]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "12\n"]]);
git.command('fast-import', [['--quiet'], ["--depth", "\n12"]]);
git.command('fast-import', [['--quiet'], ["--depth", "8191"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "8192"]]);
git.command('fast-import', [['--quiet'], ["--depth", "0x1fff"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "0x2000"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "2147483647"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "2147483648"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "0x7fffffff"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "0x80000000"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "4294967295"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "4294967296"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "18446744073709551615"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "18446744073709551616"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "-18446744073709551616"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "0xffffffffffffffff"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "0x10000000000000000"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "+"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "++1"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", "9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"]]);
git.command('fast-import', [['--quiet'], ["--depth", 0]]);
git.command('fast-import', [['--quiet'], ["--depth", 1]]);
git.command('fast-import', [['--quiet'], ["--depth", 8191]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", 8192]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", 2147483647]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", 2147483648]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", 9007199254740992]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", 18446744073709551616n]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--depth", 1.5]]);
// JavaScript exposes this as broad number; its failure is checked at runtime.
git.command('fast-import', [['--quiet'], ["--depth", Number.NaN]]);
// JavaScript exposes this as broad number; its failure is checked at runtime.
git.command('fast-import', [['--quiet'], ["--depth", Number.POSITIVE_INFINITY]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", ""]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", " "]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "0"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "00"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "010"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "08"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "0x10"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "0X10"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "0x"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "0b10"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "0B10"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "0b2"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "1k"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "1_2"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "1.0"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "1e3"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "+1"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "-0"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "-1"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", " 12"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "\t12"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "12 "]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "12\n"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "\n12"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "8191"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "8192"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "0x1fff"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "0x2000"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "2147483647"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "2147483648"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "0x7fffffff"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "0x80000000"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "4294967295"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "4294967296"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "18446744073709551615"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "18446744073709551616"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "-18446744073709551616"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "0xffffffffffffffff"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "0x10000000000000000"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "+"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "++1"]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", "9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", 0]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", 1]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", 8191]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", 8192]]);
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", 2147483647]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", 2147483648]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", 9007199254740992]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", 18446744073709551616n]]);
// @ts-expect-error Independent native callback rejected this known value.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", 1.5]]);
// JavaScript exposes this as broad number; its failure is checked at runtime.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", Number.NaN]]);
// JavaScript exposes this as broad number; its failure is checked at runtime.
git.command('fast-import', [['--quiet'], ["--cat-blob-fd", Number.POSITIVE_INFINITY]]);

git.command('fast-import', [['--depth', 8191n]]);
git.command('fast-import', [['--cat-blob-fd', 2147483647n]]);
// @ts-expect-error Bigint depth still has the native bound.
git.command('fast-import', [['--depth', 8192n]]);
// @ts-expect-error A valid arm cannot hide a known invalid arm.
git.command('fast-import', [['--active-branches', null as unknown as '010' | '08']]);
// @ts-expect-error A valid depth arm cannot hide an out-of-bound arm.
git.command('fast-import', [['--depth', null as unknown as '8191' | '8192']]);
declare const uncertainPrefix: `0${string}8`;
git.command('fast-import', [['--active-branches', uncertainPrefix]]);
declare const uncertainHexSuffix: `${number}f`;
git.command('fast-import', [['--depth', uncertainHexSuffix]]);
// @ts-expect-error An octal prefix with a known second zero cannot end in 8.
git.command('fast-import', [['--active-branches', null as unknown as `00${string}8`]]);
// @ts-expect-error Unit suffix k is not permitted by ulong_arg in any base.
git.command('fast-import', [['--active-branches', null as unknown as `${string}k`]]);
// @ts-expect-error NUL cannot be serialized, even after help.
git.command('fast-import', [['-h'], ['--active-branches', '1\0']]);
git.command('fast-import', [["--active-branches", "9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"]]);

// @ts-expect-error Native rejects this overflow even beyond the digit-recursion budget.
git.command('fast-import', [["--depth", "9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"]]);

// @ts-expect-error Native rejects this overflow even beyond the digit-recursion budget.
git.command('fast-import', [["--cat-blob-fd", "9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"]]);
git.command('fast-import', [["--active-branches", "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001"]]);
git.command('fast-import', [["--depth", "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001"]]);
git.command('fast-import', [["--cat-blob-fd", "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001"]]);
git.command('fast-import', [["--active-branches", "                                                                                                                                                                1"]]);
git.command('fast-import', [["--depth", "                                                                                                                                                                1"]]);
git.command('fast-import', [["--cat-blob-fd", "                                                                                                                                                                1"]]);

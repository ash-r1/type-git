import type { GitCommandClient } from '../../src/commands/types.js';
declare const git: GitCommandClient;
declare const opaque: string & { readonly depthInput: unique symbol };
declare const numeric: `${number}suffix`;
declare const badOrOpaque: 'bad' | typeof opaque;
git.command('fetch', [['--all'], ['--depth', '1suffix']]);
git.command('fetch', [['--all'], ['--depth', '4294967297']]);
git.command('fetch', [['--all'], ['--depth', opaque]]);
git.command('fetch', [['--all'], ['--depth', numeric]]);
// @ts-expect-error atoi's decimal prefix is zero
git.command('fetch', [['--all'], ['--depth', '0']]);
// @ts-expect-error no decimal prefix
git.command('fetch', [['--all'], ['--depth', 'bad']]);
// @ts-expect-error no decimal prefix after the sign
git.command('fetch', [['--all'], ['--depth', '+']]);
// @ts-expect-error decimal conversion stops before the hexadecimal suffix
git.command('fetch', [['--all'], ['--depth', '0x10']]);
// @ts-expect-error zero decimal prefix before a suffix
git.command('fetch', [['--all'], ['--depth', '000suffix']]);
// @ts-expect-error runtime deferral cannot erase a known-invalid input arm
git.command('fetch', [['--all'], ['--depth', badOrOpaque]]);

// @ts-expect-error Both observed atoi profiles reject a negative final depth.
git.command('fetch', [['--all'], ['--depth', '-1']]);
// @ts-expect-error Both observed profiles clamp this negative magnitude to a nonpositive int.
git.command('fetch', [['--all'], ['--depth', '-9223372036854775809']]);

import type { DepthInitialLiteral } from '../../src/constraints/depth-types.js';
type Check<T extends true> = T;
export type PinnedNativeDepthCases = readonly [
  Check<DepthInitialLiteral<"", 64> extends false ? true : false>,
  Check<DepthInitialLiteral<"0", 64> extends false ? true : false>,
  Check<DepthInitialLiteral<"-1", 64> extends false ? true : false>,
  Check<DepthInitialLiteral<"+2", 64> extends true ? true : false>,
  Check<DepthInitialLiteral<" 3", 64> extends true ? true : false>,
  Check<DepthInitialLiteral<"0x10", 64> extends false ? true : false>,
  Check<DepthInitialLiteral<"0b10", 64> extends false ? true : false>,
  Check<DepthInitialLiteral<"08", 64> extends true ? true : false>,
  Check<DepthInitialLiteral<"1suffix", 64> extends true ? true : false>,
  Check<DepthInitialLiteral<"2147483647", 64> extends true ? true : false>,
  Check<DepthInitialLiteral<"2147483648", 64> extends false ? true : false>,
  Check<DepthInitialLiteral<"4294967295", 64> extends false ? true : false>,
  Check<DepthInitialLiteral<"4294967296", 64> extends false ? true : false>,
  Check<DepthInitialLiteral<"4294967297", 64> extends true ? true : false>,
  Check<DepthInitialLiteral<"-2147483649", 64> extends true ? true : false>,
  Check<DepthInitialLiteral<"-4294967295", 64> extends true ? true : false>,
  Check<DepthInitialLiteral<"8589934593", 64> extends true ? true : false>,
  Check<DepthInitialLiteral<"9223372036854775807", 64> extends false ? true : false>,
  Check<DepthInitialLiteral<"9223372036854775808", 64> extends false ? true : false>,
  Check<DepthInitialLiteral<"-9223372036854775809", 64> extends false ? true : false>,
  Check<DepthInitialLiteral<"foo", 64> extends false ? true : false>,
  Check<DepthInitialLiteral<"+", 64> extends false ? true : false>,
  Check<DepthInitialLiteral<"1.5", 64> extends true ? true : false>,
  Check<DepthInitialLiteral<"1 ", 64> extends true ? true : false>,
  Check<DepthInitialLiteral<"1\n", 64> extends true ? true : false>,
];
export type IndependentDepthProfiles = readonly [
  Check<DepthInitialLiteral<'2147483648', 32>>,
  Check<DepthInitialLiteral<'2147483648', 64> extends false ? true : false>,
  Check<DepthInitialLiteral<'-4294967295', 64>>,
  Check<DepthInitialLiteral<'-4294967295', 32> extends false ? true : false>,
  Check<DepthInitialLiteral<'2147483648' | '-4294967295'> extends false ? true : false>,
];

export type DepthDeferralControls = readonly [
  Check<DepthInitialLiteral<`${number}suffix`>>,
  Check<DepthInitialLiteral<`bad${number}`> extends false ? true : false>,
  Check<DepthInitialLiteral<`${number}\0`> extends false ? true : false>,
];

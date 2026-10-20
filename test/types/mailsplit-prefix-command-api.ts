import type { TypeGit } from '../../src/adapters/node/index.js';
import type { GitDecimalValue } from '../../src/constraints/git-decimal-types.js';
declare const git: TypeGit;
type Check<T extends true> = T;

git.command('mailsplit', [['-d', '4suffix'], ['-f', '5suffix'], ['-o', 'out']]);
git.command('mailsplit', [['-d', 3.5], ['-f', 9007199254740992], ['-o', 'out']]);
git.command('mailsplit', [['-f', 'garbage'], ['-o', 'out']]);
git.command('mailsplit', [['-f', ''], ['-o', 'out']]);
git.command('mailsplit', [['-f'], ['-o', 'out']]);
git.command('mailsplit', [['-d', '4294967300'], ['-o', 'out']]);
// @ts-expect-error the converted width 2 is rejected immediately
git.command('mailsplit', [['-d', '2suffix'], ['-d', '4'], ['-o', 'out']]);
// @ts-expect-error a known invalid arm must not disappear behind a valid alternative
git.command('mailsplit', [['-d', '' as '4suffix' | '2suffix'], ['-o', 'out']]);
// @ts-expect-error no conversion gives zero, outside the native width range
git.command('mailsplit', [['-d', 'garbage'], ['-o', 'out']]);
// @ts-expect-error argv cannot represent NUL, even when it follows the numeric prefix
git.command('mailsplit', [['-f', '5\0ignored'], ['-o', 'out']]);

type PrefixParser<Bits extends 32 | 64> = { kind: 'decimal'; longBits: Bits; bits: 32; signed: true; conversion: 'prefix-cast'; empty: true };
export type MailsplitWidths = [
  Check<GitDecimalValue<'4294967300', PrefixParser<64>> extends 4 ? true : false>,
  Check<GitDecimalValue<'4294967300', PrefixParser<32>> extends 2147483647 ? true : false>
];

type Zeros = '0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
type Nines = '9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999';
declare const zeroWidth: `${Zeros}4suffix`;
git.command('mailsplit', [['-d', zeroWidth], ['-o', 'out']]);
declare const symbolicWidth: `${number}suffix`;
git.command('mailsplit', [['-d', symbolicWidth], ['-o', 'out']]);
declare const badWidth: `${Zeros}2suffix`;
// @ts-expect-error leading zeros cannot hide converted width 2
git.command('mailsplit', [['-d', badWidth], ['-o', 'out']]);
declare const overflow: `${Nines}${string}`;
// @ts-expect-error a known overflowing prefix saturates to an invalid width
git.command('mailsplit', [['-d', overflow], ['-o', 'out']]);
declare const stopped: `2x${string}`;
// @ts-expect-error a nonnumeric tail cannot repair converted width 2
git.command('mailsplit', [['-d', stopped], ['-o', 'out']]);

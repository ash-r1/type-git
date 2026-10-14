import type { Git } from '../../src/core/git.js';
import type { GitDecimalLiteral as Valid, GitDecimalValue as Value } from '../../src/constraints/git-decimal-types.js';
import type { LegacyGitDecimal } from '../../src/constraints/git-decimal.js';

type Mainline32 = { kind: 'decimal'; longBits: 32; bits: 32; signed: true; conversion: 'cast'; positive: true };
type Count = { kind: 'decimal'; longBits: 64; bits: 32; signed: true; conversion: 'checked'; nativeCallback: 'revision-count' };
type LegacyCount = LegacyGitDecimal<Count>;
type Yes<T extends true> = T;
type No<T extends false> = T;
export type Cases = [
  Yes<Valid<'2147483648', Mainline32>>,
  No<Valid<'-4294967295', Mainline32>>,
  No<Valid<'0', Mainline32>>,
  No<Valid<'1k', Count>>,
  Yes<Valid<'1k', LegacyCount>>,
  Yes<Valid<'bad', LegacyCount>>,
  Yes<Valid<'', LegacyCount>>,
  No<Valid<9007199254740992, LegacyCount>>,
];
export const saturated: Value<'2147483648', Mainline32> = 2147483647;
export const prefix: Value<'  -001k', LegacyCount> = -1;
export const absentPrefix: Value<'bad', LegacyCount> = 0;

declare const git: Git;
git.command('rev-list', [['--max-count', '1k'], ['--all']]);
git.command('rev-list', [['--max-count', ''], ['--all']]);
git.command('apply', [['-p', '1k'], ['--check']]);
git.command('diff-files', [['--unified', '-1']]);
git.command('fsmonitor--daemon', [['--ipc-threads', '1k'], ['-h']]);
// @ts-expect-error Unsafe JavaScript integers are rejected for all callback families.
git.command('rev-list', [['--max-count', 9007199254740992], ['--all']]);
// @ts-expect-error Tab width uses checked parsing on all observed implementations.
git.command('log', [['--expand-tabs', '1k']]);

type Timeout = { kind: 'decimal'; longBits: 64; bits: 32; signed: false; conversion: 'checked'; nativeCallback: 'daemon-timeout'; rejectMinus: true };
export type MoreCases = [
  Yes<Valid<1.5, LegacyCount>>, Yes<Valid<1e-7, LegacyCount>>,
  No<Valid<1e20, LegacyCount>>, No<Valid<'-0', Timeout>>,
  Yes<Valid<'-0', LegacyGitDecimal<Timeout>>>,
];
export const fractionPrefix: Value<1e-7, LegacyCount> = 1;
declare const unsafeUnion: 1 | 9007199254740992;
// @ts-expect-error An unsafe numeric union member remains invalid before replacement.
git.command('apply', [['-p', unsafeUnion], ['-p', 1]]);
// @ts-expect-error A callback family cannot hide an unsafe union member.
git.command('rev-list', [['--max-count', unsafeUnion], ['--all']]);
// @ts-expect-error Native integer family alternatives cannot hide unsafe numeric input.
git.command('fsmonitor--daemon start', [['--ipc-threads', unsafeUnion], ['--ipc-threads', 2]]);
git.command('daemon', [['--timeout', '-1'], ['--init-timeout', '1k'], ['-h']]);

export type TransportCases = [No<Valid<'1\0bad', LegacyCount>>, No<Valid<'1' | '1\0bad', LegacyCount>>];
// @ts-expect-error An argv word cannot contain NUL, even when atoi consumes an earlier prefix.
git.command('rev-list', [['--max-count', '1\0bad'], ['--all']]);

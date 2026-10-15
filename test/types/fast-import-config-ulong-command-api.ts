import type { Git } from '../../src/core/git.js';
declare const git: Git;
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--max-pack-size", ""]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "0"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "1"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "1k"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "1K"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "1m"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "1M"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "1g"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "1G"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--max-pack-size", "1kb"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--max-pack-size", "1KiB"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--max-pack-size", "1t"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", " 1k"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "+1k"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "-0"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "-1"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--max-pack-size", "-1k"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "010"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "0x10"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "0b10"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--max-pack-size", "08"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--max-pack-size", "1.5"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--max-pack-size", "1e3"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--max-pack-size", "1_2"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--max-pack-size", "12\n"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--max-pack-size", "12 "]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "18446744073709551615"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--max-pack-size", "18446744073709551616"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "4294967295"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "4294967296"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "9007199254740992"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", "0xffffffffffffffff"]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", 1]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", 9007199254740992]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", 1n]]);
git.command('fast-import', [['--quiet'], ["--max-pack-size", 18446744073709551615n]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--big-file-threshold", ""]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "0"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "1"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "1k"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "1K"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "1m"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "1M"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "1g"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "1G"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "1kb"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "1KiB"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "1t"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", " 1k"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "+1k"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "-0"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "-1"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "-1k"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "010"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "0x10"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "0b10"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "08"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "1.5"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "1e3"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "1_2"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "12\n"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "12 "]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "18446744073709551615"]]);
// @ts-expect-error Native unsigned configuration callback rejects this literal.
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "18446744073709551616"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "4294967295"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "4294967296"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "9007199254740992"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", "0xffffffffffffffff"]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", 1]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", 9007199254740992]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", 1n]]);
git.command('fast-import', [['--quiet'], ["--big-file-threshold", 18446744073709551615n]]);
declare const dynamic: string;
git.command('fast-import', [['--max-pack-size', dynamic]]);
declare const invalidUnion: '1k' | '1kb';
// @ts-expect-error One known union member has an invalid unit.
git.command('fast-import', [['--max-pack-size', invalidUnion]]);
// @ts-expect-error Independently observed native overflow/invalid unit remains known beyond the conversion budget.
git.command('fast-import', [["--max-pack-size", "9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"]]);
// @ts-expect-error Independently observed native overflow/invalid unit remains known beyond the conversion budget.
git.command('fast-import', [["--max-pack-size", "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"]]);
// @ts-expect-error Independently observed native overflow/invalid unit remains known beyond the conversion budget.
git.command('fast-import', [["--max-pack-size", "1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111kb"]]);
git.command('fast-import', [["--max-pack-size", "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001"]]);
// @ts-expect-error Independently observed native overflow/invalid unit remains known beyond the conversion budget.
git.command('fast-import', [["--big-file-threshold", "9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"]]);
// @ts-expect-error Independently observed native overflow/invalid unit remains known beyond the conversion budget.
git.command('fast-import', [["--big-file-threshold", "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"]]);
// @ts-expect-error Independently observed native overflow/invalid unit remains known beyond the conversion budget.
git.command('fast-import', [["--big-file-threshold", "1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111kb"]]);
git.command('fast-import', [["--big-file-threshold", "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001"]]);

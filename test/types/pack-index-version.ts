import type { Git } from '../../src/index.js';
declare const git: Git;
declare const dynamic: string;
git.command('pack-objects', [['--index-version', ""], ['-h']]);
git.command('pack-objects', [['--index-version', "0"], ['-h']]);
git.command('pack-objects', [['--index-version', "1"], ['-h']]);
git.command('pack-objects', [['--index-version', "2"], ['-h']]);
git.command('pack-objects', [['--index-version', "+1"], ['-h']]);
git.command('pack-objects', [['--index-version', " 1"], ['-h']]);
git.command('pack-objects', [['--index-version', ",1"], ['-h']]);
git.command('pack-objects', [['--index-version', "4294967296"], ['-h']]);
git.command('pack-objects', [['--index-version', "1,0x10"], ['-h']]);
git.command('pack-objects', [['--index-version', "1,010"], ['-h']]);
git.command('pack-objects', [['--index-version', "1,4294967296"], ['-h']]);
git.command('pack-objects', [['-h'], ['--index-version', 'bad']]);
git.command('pack-objects', [['--index-version', dynamic], ['-h']]);
// @ts-expect-error A reached native index-version parser rejects this literal.
git.command('pack-objects', [['--index-version', "3"], ['-h']]);
// @ts-expect-error A reached native index-version parser rejects this literal.
git.command('pack-objects', [['--index-version', "bad"], ['-h']]);
// @ts-expect-error A reached native index-version parser rejects this literal.
git.command('pack-objects', [['--index-version', "1,08"], ['-h']]);
// @ts-expect-error A reached native index-version parser rejects this literal.
git.command('pack-objects', [['--index-version', "1,2147483648"], ['-h']]);
git.command('index-pack', [['--index-version', ""], ['-h']]);
git.command('index-pack', [['--index-version', "0"], ['-h']]);
git.command('index-pack', [['--index-version', "1"], ['-h']]);
git.command('index-pack', [['--index-version', "2"], ['-h']]);
git.command('index-pack', [['--index-version', "+1"], ['-h']]);
git.command('index-pack', [['--index-version', " 1"], ['-h']]);
git.command('index-pack', [['--index-version', ",1"], ['-h']]);
git.command('index-pack', [['--index-version', "4294967296"], ['-h']]);
git.command('index-pack', [['--index-version', "1,0x10"], ['-h']]);
git.command('index-pack', [['--index-version', "1,010"], ['-h']]);
git.command('index-pack', [['--index-version', "1,4294967296"], ['-h']]);
git.command('index-pack', [['-h'], ['--index-version', 'bad']]);
git.command('index-pack', [['--index-version', dynamic], ['-h']]);
// @ts-expect-error A reached native index-version parser rejects this literal.
git.command('index-pack', [['--index-version', "3"], ['-h']]);
// @ts-expect-error A reached native index-version parser rejects this literal.
git.command('index-pack', [['--index-version', "bad"], ['-h']]);
// @ts-expect-error A reached native index-version parser rejects this literal.
git.command('index-pack', [['--index-version', "1,08"], ['-h']]);
// @ts-expect-error A reached native index-version parser rejects this literal.
git.command('index-pack', [['--index-version', "1,2147483648"], ['-h']]);
git.command('index-pack', [['--index-version', '1,'], ['-h']]);
// @ts-expect-error The pack-objects callback requires a value after a comma.
git.command('pack-objects', [['--index-version', '1,'], ['-h']]);
// @ts-expect-error A later valid value cannot repair an earlier invalid callback.
git.command('pack-objects', [['--index-version', 'bad'], ['--index-version', '1'], ['-h']]);
// @ts-expect-error Each finite union member must be accepted.
git.command('index-pack', [['--index-version', '1' as '1' | 'bad'], ['-h']]);
// @ts-expect-error Independent NUL validation is not bypassed by help.
git.command('index-pack', [['-h'], ['--index-version', '1\0']]);

// Long valid whitespace prefixes defer to runtime rather than exhausting the compiler.
git.command('pack-objects', [['--index-version', '1,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            0'], ['-h']]);

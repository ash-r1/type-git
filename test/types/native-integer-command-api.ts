import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('column', [['--width', '  +010k'], ['-h']]);
git.command('column', [['--width', '-2G'], ['-h']]);
git.command('pack-objects', [['--max-pack-size', 18446744073709551615n], ['-h']]);
git.command('pack-objects', [['--max-pack-size', '0x0'], ['--stdout']]);
git.command('pack-objects', [['--max-pack-size', 0n], ['--stdout']]);
git.command('pack-objects', [['--max-pack-size', 1], ['--no-max-pack-size'], ['--stdout']]);
// @ts-expect-error The native parser rejects overflow before a subsequent overwrite or help.
git.command('column', [['--width', 2147483648], ['--width', 1], ['-h']]);
// @ts-expect-error Unsigned storage rejects even a spelled negative zero.
git.command('pack-objects', [['--max-pack-size', '-0'], ['-h']]);
// @ts-expect-error A normalized nonzero pack size conflicts with stdout.
git.command('pack-objects', [['--max-pack-size', '0b1k'], ['--stdout']]);
// @ts-expect-error Uint64 overflow, despite the bigint input retaining precision.
git.command('pack-objects', [['--max-pack-size', 18446744073709551616n], ['-h']]);
// @ts-expect-error A number cannot retain precision above MAX_SAFE_INTEGER.
git.command('pack-objects', [['--max-pack-size', 9007199254740992], ['-h']]);

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

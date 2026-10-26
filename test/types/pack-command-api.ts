import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('pack-objects', [['--stdout'], ['--thin']]);
git.command('pack-objects', [{ operand: 'pack-prefix' }]);
// @ts-expect-error A destination is required.
git.command('pack-objects', []);
// @ts-expect-error Stdout has no pack prefix.
git.command('pack-objects', [['--stdout'], { operand: 'prefix' }]);
// @ts-expect-error Thin packs require stdout.
git.command('pack-objects', [['--thin'], { operand: 'prefix' }]);
// @ts-expect-error Stdin packs cannot use the revision walk.
git.command('pack-objects', [['--stdout'], ['--stdin-packs'], ['--all']]);
git.command('pack-objects', [['--stdout'], ['--stdin-packs'], ['--unpacked']]);
// @ts-expect-error Cruft expiration enables cruft mode.
git.command('pack-objects', [['--cruft-expiration', 'now'], ['--all'], { operand: 'prefix' }]);
git.command('index-pack', [['--stdin'], ['--fix-thin']]);
// @ts-expect-error Fix-thin needs stdin.
git.command('index-pack', [['--fix-thin'], { operand: 'file.pack' }]);
// @ts-expect-error Explicit object format conflicts with stdin.
git.command('index-pack', [['--stdin'], ['--object-format', 'sha1']]);
// @ts-expect-error Singleton callbacks reject repetition immediately.
git.command('index-pack', [['-o', 'file.idx'], ['-o', 'file.idx'], { operand: 'file.pack' }]);
// @ts-expect-error Verification needs an index or pack name.
git.command('index-pack', [['--stdin'], ['--verify']]);
git.command('unpack-objects', [['-n'], ['--strict']]);
// @ts-expect-error Unpack reads stdin and accepts no filenames.
git.command('unpack-objects', [{ operand: 'file.pack' }]);
// The selected Git owns version-dependent deprecation acknowledgement.
git.command('pack-redundant', [['--all']]);
git.command('pack-redundant', [['--all'], ['--i-still-use-this'], { operand: 'ignored' }]);

// Parser-family and C-long uncertainty defer this old-Git alternative to runtime.
git.command('pack-objects', [['--stdout'], ['--compression', -2147483649], ['--compression', 1]]);

// Parser-family and C-long uncertainty defer this old-Git alternative to runtime.
git.command('pack-objects', [['--stdout'], ['--compression', 2147483648], ['--compression', 1]]);
git.command('pack-objects', [['--stdout'], ['--compression', 2147483647], ['--compression', 1]]);
git.command('pack-objects', [['--stdout'], ['--compression', -2147483648], ['--compression', 1]]);

// Parser-family and C-long uncertainty defer this old-Git alternative to runtime.
git.command('pack-objects', [['--stdout'], ['--depth', -2147483649], ['--depth', 1]]);

// Parser-family and C-long uncertainty defer this old-Git alternative to runtime.
git.command('pack-objects', [['--stdout'], ['--depth', 2147483648], ['--depth', 1]]);
git.command('pack-objects', [['--stdout'], ['--depth', 2147483647], ['--depth', 1]]);
git.command('pack-objects', [['--stdout'], ['--depth', -2147483648], ['--depth', 1]]);

// Parser-family and C-long uncertainty defer this old-Git alternative to runtime.
git.command('pack-objects', [['--stdout'], ['--window', -2147483649], ['--window', 1]]);

// Parser-family and C-long uncertainty defer this old-Git alternative to runtime.
git.command('pack-objects', [['--stdout'], ['--window', 2147483648], ['--window', 1]]);
git.command('pack-objects', [['--stdout'], ['--window', 2147483647], ['--window', 1]]);
git.command('pack-objects', [['--stdout'], ['--window', -2147483648], ['--window', 1]]);

// Parser-family and C-long uncertainty defer this old-Git alternative to runtime.
git.command('pack-objects', [['--stdout'], ['--threads', -2147483649], ['--threads', 1]]);

// Parser-family and C-long uncertainty defer this old-Git alternative to runtime.
git.command('pack-objects', [['--stdout'], ['--threads', 2147483648], ['--threads', 1]]);
git.command('pack-objects', [['--stdout'], ['--threads', 2147483647], ['--threads', 1]]);
git.command('pack-objects', [['--stdout'], ['--threads', -2147483648], ['--threads', 1]]);

const binaryPack = git.command('pack-objects', [['--stdout']], { stdout: 'bytes', stdin: 'object\n' });
binaryPack.then((result) => { result.stdout satisfies Uint8Array; });
const textIndex = git.command('index-pack', [['--stdin']], { stdin: new Uint8Array([0, 255]) });
textIndex.then((result) => { result.stdout satisfies string; });
declare const outputMode: 'text' | 'bytes';
git.command('pack-objects', [['--stdout']], { stdout: outputMode }).then((result) => { result.stdout satisfies string | Uint8Array; });

// @ts-expect-error A type parameter cannot select binary output while omitting the runtime option.
git.command<'pack-objects', readonly [readonly ['--stdout']], 'bytes'>('pack-objects', [['--stdout']]);

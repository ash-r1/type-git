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
// @ts-expect-error The obsolete command requires explicit acknowledgement.
git.command('pack-redundant', [['--all']]);
git.command('pack-redundant', [['--all'], ['--i-still-use-this'], { operand: 'ignored' }]);

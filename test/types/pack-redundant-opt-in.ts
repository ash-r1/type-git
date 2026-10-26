import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('pack-redundant', [['--all']]);
git.command('pack-redundant', [['--all'], ['--verbose']]);
git.command('pack-redundant', [['--all'], ['--i-still-use-this']]);
git.command('pack-redundant', [{ operand: '.git/objects/pack/pack-a.pack' }, { operand: '.git/objects/pack/pack-b.pack' }]);
git.command('pack-redundant', [['--all'], { operand: 'ignored' }]);
// @ts-expect-error Source-independent pack/all arity remains enforced.
git.command('pack-redundant', []);
// @ts-expect-error Opt-in alone supplies neither all mode nor pack filenames.
git.command('pack-redundant', [['--i-still-use-this']]);
// @ts-expect-error Flags still take no value.
git.command('pack-redundant', [['--all', true]]);
declare const packRedundantMaybeAll: '--all' | '--verbose';
// @ts-expect-error Every union arm still needs all mode or a pack operand.
git.command('pack-redundant', [[packRedundantMaybeAll]]);

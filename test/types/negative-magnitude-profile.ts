import type { GitCommandClient } from '../../src/commands/types.js';
declare const git: GitCommandClient;

// Git 2.25's unsigned strtoumax magnitude parser accepts negative zero.
// Unknown selected Git profiles must preserve this actual valid possibility.
git.command('pack-objects', [['--max-pack-size', '-0'], ['-h']]);
git.command('clone', [['--filter', 'blob:limit=-0'], ['-h']]);

// Selected old sign policy must also reach final scalar rules, after parsing.
git.command('clone', [['--filter', 'blob:limit=-0'], { operand: 'source' }, { operand: 'destination' }]);
// @ts-expect-error every sign policy rejects the bad union arm
git.command('pack-objects', [['--max-pack-size', '-0' as '-0' | 'bad'], ['-h']]);
// @ts-expect-error unsigned conversion of -1 overflows before k multiplication
git.command('pack-objects', [['--max-pack-size', '-1k'], ['-h']]);
// @ts-expect-error -1 is nonzero in every profile that accepts it, conflicting with stdout
git.command('pack-objects', [['--max-pack-size', '-1'], ['--stdout']]);

// Git accepts exactly one unit suffix after a negative magnitude, never two.
git.command('pack-objects', [['--max-pack-size', '-0k'], ['-h']]);
git.command('pack-objects', [['--max-pack-size', '-0G'], ['-h']]);
git.command('clone', [['--filter', 'blob:limit=-0m'], ['-h']]);
git.command('clone', [['--filter', 'blob:limit=-00g'], ['-h']]);
// @ts-expect-error a second unit suffix is rejected
git.command('pack-objects', [['--max-pack-size', '-0kk'], ['-h']]);
// @ts-expect-error a second unit suffix is rejected
git.command('pack-objects', [['--max-pack-size', '-0Kg'], ['-h']]);
// @ts-expect-error a second unit suffix is rejected
git.command('clone', [['--filter', 'blob:limit=-0kk'], ['-h']]);
// @ts-expect-error a second unit suffix is rejected
git.command('clone', [['--filter', 'blob:limit=-00mk'], ['-h']]);

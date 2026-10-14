import type { GitCommandClient } from '../../src/commands/types.js';
declare const git: GitCommandClient;

// Actual Git 2.25/2.47 accepts these decimal values before -h. Unknown native
// parser families must retain that valid possibility rather than impose 2.55.
git.command('column', [['--width', 2147483648], ['-h']]);
git.command('column', [['--width', '4294967297'], ['-h']]);

// Decimal leading zeros are not octal in the older int parser.
git.command('column', [['--width', '08'], ['-h']]);

// @ts-expect-error no observed integer family accepts the bad union arm
git.command('column', [['--width', '1' as '1' | 'bad'], ['-h']]);

// @ts-expect-error each family must accept the whole input tuple; legacy rejects units while modern rejects overflow
git.command('column', [['--width', '1k' as '1k' | '2147483648'], ['-h']]);

// @ts-expect-error unsafe JS numbers are rejected by the precision policy in both parser families
git.command('column', [['--width', 9007199254740992], ['-h']]);

// @ts-expect-error invalid syntax is not erased by a later valid assignment in either family
git.command('column', [['--width', 'bad'], ['--width', 1], ['-h']]);

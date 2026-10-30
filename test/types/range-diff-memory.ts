import type { Git } from '../../src/index.js';
declare const git: Git;
declare const dynamic: string;
git.command('range-diff', [['--max-memory', '0'], ['-h']]);
git.command('range-diff', [['--max-memory', '1'], ['-h']]);
git.command('range-diff', [['--max-memory', '+1'], ['-h']]);
git.command('range-diff', [['--max-memory', ' 1'], ['-h']]);
git.command('range-diff', [['--max-memory', '1k'], ['-h']]);
git.command('range-diff', [['--max-memory', '1K'], ['-h']]);
git.command('range-diff', [['--max-memory', '0x10'], ['-h']]);
git.command('range-diff', [['--max-memory', '010'], ['-h']]);
git.command('range-diff', [['--max-memory', '1g'], ['-h']]);
git.command('range-diff', [['--max-memory', '4294967296'], ['-h']]);
git.command('range-diff', [['--max-memory', '18446744073709551615'], ['-h']]);
git.command('range-diff', [['--max-memory', dynamic], ['-h']]);
git.command('range-diff', [['--no-max-memory'], ['-h']]);
git.command('range-diff', [['-h'], ['--max-memory', 'bad']]);
// @ts-expect-error A reached memory-size callback rejects this literal.
git.command('range-diff', [['--max-memory', ""], ['-h']]);
// @ts-expect-error A reached memory-size callback rejects this literal.
git.command('range-diff', [['--max-memory', "-1"], ['-h']]);
// @ts-expect-error A reached memory-size callback rejects this literal.
git.command('range-diff', [['--max-memory', "08"], ['-h']]);
// @ts-expect-error A reached memory-size callback rejects this literal.
git.command('range-diff', [['--max-memory', "18446744073709551616"], ['-h']]);
// @ts-expect-error A reached memory-size callback rejects this literal.
git.command('range-diff', [['--max-memory', "bad"], ['-h']]);
// @ts-expect-error A reached memory-size callback rejects this literal.
git.command('range-diff', [['--max-memory', "1GB"], ['-h']]);
// @ts-expect-error A reached memory-size callback rejects this literal.
git.command('range-diff', [['--max-memory', "1.0"], ['-h']]);
// @ts-expect-error A reached memory-size callback rejects this literal.
git.command('range-diff', [['--max-memory', "1\n"], ['-h']]);
// @ts-expect-error A reached memory-size callback rejects this literal.
git.command('range-diff', [['--max-memory', "+"], ['-h']]);
// @ts-expect-error A reached memory-size callback rejects this literal.
git.command('range-diff', [['--max-memory', "١"], ['-h']]);
git.command('range-diff', [['--max-memory', 1], ['-h']]);
git.command('range-diff', [['--max-memory', 4294967296n], ['-h']]);
git.command('range-diff', [['--help-all'], ['--max-memory', 'bad']]);
// @ts-expect-error A later valid setting cannot repair an earlier invalid callback.
git.command('range-diff', [['--max-memory', 'bad'], ['--max-memory', '1k'], ['-h']]);
// @ts-expect-error No-op negation does not repair an earlier invalid callback.
git.command('range-diff', [['--max-memory', 'bad'], ['--no-max-memory'], ['-h']]);
// @ts-expect-error Required values cannot be omitted.
git.command('range-diff', [['--max-memory'], ['-h']]);
// @ts-expect-error Negation is valueless.
git.command('range-diff', [['--no-max-memory', '1'], ['-h']]);
// @ts-expect-error NUL stays invalid after an early help exit.
git.command('range-diff', [['-h'], ['--max-memory', '1\0']]);
git.command('range-diff', [['-h'], ['--type-git-unknown-tail']]);
git.command('range-diff', [['--max-memory', '1k'], ['-h'], ['--type-git-unknown-tail', 'raw']]);
// @ts-expect-error An earlier invalid callback is not repaired by a help exit with raw tail.
git.command('range-diff', [['--max-memory', 'bad'], ['-h'], ['--type-git-unknown-tail']]);
// @ts-expect-error Unknown words are not permitted before a reached help exit.
git.command('range-diff', [['--type-git-unknown-tail'], ['-h']]);
// @ts-expect-error Raw ignored words retain independent NUL validation.
git.command('range-diff', [['-h'], ['--type-git-unknown-tail', 'x\0']]);

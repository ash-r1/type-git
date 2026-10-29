import type { Git } from '../../src/index.js';
declare const git: Git;
declare const dynamic: string;
declare const alternative: '1' | 'bad';
git.command('commit-graph write', [['--max-new-filters', ''], ['-h']]);
git.command('commit-graph write', [['--max-new-filters', '-1'], ['-h']]);
git.command('commit-graph write', [['--max-new-filters', '+1'], ['-h']]);
git.command('commit-graph write', [['--max-new-filters', ' 1'], ['-h']]);
git.command('commit-graph write', [['--max-new-filters', '4294967296'], ['-h']]);
git.command('commit-graph write', [['--max-new-filters', '99999999999999999999999'], ['-h']]);
git.command('commit-graph write', [['--max-new-filters', dynamic], ['-h']]);
git.command('commit-graph write', [['--no-max-new-filters'], ['-h']]);
git.command('commit-graph write', [['-h'], ['--max-new-filters', 'bad']]);
git.command('commit-graph write', [['--help'], ['--max-new-filters', 'bad']]);
git.command('commit-graph write', [['--help-all'], ['--max-new-filters', 'bad']]);
// @ts-expect-error Earlier invalid values still fail before subcommand long help.
git.command('commit-graph write', [['--max-new-filters', 'bad'], ['--help']]);
// @ts-expect-error A reached callback rejects trailing non-decimal text.
git.command('commit-graph write', [['--max-new-filters', 'bad'], ['-h']]);
// @ts-expect-error The callback uses decimal text, not unit-suffixed configuration integers.
git.command('commit-graph write', [['--max-new-filters', '1k'], ['-h']]);
// @ts-expect-error Decimal fractions are not accepted.
git.command('commit-graph write', [['--max-new-filters', '1.0'], ['-h']]);
// @ts-expect-error A trailing newline remains unconsumed by strtol.
git.command('commit-graph write', [['--max-new-filters', '1\n'], ['-h']]);
// @ts-expect-error A hexadecimal prefix is not consumed in base ten.
git.command('commit-graph write', [['--max-new-filters', '0x10'], ['-h']]);
// @ts-expect-error A sign alone is not an empty argument.
git.command('commit-graph write', [['--max-new-filters', '+'], ['-h']]);
// @ts-expect-error Every finite literal alternative must be valid.
git.command('commit-graph write', [['--max-new-filters', alternative], ['-h']]);
// @ts-expect-error A later valid occurrence cannot repair an earlier invalid callback.
git.command('commit-graph write', [['--max-new-filters', 'bad'], ['--max-new-filters', '1'], ['-h']]);
// @ts-expect-error A required value cannot be omitted.
git.command('commit-graph write', [['--max-new-filters'], ['-h']]);
// @ts-expect-error Negation is a valueless flag.
git.command('commit-graph write', [['--no-max-new-filters', '1'], ['-h']]);
// @ts-expect-error NUL is invalid even in an ignored help tail.
git.command('commit-graph write', [['-h'], ['--max-new-filters', '1\0']]);
// @ts-expect-error Subcommand long help does not bypass independent NUL validation.
git.command('commit-graph write', [['--help'], ['--max-new-filters', '1\0']]);

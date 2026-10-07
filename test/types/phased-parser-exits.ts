import type { Git } from '../../src/core/git.js';
import type { InitialParserPass } from '../../src/commands/initial-parser-pass-types.js';
import type { COMMAND_SPECS } from '../../src/commands/generated.js';
declare const git: Git;
declare const dynamic: string;
declare const union: 'short' | 'bad';
declare const symbolic: `--${string}`;
declare const injectedUnion: '-h' | '--decorate=bad';
// Deferred callbacks are never reached, even if they precede the exit.
git.command('log', [['--color', 'bad'], ['-h']]);
git.command('show', [['--color', 'bad'], ['--help']]);
git.command('fast-export', [['--max-count', 'garbage'], ['-h']]);
git.command('cherry-pick', [['-h'], ['--empty', 'bad']]);
git.command('revert', [['-h'], ['--mainline', 'bad']]);
git.command('log', [['--decorate', dynamic], ['-h']]);
git.command('log', [['--decorate', undefined], ['-h']]);
git.command('log', [['--decorate', '0b1'], ['-h']]);
git.command('fast-export', [['--reencode', 'ABORT'], ['-h']]);
git.command('log', [['--default', symbolic], ['--decorate', 'bad'], ['-h']]);
// A split value becomes its own word in the initial pass.
git.command('log', [['-n', '-h']]);
git.command('log', [['--default', '-qh']]);
git.command('log', [['-n', '-L'], ['--decorate', 'bad'], ['-h']]);
// @ts-expect-error An initial-pass callback fails before help.
git.command('log', [['--decorate', 'bad'], ['-h']]);
// @ts-expect-error True is outside signed-32-bit boolean grammar here.
git.command('fast-export', [['--reencode', '2147483648'], ['-h']]);
// @ts-expect-error A known invalid union member remains invalid.
git.command('log', [['--decorate', union], ['-h']]);
// @ts-expect-error A possible injected callback failure cannot be dropped from a union.
git.command('log', [['--default', injectedUnion], ['-h']]);
// @ts-expect-error This split value is recognized as an initial callback.
git.command('log', [['-n', '--decorate=bad'], ['-h']]);
// @ts-expect-error A short cluster typo fails before later help.
git.command('log', [['--default', '-no-color'], ['-h']]);
// @ts-expect-error A known NUL remains impossible to serialize.
git.command('log', [['--color', 'a\0b'], ['-h']]);
// @ts-expect-error Value shape still applies to ignored options.
git.command('log', [['-h'], ['--color', 4]]);
// @ts-expect-error Initial global help dispatch is not an initial-pass command exit.
git.command('log', [['--help'], ['--decorate', 'bad']]);

type Check<T extends true> = T;
// The first pass consumes -h as -L's value. Later residual argv rules are a separate audit.
export type ConsumedHelp = Check<InitialParserPass<typeof COMMAND_SPECS.log, [['-G', '-L'], ['-h']]> extends { exited: false } ? true : false>;
export type SplitBoundary = Check<InitialParserPass<typeof COMMAND_SPECS.log, [['--default', '--end-of-options'], ['-h']]> extends { exited: false } ? true : false>;
export type UnionCheck = Check<import('../../src/commands/types.js').CheckedCommandArguments<'log', [['--decorate', 'short' | 'bad'], ['-h']]> extends never ? true : false>;
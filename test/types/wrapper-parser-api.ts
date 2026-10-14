import type { Git } from '../../src/core/git.js';
import type { InitialParserPass } from '../../src/commands/initial-parser-pass-types.js';
import { COMMAND_SPECS } from '../../src/commands/generated.js';

declare const git: Git;
declare const dynamic: string;
declare const choice: 'bad' | 'full';
git.command('reflog show', [['--decorate', 'bad'], ['-h']]);
git.command('reflog', [{ operand: 'show' }, ['--decorate', 'bad'], ['-h']]);
git.command('reflog show', [['--help'], ['--decorate', 'bad']]);
git.command('reflog show', [['-G', '-L'], ['-h']]);
git.command('reflog show', [['--decorate', dynamic]]);
git.command('reflog show', [['--decorate', choice], ['-h']]);
git.command('reflog', [['--color', 'bad'], ['-h']]);
// @ts-expect-error Root fallback reaches the decorate callback before help.
git.command('reflog', [['--decorate', 'bad'], ['-h']]);
// @ts-expect-error A known invalid branch remains invalid when no wrapper exits.
git.command('reflog show', [['--decorate', choice]]);
// @ts-expect-error The root wrapper stops, and log consumes -h as the -L value.
git.command('reflog', [['-G', '-L'], ['-h']]);
// @ts-expect-error Early exits cannot pass NUL to the operating system.
git.command('reflog show', [['-h'], ['--decorate', 'bad\0']]);

type Check<T extends true> = T;
export type RetainedWrapperWords = Check<
  InitialParserPass<typeof COMMAND_SPECS['reflog show'], [['--color', 'bad']]> extends {
    exited: false;
    tokens: readonly [];
    remaining: readonly ['--color=bad'];
  } ? true : false
>;
export type DynamicWrapperWords = Check<
  InitialParserPass<typeof COMMAND_SPECS['reflog show'], [{ operand: `prefix${string}` }]> extends {
    exited: 'dynamic';
  } ? true : false
>;

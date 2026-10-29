import type { Git } from '../../src/index.js';
declare const git: Git;
declare const dynamic: string;
git.command('diff', [['--color-moved']]);
git.command('diff', [['--color-moved', '']]);
git.command('diff', [['--color-moved', 'YES']]);
git.command('diff', [['--color-moved', '1k']]);
git.command('diff', [['--color-moved', 'plain']]);
git.command('diff', [['--color-moved', 'dimmed_zebra']]);
git.command('diff', [['--color-moved', dynamic]]);
git.command('diff', [['--no-color-moved']]);
git.command('diff', [['--no-color-moved-ws']]);
// @ts-expect-error Mode names are case-sensitive after Git boolean parsing.
git.command('diff', [['--color-moved', 'PLAIN'], ['-h']]);
// @ts-expect-error Reached callbacks reject unknown mode names.
git.command('diff', [['--color-moved', 'unknown']]);
// @ts-expect-error Values outside the signed 32-bit boolean range are invalid in all sources.
git.command('diff', [['--color-moved', '2147483648']]);
// @ts-expect-error Full diff help continues to later invalid modes.
git.command('diff', [['-h'], ['--color-moved', 'PLAIN']]);
// @ts-expect-error An explicit boolean is not an optional string value.
git.command('diff', [['--color-moved', true]]);
git.command('diff', [['--color-moved-ws', 'no']]);
git.command('diff', [['--color-moved-ws', ' ignore-space-change ']]);
git.command('diff', [['--color-moved-ws', 'ignore-space-at-eol,ignore-all-space']]);
git.command('diff', [['--color-moved-ws', 'allow-indentation-change']]);
git.command('diff', [['--color-moved-ws', 'unknown,no']]);
git.command('diff', [['--color-moved-ws', 'é,no']]);
git.command('diff', [['--color-moved-ws', 'no,,no']]);
git.command('diff', [['--color-moved-ws', 'ignore-all-space,no,allow-indentation-change']]);
git.command('diff', [['--color-moved-ws', dynamic]]);
// @ts-expect-error An empty whitespace token is invalid unless a later no resets it.
git.command('diff', [['--color-moved-ws', '']]);
// @ts-expect-error Reset spelling is case-sensitive.
git.command('diff', [['--color-moved-ws', 'NO']]);
// @ts-expect-error Unknown tokens after the last reset remain invalid.
git.command('diff', [['--color-moved-ws', 'no,unknown']]);
// @ts-expect-error A trailing empty token after a reset is invalid.
git.command('diff', [['--color-moved-ws', 'no,']]);
// @ts-expect-error Indentation cannot be combined with other whitespace modes at the end.
git.command('diff', [['--color-moved-ws', 'ignore-all-space,allow-indentation-change']]);
// @ts-expect-error The final conflict applies in either token order.
git.command('diff', [['--color-moved-ws', 'allow-indentation-change,ignore-space-change']]);
// @ts-expect-error C trimming does not discard non-ASCII whitespace.
git.command('diff', [['--color-moved-ws', ' no']]);
// @ts-expect-error Later occurrences cannot clear an earlier callback failure.
git.command('diff', [['--color-moved-ws', 'unknown'], ['--color-moved-ws', 'no']]);
// @ts-expect-error A later negation cannot clear an earlier callback failure.
git.command('diff', [['--color-moved-ws', 'unknown'], ['--no-color-moved-ws']]);
// @ts-expect-error Blame runs an earlier whitespace callback before help.
git.command('blame', [['--color-moved-ws', 'unknown'], ['-h']]);
git.command('blame', [['-h'], ['--color-moved-ws', 'unknown']]);
git.command('log', [['--color-moved-ws', 'unknown'], ['-h']]);
git.command('difftool', [['--color-moved-ws', 'unknown'], ['--tool-help']]);
// @ts-expect-error Clearing tool-help restores the retained callback.
git.command('difftool', [['--color-moved-ws', 'unknown'], ['--tool-help'], ['--no-tool-help']]);
declare const possibleMode: 'plain' | 'PLAIN';
// @ts-expect-error Every supplied mode alternative must be valid.
git.command('diff', [['--color-moved', possibleMode]]);
declare const possibleWhitespace: 'no' | 'unknown';
// @ts-expect-error Every supplied whitespace alternative must be valid.
git.command('diff', [['--color-moved-ws', possibleWhitespace]]);
// @ts-expect-error An explicit boolean is not a required string value.
git.command('diff', [['--color-moved-ws', false]]);
// @ts-expect-error NUL remains invalid even before a reset and after help.
git.command('blame', [['-h'], ['--color-moved-ws', 'unknown\0,no']]);

// Ignored moved-color enum values retain each frontend's help phase.
git.command('log', [['--color-moved', 'PLAIN'], ['-h']]);
git.command('blame', [['-h'], ['--color-moved', 'PLAIN']]);
git.command('difftool', [['--color-moved', 'PLAIN'], ['--tool-help']]);

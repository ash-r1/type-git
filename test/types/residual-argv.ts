import type { Git } from '../../src/core/git.js';
import type { InitialParserPass } from '../../src/commands/initial-parser-pass-types.js';
import type { COMMAND_SPECS } from '../../src/commands/generated.js';
declare const git: Git;
declare const dynamic: string;

git.command('log', [['-n', '-L'], { operand: '1,1:file' }, { operand: '0' }]);
git.command('log', [['-G', '--decorate'], { operand: 'x' }, ['--max-count', 0]]);
git.command('log', [['--'], ['--color', 'bad']]);
git.command('log', [['-n', dynamic]]);
git.command('fast-export', [['-G', '--'], ['-h']]);
git.command('fast-export', [['--'], ['--color', 'always'], { operand: 'HEAD' }]);
// @ts-expect-error Initial -L consumed the -h word, leaving -G without a value.
git.command('log', [['-G', '-L'], ['-h']]);
// @ts-expect-error Initial -L consumed the -h word, leaving --default without a value.
git.command('log', [['--default', '-L'], ['-h']]);
// Older atoi callbacks accept this residual text; the pinned modern context rejects it below.
git.command('log', [['-n', '--decorate'], { operand: 'bad' }]);
// @ts-expect-error setup_revisions searches for -- before trying to consume -G's value.
git.command('log', [['-G', '--'], ['-h']]);
// @ts-expect-error Fast-export removes its first --, so the invalid color is parsed later.
git.command('fast-export', [['--'], ['--color', 'bad']]);
// @ts-expect-error NUL remains unrepresentable when a later word becomes a path.
git.command('log', [['--'], ['--color', 'a\0b']]);

type Check<T extends true> = T;
type Equal<A,B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
export type RetainedWords = readonly [
  Check<InitialParserPass<typeof COMMAND_SPECS.log, [['-G', '-L'], ['-h']]> extends { remaining: ['-G'] | readonly ['-G'] } ? true : false>,
  Check<Equal<InitialParserPass<typeof COMMAND_SPECS.log, [['--default', '-qSx']]> extends { remaining: infer R } ? R : never, readonly ['--default', '-Sx']>>,
  Check<Equal<InitialParserPass<typeof COMMAND_SPECS.log, [{operand:'-'}]> extends { remaining: infer R } ? R : never, readonly ['-']>>,
];

import type { CheckedCommandArguments } from '../../src/commands/types.js';
type ProfileCheck<T extends true> = T;
export type ResidualTraitProfiles = readonly [
  ProfileCheck<[CheckedCommandArguments<'log', [['-n', '--decorate=m'], ['--all']]>] extends [never] ? false : true>,
  ProfileCheck<[CheckedCommandArguments<'log', [['-n', '--decorate=m'], ['--all']], {booleanSource: 'legacy-units'}>] extends [never] ? false : true>,
  ProfileCheck<[CheckedCommandArguments<'log', [['-n', '--decorate=m'], ['--all']], {booleanSource: 'modern'}>] extends [never] ? true : false>,
];

export type PinnedResidualNumericProfiles = readonly [
  ProfileCheck<[CheckedCommandArguments<'log', [['-n', '--decorate'], {operand: 'bad'}], {decimalCallbacks: {'revision-count': 'modern'}}>] extends [never] ? true : false>,
  ProfileCheck<[CheckedCommandArguments<'log', [['-n', '--decorate'], {operand: 'bad'}], {decimalCallbacks: {'revision-count': 'legacy'}}>] extends [never] ? false : true>,
];

// Pinning decimal callbacks must leave an unpinned boolean source available.
export type IndependentlyPinnedResidualProfiles = readonly [
  ProfileCheck<[CheckedCommandArguments<'log', [['-n', '--decorate=m'], ['--all']], {decimalCallbacks: {'revision-count': 'legacy'}}>] extends [never] ? false : true>,
  ProfileCheck<[CheckedCommandArguments<'log', [['-n', '--decorate=m'], ['--all']], {decimalCallbacks: {'revision-count': 'legacy'}, booleanSource: 'modern'}>] extends [never] ? true : false>,
  ProfileCheck<[CheckedCommandArguments<'log', [['-n', '--decorate'], {operand: 'bad'}], {decimalCallbacks: {'revision-count': 'modern'}}>] extends [never] ? true : false>,
];

export type OtherUnpinnedDecimalCallbacks = readonly [
  ProfileCheck<[CheckedCommandArguments<'log', [['--unified', '-1']], {decimalCallbacks: {'revision-count': 'modern'}}>] extends [never] ? false : true>,
  ProfileCheck<[CheckedCommandArguments<'log', [['--unified', '-1']], {decimalCallbacks: {'unified-context': 'modern'}}>] extends [never] ? true : false>,
];

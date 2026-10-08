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
// @ts-expect-error The residual numeric value is checked after the earlier option is consumed.
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

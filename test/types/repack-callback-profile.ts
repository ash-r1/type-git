import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('repack', [['--max-pack-size', 'invalid'], ['-h']]);
git.command('repack', [['-h'], ['--max-pack-size', 'invalid']]);
import type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';
type Check<T extends true> = T;
type Accepted<A extends readonly GitCommandArgument<'repack'>[], P extends 'immediate'|'deferred'> = [CheckedCommandArguments<'repack',A,{repackMaxPackSize:P}>] extends [never] ? false : true;
export type RepackProfileCases = readonly [
  Check<Accepted<[['--max-pack-size','invalid'],['-h']],'deferred'>>,
  Check<Accepted<[['--max-pack-size','invalid'],['-h']],'immediate'> extends false ? true:false>,
  Check<Accepted<[['-h'],['--max-pack-size','invalid']],'immediate'>>,
  Check<Accepted<[['--max-pack-size','invalid'|'1k'],['--help-all']],'deferred'>>,
  Check<Accepted<[['--max-pack-size','invalid'|'1k'],['--help-all']],'immediate'> extends false ? true:false>
];
git.command('repack', [['--help-all'], ['--max-pack-size', 'invalid']]);
git.command('repack', [['--git-completion-helper']]);
// @ts-expect-error Without a real help exit the deferred alternative cannot hide a bad value.
git.command('repack', [['--max-pack-size', 'invalid']]);
// @ts-expect-error An end marker prevents a later help-looking word from being an exit.
git.command('repack', [['--max-pack-size', 'invalid'], '--', {operand:'-h'}]);
// @ts-expect-error A timing alternative cannot permit NUL in a value.
git.command('repack', [['--max-pack-size', 'bad\0value'], ['-h']]);
// @ts-expect-error A timing alternative cannot permit a boolean integer representation.
git.command('repack', [['--max-pack-size', true], ['-h']]);
// @ts-expect-error A deferred numeric value cannot hide a different malformed callback.
git.command('repack', [['--max-pack-size', 'invalid'], ['--geometric', 'invalid'], ['-h']]);
declare const invalidOtherFlag: '--max-pack-size' | '--filter';
// @ts-expect-error Every flag alternative must pass the same complete parser walk.
git.command('repack', [[invalidOtherFlag, 'invalid'], ['-h']]);
declare const oldStringFlag: '--max-pack-size' | '--window';
git.command('repack', [[oldStringFlag, 'invalid'], ['-h']]);
export type RepackFlagUnionCases = readonly [
  Check<Accepted<[[typeof oldStringFlag,'invalid'],['-h']],'immediate'> extends false ? true:false>,
  Check<Accepted<[[typeof oldStringFlag,'invalid'],['-h']],'deferred'>>
];

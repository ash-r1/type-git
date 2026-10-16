import type { CheckedCommandArguments, GitCommandArgument, GitCommandName } from '../../src/commands/types.js';
type Accepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[], P extends boolean | undefined = undefined> = [CheckedCommandArguments<C, A, P extends undefined ? {} : { emptyPickaxeRejected: P }>] extends [never] ? false : true;
type Yes<T extends true> = T;
type No<T extends false> = T;
export type PickaxeEmptyProfiles = [
  Yes<Accepted<'diff', [['-S', '']]>>,
  Yes<Accepted<'log', [['-G', ''], ['-G', 'one']]>>,
  Yes<Accepted<'difftool', [['-S', ''], ['-S', 'one']], false>>,
  No<Accepted<'diff', [['-S', '']], true>>,
  No<Accepted<'log', [['-G', ''], ['-G', 'one']], true>>,
  No<Accepted<'difftool', [['-S', ''], ['-S', 'one']], true>>,
  Yes<Accepted<'diff', [['-S', 'one']], true>>,
];

import type { CheckedCommandArguments, GitCommandArgument, GitCommandName } from '../../src/commands/types.js';
import type { CommandGrammarContext } from '../../src/commands/gui-syntax.js';
type Check<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
type Accepted<C extends GitCommandName, A extends readonly GitCommandArgument<C>[], P extends CommandGrammarContext = {}> = [CheckedCommandArguments<C, A, P>] extends [never] ? false : true;
export type FirstPassSourceCases = readonly [
  Check<Accepted<'cherry-pick', [['--empty', 'bad'], ['-h']]>>,
  Check<Equal<Accepted<'cherry-pick', [['--empty', 'bad'], ['-h']], { firstPassEmpty: true }>, false>>,
  Check<Accepted<'cherry-pick', [['--empty', 'bad'], ['-h']], { firstPassEmpty: false }>>,
  Check<Equal<Accepted<'cherry-pick', [['--empty', 'bad'], { operand: 'HEAD' }]>, false>>,
  Check<Equal<Accepted<'cherry-pick', [['--empty', 'bad'], ['--mainline', 'bad'], ['-h']]>, false>>,
  Check<Equal<Accepted<'cherry-pick', [['--empty', 'bad'], ['--mainline', 1 | 'bad'], ['-h']]>, false>>,
  Check<Equal<Accepted<'cherry-pick', [['--empty', 'bad'], ['-h'], { operand: 'bad\0word' }]>, false>>,
  Check<Accepted<'log', [['--decorate', 'm'], ['-h']]>>,
  Check<Equal<Accepted<'log', [['--decorate', 'm'], ['-h']], { booleanSource: 'modern' }>, false>>,
  Check<Accepted<'log', [['--decorate', 'm'], ['-h']], { booleanSource: 'legacy-units' }>>,
  Check<Equal<Accepted<'log', [['--decorate', '-2147483648'], ['-h']], { booleanSource: 'symmetric' }>, false>>,
  Check<Accepted<'log', [['-G', '-h'], ['--decorate', 'm']], { booleanSource: 'modern' }>>
];

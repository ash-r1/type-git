import type { TypeGit } from '../../src/adapters/node/index.js';
import type { SvnTokens } from '../../src/commands/svn-dispatch-types.js';

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Options = { '-i': { value: 'string' }; '-h': { value: 'flag' } };

export type BareDashIsOperand = Assert<
  Equal<SvnTokens<readonly ['-'], Options>, readonly [{ readonly operand: '-' }]>
>;
export type BareDashBetweenOptions = Assert<
  Equal<
    SvnTokens<readonly ['-i', 'x', '-', '-h'], Options>,
    readonly [readonly ['-i', 'x'], { readonly operand: '-' }, readonly ['-h']]
  >
>;
export type UnknownDashOptionStillRejected = Assert<
  Equal<SvnTokens<readonly ['-z'], Options>, never>
>;

declare const git: TypeGit;
git.command('svn', [['-i', 'x'], { operand: 'log' }, { operand: '-' }]);
git.command('svn', [{ operand: 'log' }, { operand: '-' }]);

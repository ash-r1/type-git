// Hand-written literal checks for operands that git pull forwards to git fetch.
import type { CheckedCommandArguments, GitCommandArgument } from '../../src/commands/types.js';
type Check<T extends true> = T;
type Accepted<A extends readonly GitCommandArgument<'pull'>[]> = [
  CheckedCommandArguments<'pull', A>,
] extends [never]
  ? false
  : true;
export type PullForwardedOperandCases = readonly [
  // A lone dash is a fetch operand, not an option.
  Check<Accepted<[['--'], { operand: '-' }]>>,
  Check<Accepted<[['--'], { operand: 'origin' }, { operand: 'main' }]>>,
  // Pull drops its own --, so fetch would parse these words as options.
  Check<Accepted<[['--'], { operand: '--upload-pack=x' }]> extends false ? true : false>,
  Check<Accepted<[{ operand: 'origin' }, ['--'], { operand: '-x' }]> extends false ? true : false>,
  Check<Accepted<[['--'], { operand: '--' }]> extends false ? true : false>,
  // A preceding help exit leaves the forwarded word unreachable.
  Check<Accepted<[['-h'], ['--'], { operand: '--x' }]>>,
  // Non-literal operands stay accepted by the type; the runtime check refuses dash prefixes.
  Check<Accepted<[['--'], { operand: string }]>>,
];

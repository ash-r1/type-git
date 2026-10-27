import type { GitCommandArgument } from '../../src/commands/types.js';

export const hashObjectStdin: GitCommandArgument<'hash-object'> = ['--stdin'];
export const tagList: GitCommandArgument<'tag'> = ['--list'];
export const unionStdin: GitCommandArgument<'hash-object' | 'tag'> = ['--stdin'];
export const unionList: GitCommandArgument<'hash-object' | 'tag'> = ['--list'];
export const unionOperand: GitCommandArgument<'hash-object' | 'tag'> = { operand: 'name' };
// @ts-expect-error A command union does not admit unknown options.
export const unionUnknown: GitCommandArgument<'hash-object' | 'tag'> = ['--not-a-git-option'];
// @ts-expect-error A tag-only option is unavailable to hash-object.
export const hashObjectList: GitCommandArgument<'hash-object'> = ['--list'];
// @ts-expect-error An empty command set has no operand vocabulary.
export const neverOperand: GitCommandArgument<never> = { operand: 'name' };

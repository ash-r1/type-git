import type { GitCommandExecOpts } from '../../src/commands/types.js';
import type { Git } from '../../src/core/git.js';
import type { BareRepo, WorktreeRepo } from '../../src/core/repo.js';
import type { GitOutputMode, RawResult } from '../../src/core/types.js';

declare const git: Git;
declare const repo: WorktreeRepo;
declare const bare: BareRepo;

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
  ? true
  : false;
declare function expectType<T extends true>(): T;

declare const general: GitCommandExecOpts<GitOutputMode> | undefined;
declare const maybeBytes: GitCommandExecOpts<'bytes'> | undefined;
declare const maybeText: GitCommandExecOpts | undefined;

// Optional general-mode options resolve to the union result instead of failing overload lookup.
const generalRepo = repo.command('status', [['--short']], general);
expectType<Equal<typeof generalRepo, Promise<RawResult<string | Uint8Array>>>>();
const generalGit = git.command('status', [['--short']], general);
expectType<Equal<typeof generalGit, Promise<RawResult<string | Uint8Array>>>>();
const generalBare = bare.command('fetch', [{ operand: 'origin' }], general);
expectType<Equal<typeof generalBare, Promise<RawResult<string | Uint8Array>>>>();

// Optional bytes options may be undefined (text), so the result is the union.
const optionalBytes = repo.command('status', [['--short']], maybeBytes);
expectType<Equal<typeof optionalBytes, Promise<RawResult<string | Uint8Array>>>>();

function forward(o?: GitCommandExecOpts<GitOutputMode>) {
  return repo.command('status', [['--short']], o);
}
expectType<Equal<ReturnType<typeof forward>, Promise<RawResult<string | Uint8Array>>>>();

// Existing resolution is unchanged.
const literalBytes = repo.command('status', [['--short']], { stdout: 'bytes' });
expectType<Equal<typeof literalBytes, Promise<RawResult<Uint8Array>>>>();
const omitted = repo.command('status', [['--short']]);
expectType<Equal<typeof omitted, Promise<RawResult>>>();
const literalText = repo.command('status', [['--short']], { stdout: 'text' });
expectType<Equal<typeof literalText, Promise<RawResult>>>();
const optionalText = repo.command('status', [['--short']], maybeText);
expectType<Equal<typeof optionalText, Promise<RawResult>>>();

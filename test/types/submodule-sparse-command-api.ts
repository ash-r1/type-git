import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('submodule', []);
git.command('submodule update', [['--init'], ['--filter', 'blob:none']]);
git.command('submodule update', [['--require-init'], ['--filter', 'blob:none']]);
git.command('submodule--helper update', [['--require-init'], ['--no-init'], ['--filter', 'blob:none']]);
// @ts-expect-error The shell frontend does not recognize helper negations.
git.command('submodule update', [['--no-init']]);
// @ts-expect-error Filters require initialization.
git.command('submodule update', [['--filter', 'blob:none']]);
// @ts-expect-error The shell foreach parser rejects a separator.
git.command('submodule foreach', [['--'], { operand: 'true' }]);
git.command('submodule--helper foreach', [['--'], { operand: 'true' }]);
git.command('submodule deinit', [['--all']]);
// @ts-expect-error Deinit needs explicit paths or all.
git.command('submodule deinit', []);
// @ts-expect-error Explicit branches and defaults conflict, including empty values.
git.command('submodule set-branch', [['--branch', ''], ['--default'], { operand: 'module' }]);
// @ts-expect-error Separate short branch values cannot be empty in the shell frontend.
git.command('submodule set-branch', [['-b', ''], { operand: 'module' }]);
git.command('submodule summary', [['--cached'], ['--files'], ['--summary-limit', 0]]);
// @ts-expect-error Without the early zero limit return, the input modes conflict.
git.command('submodule summary', [['--cached'], ['--files']]);
// @ts-expect-error Clone requires a URL and nonempty destination.
git.command('submodule--helper clone', []);
git.command('submodule--helper gitdir', [{ operand: 'module' }]);
git.command('submodule--helper push-check', [{ operand: 'HEAD' }, { operand: 'origin' }]);
git.command('submodule--helper migrate-gitdir-configs', [{ operand: 'ignored' }]);
git.command('sparse-checkout list', [{ operand: 'ignored' }]);
git.command('sparse-checkout set', [['--stdin'], { operand: 'ignored' }]);
git.command('sparse-checkout clean', []);
// @ts-expect-error The root dispatcher requires an operation.
git.command('sparse-checkout', []);
// @ts-expect-error Leading cached is limited to status and summary.
git.command('submodule', [['--cached'], { operand: 'update' }]);
// The selected helper may accept the short alias.
git.command('submodule update', [['-i']]);
git.command('submodule update', [['-i'], ['--init']]);
// The newer helper accepts either spelling; the older profile is asserted below.
git.command('submodule update', [['--init'], ['-i']]);

import type { CheckedCommandArguments } from '../../src/commands/types.js';
type Check<T extends true> = T;
type Accepted<A extends readonly import('../../src/commands/types.js').GitCommandArgument<'submodule update'>[], P extends import('../../src/commands/gui-syntax.js').CommandGrammarContext> = [CheckedCommandArguments<'submodule update', A, P>] extends [never] ? false : true;
export type SubmoduleInitSourceCases = readonly [
  Check<Accepted<[['-i']], {submoduleInitAlias: true}>>,
  Check<Accepted<[['-i']], {submoduleInitAlias: false}> extends false ? true : false>,
  Check<Accepted<[['-i'], ['--init']], {submoduleInitAlias: false}>>,
  Check<Accepted<[['--init'], ['-i']], {submoduleInitAlias: false}> extends false ? true : false>,
  Check<Accepted<[['--init'], ['-i']], {submoduleInitAlias: true}>>,
  Check<[CheckedCommandArguments<'submodule--helper update', [['-i'], ['--no-init'], ['--filter', 'blob:none']], {submoduleInitAlias: true}>] extends [never] ? true : false>,
  Check<[CheckedCommandArguments<'submodule--helper update', [['-i'], ['--init']], {submoduleInitAlias: false}>] extends [never] ? true : false>,
  Check<[CheckedCommandArguments<'submodule--helper update', [['-h'], ['-i']], {submoduleInitAlias: false}>] extends [never] ? false : true>,
];

export type SubmoduleAliasUnionControls = readonly [
  Check<[CheckedCommandArguments<'submodule update' | 'submodule--helper update', [['-i'], ['--init']], {submoduleInitAlias: false}>] extends [never] ? true : false>,
  Check<[CheckedCommandArguments<'submodule--helper update', [readonly ['-i'] | readonly ['-h']], {submoduleInitAlias: false}>] extends [never] ? true : false>,
];

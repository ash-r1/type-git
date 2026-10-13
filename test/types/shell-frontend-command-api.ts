import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('shell', []);
git.command('shell', [['-c', 'custom argument']]);
git.command('shell', [{ operand: 'cvs server' }]);
// @ts-expect-error Command mode takes no extra words.
git.command('shell', [['-c', 'custom'], { operand: 'extra' }]);
// @ts-expect-error Repeating -c is a native argc error.
git.command('shell', [['-c', 'custom'], ['-c', 'custom']]);
// @ts-expect-error Only the special compatibility word is accepted without -c.
git.command('shell', [{ operand: 'custom' }]);
git.command('filter-branch', [['--env-filter', ':'], ['--'], { operand: 'HEAD' }]);
// @ts-expect-error Even an empty explicit commit filter conflicts with prune-empty.
git.command('filter-branch', [['--prune-empty'], ['--commit-filter', '']]);
git.command('quiltimport', [['--dry-run'], { operand: 'ignored' }]);
git.command('instaweb', [{ operand: 'start' }, { operand: 'stop' }]);
// @ts-expect-error All action words are checked, not just operand zero.
git.command('instaweb', [{ operand: 'stop' }, { operand: 'unknown' }]);
git.command('instaweb stop', [['--port', 'unvalidated-by-stop']]);
// @ts-expect-error Git installs this as a sourced library, not a standalone command.
git.command('sh-setup', [{ operand: '-h' }]);
// @ts-expect-error The other sourced library is not a standalone command either.
git.command('sh-i18n', [{ operand: '-h' }]);


import type { Constraint } from '../../src/constraints/model.js';
const valueRule: Extract<Constraint, { kind: 'value' }> = {
  id: 'test.value-discrimination', kind: 'value', key: 'action', allowed: ['stop'],
  origin: 'git', source: 'fixture', reason: 'Value rules retain a separate discriminator.',
};
const elementRule = {
  id: 'test.elements-discrimination', kind: 'elements', key: 'actions', allowed: ['stop'],
  origin: 'git', source: 'fixture', reason: 'Element rules retain a separate discriminator.',
} as const satisfies Extract<Constraint, { kind: 'elements' }>;
void [valueRule, elementRule];
declare const dynamicAction: string;
declare const opaqueAction: string & { readonly __action: unique symbol };
declare const templateAction: `st${string}`;
git.command('instaweb', [{ operand: dynamicAction }]);
git.command('instaweb', [{ operand: opaqueAction }]);
git.command('instaweb', [{ operand: templateAction }]);
declare const mixedAction: 'stop' | 'invalid';
// @ts-expect-error All finite element alternatives must be valid actions.
git.command('instaweb', [{ operand: mixedAction }]);


import type { Constrained } from '../../src/constraints/types.js';
// @ts-expect-error Known object elements cannot belong to a primitive vocabulary.
const invalidObjects: Constrained<{ actions: readonly object[] }, readonly [typeof elementRule]> = { actions: [{}] };
void invalidObjects;


git.command('shell', [['--help']]);
git.command('shell', [['--help'], { operand: 'ignored' }]);
// @ts-expect-error Global documentation dispatch only starts at the first argument.
git.command('shell', [['-c', 'fixture'], ['--help']]);
// @ts-expect-error Short -h is not the global documentation dispatcher here.
git.command('shell', [['-h']]);


import type { GitCommandName } from '../../src/commands/types.js';
type AssertNoCommand<T extends never> = T;
export type SourcedLibrariesHaveNoStandaloneCommand = AssertNoCommand<
  Extract<GitCommandName, 'sh-setup' | 'sh-i18n'>
>;


git.command('filter-branch', [['-h']]);
git.command('filter-branch', [['--help']]);
// @ts-expect-error Late short help does not invoke the sourced-library early exit.
git.command('filter-branch', [['--prune-empty'], ['--commit-filter', ''], ['-h']]);
// @ts-expect-error Late long help is not Git's global documentation dispatch.
git.command('filter-branch', [['--prune-empty'], ['--commit-filter', ''], ['--help']]);
